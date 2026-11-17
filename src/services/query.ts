// Query executor — translates composable query primitives into DB calls.
// Each primitive is deeply parameterized; the AI agent varies params to
// express any financial view without needing new query types.

import { getDatabase } from "../db/database.js";
import { buildClassificationExcludeSQL } from "../db/repositories/categories.js";
import { DEFAULT_REPORT_EXCLUDES } from "../types/index.js";
import { getBalanceReport } from "../db/repositories/reports.js";
import { getBudgetVsActual } from "../db/repositories/budgets.js";
import { escapeLike } from "../db/utils.js";
import type { WidgetQuery } from "../core/page-schema.js";

type SqlParams = Record<string, string | number | null>;

// ---------------------------------------------------------------------------
// Shared filter builder
// ---------------------------------------------------------------------------

interface ParsedFilters {
  from: string;
  to: string;
}

function parsePeriod(period?: string): ParsedFilters {
  const now = new Date();
  if (!period || period === "month") {
    // Current month
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return { from: `${y}-${m}-01`, to: `${y}-${m}-31T23:59:59.999Z` };
  }
  if (period === "year") {
    // Current year
    const y = now.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31T23:59:59.999Z` };
  }
  // Single year: "2026"
  if (/^\d{4}$/.test(period)) {
    return { from: `${period}-01-01`, to: `${period}-12-31T23:59:59.999Z` };
  }
  // Relative days: "90d", "30d", etc.
  const daysMatch = period.match(/^(\d+)d$/);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    const from = new Date(now.getTime() - days * 86400000);
    return {
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10) + "T23:59:59.999Z",
    };
  }
  // Range: "2026-01/2026-03"
  if (period.includes("/")) {
    const [fromPart, toPart] = period.split("/");
    const fromDate = fromPart.length === 7 ? fromPart + "-01" : fromPart;
    const toDate = toPart.length === 7 ? toPart + "-31T23:59:59.999Z" : toPart + "T23:59:59.999Z";
    return { from: fromDate, to: toDate };
  }
  // Single month: "2026-01"
  if (period.length === 7) {
    return { from: period + "-01", to: period + "-31T23:59:59.999Z" };
  }
  // Single date
  return { from: period, to: period + "T23:59:59.999Z" };
}

interface FilterBuildResult {
  conditions: string[];
  params: SqlParams;
  from: string;
  to: string;
}

function buildFilterConditions(filters?: Record<string, unknown>): FilterBuildResult {
  const f = (filters ?? {}) as Record<string, unknown>;
  const { from, to } = parsePeriod(f.period as string | undefined);
  const conditions: string[] = ["t.date >= $from", "t.date <= $to"];
  const params: SqlParams = { from: from, to: to };

  // Direction filter
  const dir = f.direction as string | undefined;
  if (dir === "expense") {
    conditions.push("t.charged_amount < 0");
  } else if (dir === "income") {
    conditions.push("t.charged_amount > 0");
  }

  // Category filter
  const categories = f.category as string[] | undefined;
  if (categories && categories.length > 0) {
    const placeholders = categories.map((_, i) => `$cat_${i}`);
    conditions.push(`COALESCE(t.category, 'Uncategorized') IN (${placeholders.join(", ")})`);
    categories.forEach((c, i) => { params[`cat_${i}`] = c; });
  }

  // Merchant filter (glob patterns)
  const merchants = f.merchant as string[] | undefined;
  if (merchants && merchants.length > 0) {
    const merchConditions = merchants.map((_, i) => {
      return `COALESCE(t.description_en, t.description) LIKE $merch_${i} ESCAPE '\\'`;
    });
    conditions.push(`(${merchConditions.join(" OR ")})`);
    merchants.forEach((m, i) => {
      // Convert glob * to SQL %
      const pattern = m.replace(/\*/g, "%");
      params[`$merch_${i}`] = pattern.includes("%") ? pattern : `%${escapeLike(m)}%`;
    });
  }

  // Amount range
  if (typeof f.amountMin === "number") {
    conditions.push("ABS(t.charged_amount) >= $amountMin");
    params.amountMin = f.amountMin;
  }
  if (typeof f.amountMax === "number") {
    conditions.push("ABS(t.charged_amount) <= $amountMax");
    params.amountMax = f.amountMax;
  }

  // Account filter
  const accounts = f.account as string[] | undefined;
  if (accounts && accounts.length > 0) {
    const placeholders = accounts.map((_, i) => `$acct_${i}`);
    conditions.push(`a.account_number IN (${placeholders.join(", ")})`);
    accounts.forEach((a, i) => { params[`$acct_${i}`] = a; });
  }

  // Transaction type
  const txType = f.type as string | undefined;
  if (txType && txType !== "all") {
    conditions.push("t.type = $txType");
    params.txType = txType;
  }

  // Default: exclude cc_billing for spending queries
  const { sql: excludeSQL, params: excludeParams } = buildClassificationExcludeSQL(DEFAULT_REPORT_EXCLUDES);
  conditions.push(excludeSQL);
  Object.assign(params, excludeParams);
  return { conditions, params, from, to };
}

// ---------------------------------------------------------------------------
// Aggregate resolver
// ---------------------------------------------------------------------------

interface AggregateResult {
  value: number | null;
  groups?: Array<{ label: string; value: number; count: number; percentage?: number }>;
  comparison?: { previousValue: number; change: number };
}

function executeAggregateQuery(query: Extract<WidgetQuery, { type: "aggregate" }>): AggregateResult {
  const db = getDatabase();
  const { conditions, params, from, to } = buildFilterConditions(query.filters);

  const metric = query.metric ?? "sum";
  const field = query.field === "originalAmount" ? "t.original_amount" : "t.charged_amount";
  const absField = `ABS(${field})`;

  let metricExpr: string;
  switch (metric) {
    case "sum": metricExpr = `SUM(${absField})`; break;
    case "avg": metricExpr = `ROUND(AVG(${absField}), 2)`; break;
    case "count": metricExpr = "COUNT(*)"; break;
    case "min": metricExpr = `MIN(${absField})`; break;
    case "max": metricExpr = `MAX(${absField})`; break;
  }

  if (!query.groupBy) {
    // Single aggregate value
    const sql = `
      SELECT ${metricExpr} AS value, COUNT(*) AS cnt
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ${conditions.join(" AND ")}
    `;
    const row = db.prepare(sql).get(params) as { value: number | null; cnt: number };

    let comparison: AggregateResult["comparison"];
    if (query.compareTo === "previous_period") {
      const duration = new Date(to).getTime() - new Date(from).getTime();
      const prevFrom = new Date(new Date(from).getTime() - duration).toISOString().slice(0, 10);
      const prevTo = from;
      const prevParams = { ...params, from: prevFrom, to: prevTo };
      const prevRow = db.prepare(sql).get(prevParams) as { value: number | null; cnt: number };
      const prev = prevRow.value ?? 0;
      const curr = row.value ?? 0;
      comparison = {
        previousValue: prev,
        change: prev > 0 ? Math.round(((curr - prev) / prev) * 10000) / 100 : 0,
      };
    }

    return { value: row.value, comparison };
  }

  // Grouped aggregate
  let labelExpr: string;
  switch (query.groupBy) {
    case "category": labelExpr = "COALESCE(t.category, 'Uncategorized')"; break;
    case "merchant": labelExpr = "COALESCE(t.description_en, t.description)"; break;
    case "month": labelExpr = "strftime('%Y-%m', t.date)"; break;
    case "week": labelExpr = "strftime('%Y-W%W', t.date)"; break;
    case "day": labelExpr = "strftime('%Y-%m-%d', t.date)"; break;
    case "account": labelExpr = "a.account_number"; break;
  }

  const sort = query.sort ?? "value_desc";
  let orderBy: string;
  switch (sort) {
    case "value_asc": orderBy = "value ASC"; break;
    case "label_asc": orderBy = "label ASC"; break;
    default: orderBy = "value DESC";
  }

  const limitClause = query.limit ? `LIMIT ${Number(query.limit)}` : "";

  const sql = `
    SELECT ${labelExpr} AS label, ${metricExpr} AS value, COUNT(*) AS cnt
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY label
    ORDER BY ${orderBy}
    ${limitClause}
  `;

  const rows = db.prepare(sql).all(params) as Array<{ label: string; value: number; cnt: number }>;
  const total = rows.reduce((s, r) => s + r.value, 0);

  return {
    value: total,
    groups: rows.map((r) => ({
      label: r.label,
      value: r.value,
      count: r.cnt,
      percentage: total > 0 ? Math.round((r.value / total) * 10000) / 100 : 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Trend resolver
// ---------------------------------------------------------------------------

interface TrendPoint {
  date: string;
  value: number;
  breakdown?: Array<{ label: string; value: number }>;
}

interface TrendResult {
  points: TrendPoint[];
}

function executeTrendQuery(query: Extract<WidgetQuery, { type: "trend" }>): TrendResult {
  const db = getDatabase();
  const { conditions, params } = buildFilterConditions(query.filters);

  const interval = query.interval ?? "month";
  const metric = query.metric ?? "sum";
  const series = query.series ?? "total";

  let dateExpr: string;
  switch (interval) {
    case "day": dateExpr = "strftime('%Y-%m-%d', t.date)"; break;
    case "week": dateExpr = "strftime('%Y-W%W', t.date)"; break;
    default: dateExpr = "strftime('%Y-%m', t.date)";
  }

  let metricExpr: string;
  switch (metric) {
    case "avg": metricExpr = "ROUND(AVG(ABS(t.charged_amount)), 2)"; break;
    case "count": metricExpr = "COUNT(*)"; break;
    default: metricExpr = "SUM(ABS(t.charged_amount))";
  }

  if (series === "total") {
    const sql = `
      SELECT ${dateExpr} AS period, ${metricExpr} AS value
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY period
      ORDER BY period ASC
    `;
    const rows = db.prepare(sql).all(params) as Array<{ period: string; value: number }>;
    return { points: rows.map((r) => ({ date: r.period, value: r.value })) };
  }

  // Breakdown by category or merchant
  const labelExpr = series === "category"
    ? "COALESCE(t.category, 'Uncategorized')"
    : "COALESCE(t.description_en, t.description)";

  const sql = `
    SELECT ${dateExpr} AS period, ${labelExpr} AS label, ${metricExpr} AS value
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY period, label
    ORDER BY period ASC, value DESC
  `;

  const rows = db.prepare(sql).all(params) as Array<{ period: string; label: string; value: number }>;

  // Group by period
  const byPeriod = new Map<string, Array<{ label: string; value: number }>>();
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
    byPeriod.get(r.period)!.push({ label: r.label, value: r.value });
  }

  return {
    points: [...byPeriod.entries()].map(([date, breakdown]) => ({
      date,
      value: breakdown.reduce((s, b) => s + b.value, 0),
      breakdown,
    })),
  };
}

// ---------------------------------------------------------------------------
// Transactions resolver
// ---------------------------------------------------------------------------

interface TransactionsResult {
  rows: Array<{
    id: number;
    date: string;
    description: string;
    descriptionEn: string | null;
    category: string | null;
    chargedAmount: number;
    provider: string;
    account: string;
  }>;
  total: number;
}

function executeTransactionsQuery(query: Extract<WidgetQuery, { type: "transactions" }>): TransactionsResult {
  const db = getDatabase();
  const { conditions, params } = buildFilterConditions(query.filters);

  const sortMap: Record<string, string> = {
    date_desc: "t.date DESC",
    date_asc: "t.date ASC",
    amount_desc: "ABS(t.charged_amount) DESC",
    amount_asc: "ABS(t.charged_amount) ASC",
  };
  const orderBy = sortMap[query.sort ?? "date_desc"];
  const limit = Math.min(query.limit ?? 50, 500);
  const offset = query.offset ?? 0;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
  `;

  const sql = `
    SELECT
      t.id, t.date, t.description, t.description_en, t.category,
      t.charged_amount, p.alias AS provider, a.account_number AS account
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $limit OFFSET $offset
  `;

  const countRow = db.prepare(countSql).get(params) as { total: number };
  const rows = db.prepare(sql).all({ ...params, limit: limit, offset: offset }) as Array<{
    id: number;
    date: string;
    description: string;
    description_en: string | null;
    category: string | null;
    charged_amount: number;
    provider: string;
    account: string;
  }>;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      descriptionEn: r.description_en,
      category: r.category,
      chargedAmount: r.charged_amount,
      provider: r.provider,
      account: r.account,
    })),
    total: countRow.total,
  };
}

// ---------------------------------------------------------------------------
// Balances resolver
// ---------------------------------------------------------------------------

function executeBalancesQuery(query: Extract<WidgetQuery, { type: "balances" }>) {
  const accounts = getBalanceReport();
  if (query.account && query.account.length > 0) {
    return { accounts: accounts.filter((a) => query.account!.includes(a.accountNumber)) };
  }
  return { accounts };
}

// ---------------------------------------------------------------------------
// Budget vs actual resolver
// ---------------------------------------------------------------------------

function executeBudgetVsActualQuery(query: Extract<WidgetQuery, { type: "budget_vs_actual" }>) {
  const now = new Date();
  const month = query.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { items: getBudgetVsActual(month) };
}

// ---------------------------------------------------------------------------
// Net Worth history resolver
// ---------------------------------------------------------------------------

export interface NetWorthPoint {
  date: string;
  value: number;
  complete: boolean;
}

export interface NetWorthResult {
  points: NetWorthPoint[];
  currency: string;
  coverage: {
    from: string;
    through: string;
    partialAccounts: string[];
  };
}

function getSqliteWeekKey(d: Date): string {
  const year = d.getUTCFullYear();
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const jan1Day = firstDayOfYear.getUTCDay();
  const dayOfYear = Math.floor((d.getTime() - firstDayOfYear.getTime()) / 86400000);
  const daysToFirstMonday = (8 - jan1Day) % 7;
  let weekNum = 0;
  if (dayOfYear >= daysToFirstMonday) {
    weekNum = Math.floor((dayOfYear - daysToFirstMonday) / 7) + 1;
  }
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

function generateNetWorthPeriods(
  fromStr: string,
  toStr: string,
  interval: "day" | "week" | "month",
): Array<{ key: string; startDate: string; cutoffDate: string }> {
  const normFrom = fromStr.length === 7 ? `${fromStr}-01` : fromStr.slice(0, 10);
  let normTo = toStr.slice(0, 10);
  if (toStr.length === 7) {
    const [y, m] = toStr.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    normTo = `${toStr}-${String(lastDay).padStart(2, "0")}`;
  }

  const fromDate = new Date(`${normFrom}T00:00:00.000Z`);
  const toDate = new Date(`${normTo}T00:00:00.000Z`);

  if (fromDate > toDate) {
    return [];
  }

  if (interval === "month") {
    const startYear = parseInt(normFrom.slice(0, 4), 10);
    const startMonth = parseInt(normFrom.slice(5, 7), 10);
    const endYear = parseInt(normTo.slice(0, 4), 10);
    const endMonth = parseInt(normTo.slice(5, 7), 10);

    const periods: Array<{ key: string; startDate: string; cutoffDate: string }> = [];
    let curY = startYear;
    let curM = startMonth;

    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const mStr = String(curM).padStart(2, "0");
      const key = `${curY}-${mStr}`;
      const startDate = `${key}-01T00:00:00.000Z`;
      const lastDay = new Date(Date.UTC(curY, curM, 0)).getUTCDate();
      const cutoffDate = `${key}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
      periods.push({ key, startDate, cutoffDate });

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return periods;
  }

  if (interval === "day") {
    const periods: Array<{ key: string; startDate: string; cutoffDate: string }> = [];
    const cur = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cur.getUTCDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      periods.push({
        key,
        startDate: `${key}T00:00:00.000Z`,
        cutoffDate: `${key}T23:59:59.999Z`,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return periods;
  }

  // interval === "week"
  const periodsMap = new Map<string, { key: string; startDate: string; cutoffDate: string }>();
  const cur = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

  while (cur <= end) {
    const key = getSqliteWeekKey(cur);
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    const existing = periodsMap.get(key);
    if (!existing) {
      periodsMap.set(key, {
        key,
        startDate: `${dateStr}T00:00:00.000Z`,
        cutoffDate: `${dateStr}T23:59:59.999Z`,
      });
    } else {
      existing.cutoffDate = `${dateStr}T23:59:59.999Z`;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return Array.from(periodsMap.values());
}

function executeNetWorthQuery(query: Extract<WidgetQuery, { type: "net_worth" }>): NetWorthResult {
  const db = getDatabase();
  const interval = query.interval ?? "month";

  // Determine date bounds
  let from: string;
  let to: string;

  if (query.from && query.to) {
    from = query.from;
    to = query.to;
  } else if (query.filters?.period) {
    const parsed = parsePeriod(query.filters.period);
    from = parsed.from ?? "";
    to = parsed.to ?? "";
  } else if (query.from) {
    from = query.from;
    const now = new Date();
    to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  } else if (query.to) {
    to = query.to;
    const toDate = new Date(to.length === 7 ? `${to}-01` : to);
    if (interval === "day") {
      const fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - 30);
      from = fromDate.toISOString().slice(0, 10);
    } else if (interval === "week") {
      const fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - 84);
      from = fromDate.toISOString().slice(0, 10);
    } else {
      const fromDate = new Date(toDate);
      fromDate.setFullYear(fromDate.getFullYear() - 1);
      from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-01`;
    }
  } else {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    to = todayStr;
    if (interval === "day") {
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 30);
      from = fromDate.toISOString().slice(0, 10);
    } else if (interval === "week") {
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 84);
      from = fromDate.toISOString().slice(0, 10);
    } else {
      const fromDate = new Date(now);
      fromDate.setMonth(fromDate.getMonth() - 11);
      from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-01`;
    }
  }

  const targetAccounts = query.accounts ?? query.filters?.account;
  const currency = "ILS";

  let accountSql = `
    SELECT
      a.id,
      a.account_number,
      a.balance,
      a.currency,
      (SELECT MIN(t.date) FROM transactions t WHERE t.account_id = a.id AND t.status = 'completed') AS earliest_date
    FROM accounts a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.excluded = 0
      AND a.balance IS NOT NULL
      AND a.currency = $currency
  `;

  const accountParams: Record<string, unknown> = { currency };

  if (targetAccounts && targetAccounts.length > 0) {
    const placeholders = targetAccounts.map((_, i) => `$acc_${i}`).join(", ");
    accountSql += ` AND a.account_number IN (${placeholders})`;
    targetAccounts.forEach((acc, i) => {
      accountParams[`acc_${i}`] = acc;
    });
  }

  const eligibleAccounts = db.prepare(accountSql).all(accountParams) as Array<{
    id: number;
    account_number: string;
    balance: number;
    currency: string;
    earliest_date: string | null;
  }>;

  if (eligibleAccounts.length === 0) {
    return {
      points: [],
      currency,
      coverage: {
        from,
        through: to,
        partialAccounts: [],
      },
    };
  }

  const accountIds = eligibleAccounts.map((a) => a.id);
  const accountPlaceholders = accountIds.map((_, i) => `$id_${i}`).join(", ");
  const txParams: Record<string, unknown> = {};
  accountIds.forEach((id, i) => {
    txParams[`id_${i}`] = id;
  });

  const txSql = `
    SELECT
      t.account_id,
      t.date,
      t.charged_amount
    FROM transactions t
    WHERE t.account_id IN (${accountPlaceholders})
      AND t.status = 'completed'
    ORDER BY t.date ASC
  `;

  const transactions = db.prepare(txSql).all(txParams) as Array<{
    account_id: number;
    date: string;
    charged_amount: number;
  }>;

  const txByAccount = new Map<number, Array<{ date: string; amount: number }>>();
  for (const acc of eligibleAccounts) {
    txByAccount.set(acc.id, []);
  }
  for (const tx of transactions) {
    const list = txByAccount.get(tx.account_id);
    if (list) {
      list.push({ date: tx.date, amount: tx.charged_amount });
    }
  }

  const initialBalanceByAccount = new Map<number, number>();
  for (const acc of eligibleAccounts) {
    const txList = txByAccount.get(acc.id) ?? [];
    const totalTxSum = txList.reduce((sum, t) => sum + t.amount, 0);
    initialBalanceByAccount.set(acc.id, acc.balance - totalTxSum);
  }

  const periods = generateNetWorthPeriods(from, to, interval);
  const points: NetWorthPoint[] = [];
  const partialAccountsSet = new Set<string>();

  const txPointerByAccount = new Map<number, number>();
  const runningSumByAccount = new Map<number, number>();
  for (const acc of eligibleAccounts) {
    txPointerByAccount.set(acc.id, 0);
    runningSumByAccount.set(acc.id, 0);
  }

  for (const period of periods) {
    let totalNetWorth = 0;
    let periodComplete = true;

    for (const acc of eligibleAccounts) {
      const txList = txByAccount.get(acc.id) ?? [];
      let ptr = txPointerByAccount.get(acc.id) ?? 0;
      let runningSum = runningSumByAccount.get(acc.id) ?? 0;

      while (ptr < txList.length && txList[ptr].date <= period.cutoffDate) {
        runningSum += txList[ptr].amount;
        ptr++;
      }

      txPointerByAccount.set(acc.id, ptr);
      runningSumByAccount.set(acc.id, runningSum);

      const initBal = initialBalanceByAccount.get(acc.id) ?? 0;
      const accBalanceAtCutoff = initBal + runningSum;
      totalNetWorth += accBalanceAtCutoff;

      if (acc.earliest_date && acc.earliest_date > period.cutoffDate) {
        periodComplete = false;
        partialAccountsSet.add(acc.account_number);
      }
    }

    points.push({
      date: period.key,
      value: Math.round(totalNetWorth * 100) / 100,
      complete: periodComplete,
    });
  }

  return {
    points,
    currency,
    coverage: {
      from,
      through: to,
      partialAccounts: Array.from(partialAccountsSet),
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type QueryResult = unknown;

export function executeQuery(query: WidgetQuery): QueryResult {
  switch (query.type) {
    case "aggregate": return executeAggregateQuery(query);
    case "trend": return executeTrendQuery(query);
    case "transactions": return executeTransactionsQuery(query);
    case "balances": return executeBalancesQuery(query);
    case "budget_vs_actual": return executeBudgetVsActualQuery(query);
    case "net_worth": return executeNetWorthQuery(query);
  }
}

// Batch resolve multiple queries
export function executeQueryBatch(
  queries: Array<{ key: string; query: WidgetQuery }>,
): Record<string, QueryResult> {
  const results: Record<string, QueryResult> = {};
  for (const { key, query } of queries) {
    try {
      results[key] = executeQuery(query);
    } catch (err) {
      results[key] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return results;
}
