import type {
  TransactionInput,
  TransactionWithContext,
  TransactionFilters,
} from "../../types/index.js";
import { getDatabase } from "../database.js";
import { escapeLike } from "../utils.js";
import { resolveProviders } from "./providers.js";

interface TransactionWithContextRow {
  id: number;
  account_id: number;
  type: string;
  identifier: string | null;
  date: string;
  processed_date: string;
  original_amount: number;
  original_currency: string;
  charged_amount: number;
  charged_currency: string | null;
  description: string;
  description_en: string | null;
  memo: string | null;
  status: string;
  installment_number: number | null;
  installment_total: number | null;
  category: string | null;
  hash: string;
  unique_id: string;
  created_at: string;
  updated_at: string;
  provider_display_name: string;
  provider_company_id: string;
  provider_alias: string;
  account_number: string;
}

function rowToTransactionWithContext(
  row: TransactionWithContextRow,
): TransactionWithContext {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type as TransactionWithContext["type"],
    identifier: row.identifier,
    date: row.date,
    processedDate: row.processed_date,
    originalAmount: row.original_amount,
    originalCurrency: row.original_currency,
    chargedAmount: row.charged_amount,
    chargedCurrency: row.charged_currency,
    description: row.description,
    descriptionEn: row.description_en,
    memo: row.memo,
    status: row.status as TransactionWithContext["status"],
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    category: row.category,
    hash: row.hash,
    uniqueId: row.unique_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    providerDisplayName: row.provider_display_name,
    providerCompanyId: row.provider_company_id,
    providerAlias: row.provider_alias,
    accountNumber: row.account_number,
  };
}

export function upsertTransaction(
  input: TransactionInput,
): { action: "inserted" | "updated" | "unchanged" } {
  const db = getDatabase();

  // Check if the transaction already exists by exact hash
  const existing = db
    .prepare(
      "SELECT id, status, hash FROM transactions WHERE account_id = $accountId AND hash = $hash",
    )
    .get({ accountId: input.accountId, hash: input.hash }) as
    | { id: number; status: string; hash: string }
    | null;

  if (!existing) {
    // No exact hash match — check for a pending transaction that matches.
    // Strategy 1: exact unique_id match (same date + amount + description).
    // Strategy 2: fuzzy match within ±3 days (banks can shift dates on completion).
    const pendingMatch = db
      .prepare(
        `SELECT id, status, hash FROM transactions
         WHERE account_id = $accountId AND unique_id = $uniqueId AND status = 'pending'`,
      )
      .get({ accountId: input.accountId, uniqueId: input.uniqueId }) as
      | { id: number; status: string; hash: string }
      | null
    ?? db
      .prepare(
        `SELECT id, status, hash FROM transactions
         WHERE account_id = $accountId
           AND status = 'pending'
           AND description = $description
           AND charged_amount = $chargedAmount
           AND date BETWEEN datetime($date, '-3 days') AND datetime($date, '+3 days')
         LIMIT 1`,
      )
      .get({
        accountId: input.accountId,
        description: input.description,
        chargedAmount: input.chargedAmount,
        date: input.date,
      }) as
      | { id: number; status: string; hash: string }
      | null;

    if (pendingMatch) {
      // Update the existing pending transaction with fresh data
      db.prepare(
        `UPDATE transactions
         SET date = $date,
             processed_date = $processedDate,
             status = $status,
             charged_amount = $chargedAmount,
             charged_currency = $chargedCurrency,
             original_amount = $originalAmount,
             original_currency = $originalCurrency,
             description = $description,
             memo = $memo,
             identifier = $identifier,
             hash = $hash,
             unique_id = $uniqueId,
             updated_at = datetime('now')
         WHERE id = $id`,
      ).run({
        id: pendingMatch.id,
        date: input.date,
        processedDate: input.processedDate,
        status: input.status,
        chargedAmount: input.chargedAmount,
        chargedCurrency: input.chargedCurrency ?? null,
        originalAmount: input.originalAmount,
        originalCurrency: input.originalCurrency,
        description: input.description,
        memo: input.memo ?? null,
        identifier: input.identifier ?? null,
        hash: input.hash,
        uniqueId: input.uniqueId,
      });
      return { action: "updated" };
    }

    db.prepare(
      `INSERT INTO transactions (
        account_id, type, identifier, date, processed_date,
        original_amount, original_currency, charged_amount, charged_currency,
        description, description_en, memo, status, installment_number, installment_total,
        category, hash, unique_id
      ) VALUES (
        $accountId, $type, $identifier, $date, $processedDate,
        $originalAmount, $originalCurrency, $chargedAmount, $chargedCurrency,
        $description, $descriptionEn, $memo, $status, $installmentNumber, $installmentTotal,
        $category, $hash, $uniqueId
      )`,
    ).run({
      accountId: input.accountId,
      type: input.type,
      identifier: input.identifier ?? null,
      date: input.date,
      processedDate: input.processedDate,
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
      chargedAmount: input.chargedAmount,
      chargedCurrency: input.chargedCurrency ?? null,
      description: input.description,
      descriptionEn: input.descriptionEn ?? null,
      memo: input.memo ?? null,
      status: input.status,
      installmentNumber: input.installmentNumber ?? null,
      installmentTotal: input.installmentTotal ?? null,
      category: input.category ?? null,
      hash: input.hash,
      uniqueId: input.uniqueId,
    });
    return { action: "inserted" };
  }

  if (existing.status !== input.status) {
    // On status change (e.g. pending→completed), update all mutable fields
    db.prepare(
      `UPDATE transactions
       SET status = $status,
           processed_date = $processedDate,
           charged_amount = $chargedAmount,
           charged_currency = $chargedCurrency,
           original_amount = $originalAmount,
           original_currency = $originalCurrency,
           updated_at = datetime('now')
       WHERE id = $id`,
    ).run({
      id: existing.id,
      status: input.status,
      processedDate: input.processedDate,
      chargedAmount: input.chargedAmount,
      chargedCurrency: input.chargedCurrency ?? null,
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
    });
    return { action: "updated" };
  }

  return { action: "unchanged" };
}

/**
 * Build the base query with JOINs for TransactionWithContext results.
 */
function buildContextQuery(
  whereClause: string,
  orderClause: string,
  limitClause: string,
): string {
  return `
    SELECT
      t.*,
      p.display_name AS provider_display_name,
      p.company_id AS provider_company_id,
      p.alias AS provider_alias,
      a.account_number
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause}
    ${orderClause}
    ${limitClause}
  `;
}

/**
 * Build WHERE clause and params from TransactionFilters.
 */
type SqlParams = Record<string, string | number | null>;

function buildFilterClauses(filters: TransactionFilters): {
  conditions: string[];
  params: SqlParams;
} {
  const conditions: string[] = [];
  const params: SqlParams = {};

  if (filters.from) {
    conditions.push("t.date >= $from");
    params.from = filters.from;
  }
  if (filters.to) {
    conditions.push("t.date <= $to");
    // Append end-of-day so date-only filters include the full day
    params.to = filters.to.length === 10 ? filters.to + "T23:59:59.999Z" : filters.to;
  }
  if (filters.providerId !== undefined && filters.providerId !== null && !isNaN(Number(filters.providerId))) {
    conditions.push("a.provider_id = $providerId");
    params.providerId = Number(filters.providerId);
  } else if (filters.providerCompanyId) {
    conditions.push("p.company_id = $providerCompanyId");
    params.providerCompanyId = filters.providerCompanyId;
  } else if (filters.provider && filters.provider !== "__all__") {
    const numId = Number(filters.provider);
    if (!isNaN(numId) && String(numId) === String(filters.provider).trim()) {
      conditions.push("a.provider_id = $providerId");
      params.providerId = numId;
    } else {
      const resolved = resolveProviders(filters.provider);
      if (resolved.length === 1) {
        conditions.push("a.provider_id = $providerId");
        params.providerId = resolved[0].id;
      } else if (resolved.length > 1) {
        const ids = resolved.map((p) => p.id);
        conditions.push(`a.provider_id IN (${ids.join(",")})`);
      } else {
        conditions.push(
          "(p.company_id = $provider OR p.alias = $provider OR p.display_name = $provider)"
        );
        params.provider = filters.provider;
      }
    }
  }

  if (filters.providerType) {
    conditions.push("p.type = $providerType");
    params.providerType = filters.providerType;
  }

  if (filters.accountId !== undefined && filters.accountId !== null && !isNaN(Number(filters.accountId))) {
    conditions.push("t.account_id = $accountId");
    params.accountId = Number(filters.accountId);
  } else if (filters.accountNumber) {
    conditions.push("a.account_number = $accountNumber");
    params.accountNumber = filters.accountNumber;
  } else if (filters.account && filters.account !== "__all__") {
    const numAccountId = Number(filters.account);
    if (!isNaN(numAccountId) && String(numAccountId) === String(filters.account).trim()) {
      conditions.push("t.account_id = $accountId");
      params.accountId = numAccountId;
    } else {
      conditions.push("a.account_number = $accountNumber");
      params.accountNumber = filters.account;
    }
  }

  if (filters.minAmount !== undefined && filters.minAmount !== null && !isNaN(Number(filters.minAmount))) {
    conditions.push("t.charged_amount >= $minAmount");
    params.minAmount = Number(filters.minAmount);
  }
  if (filters.maxAmount !== undefined && filters.maxAmount !== null && !isNaN(Number(filters.maxAmount))) {
    conditions.push("t.charged_amount <= $maxAmount");
    params.maxAmount = Number(filters.maxAmount);
  }
  if (filters.status && (filters.status as string) !== "__all__") {
    conditions.push("t.status = $status");
    params.status = filters.status;
  }
  if (filters.search) {
    conditions.push(
      "(t.description LIKE $search ESCAPE '\\' OR t.description_en LIKE $search ESCAPE '\\' OR t.memo LIKE $search ESCAPE '\\')"
    );
    params.search = `%${escapeLike(filters.search)}%`;
  } else if (filters.description) {
    conditions.push("t.description LIKE $description ESCAPE '\\'");
    params.description = `%${escapeLike(filters.description)}%`;
  }
  if (filters.category !== undefined && filters.category !== "__all__") {
    if (filters.category === null || filters.category === "Uncategorized") {
      conditions.push("(t.category IS NULL OR t.category = 'Uncategorized')");
    } else {
      conditions.push("t.category = $category");
      params.category = filters.category;
    }
  }
  if (filters.translated === true) {
    conditions.push("t.description_en IS NOT NULL");
  } else if (filters.translated === false) {
    conditions.push("t.description_en IS NULL");
  }

  return { conditions, params };
}

export function listTransactions(
  filters: TransactionFilters,
): TransactionWithContext[] {
  const db = getDatabase();
  const { conditions, params } = buildFilterClauses(filters);

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const sortCol =
    filters.sort === "amount" ? "t.charged_amount" : "t.date";
  const sortDir = filters.sortDirection === "asc" ? "ASC" : "DESC";
  const orderClause = `ORDER BY ${sortCol} ${sortDir}`;

  let limitClause = "";
  if (filters.limit !== undefined && !isNaN(Number(filters.limit))) {
    limitClause = "LIMIT $limit";
    params.limit = Number(filters.limit);
    if (filters.offset !== undefined && !isNaN(Number(filters.offset))) {
      limitClause += " OFFSET $offset";
      params.offset = Number(filters.offset);
    }
  }

  const sql = buildContextQuery(whereClause, orderClause, limitClause);
  const rows = db.prepare(sql).all(params) as TransactionWithContextRow[];

  return rows.map(rowToTransactionWithContext);
}

export function searchTransactions(
  query: string,
  filters?: TransactionFilters,
): TransactionWithContext[] {
  const db = getDatabase();
  // Clear description filter to avoid double-applying with the search query
  if (filters?.description) {
    filters = { ...filters, description: undefined };
  }
  const { conditions, params } = buildFilterClauses(filters ?? {});

  conditions.push("t.description LIKE $searchQuery ESCAPE '\\'");
  params.searchQuery = `%${escapeLike(query)}%`;

  const whereClause = "WHERE " + conditions.join(" AND ");

  const sortCol =
    filters?.sort === "amount" ? "t.charged_amount" : "t.date";
  const sortDir = filters?.sortDirection === "asc" ? "ASC" : "DESC";
  const orderClause = `ORDER BY ${sortCol} ${sortDir}`;

  let limitClause = "";
  if (filters?.limit !== undefined && !isNaN(Number(filters.limit))) {
    limitClause = "LIMIT $limit";
    params.limit = Number(filters.limit);
    if (filters.offset !== undefined && !isNaN(Number(filters.offset))) {
      limitClause += " OFFSET $offset";
      params.offset = Number(filters.offset);
    }
  }

  const sql = buildContextQuery(whereClause, orderClause, limitClause);
  const rows = db.prepare(sql).all(params) as TransactionWithContextRow[];

  return rows.map(rowToTransactionWithContext);
}

export function deleteTransaction(
  id: number,
): { deleted: boolean; transaction?: { description: string; chargedAmount: number; date: string } } {
  const db = getDatabase();

  const existing = db
    .prepare("SELECT description, charged_amount, date FROM transactions WHERE id = $id")
    .get({ id: id }) as { description: string; charged_amount: number; date: string } | null;

  if (!existing) {
    return { deleted: false };
  }

  db.prepare("DELETE FROM transactions WHERE id = $id").run({ id: id });

  return {
    deleted: true,
    transaction: {
      description: existing.description,
      chargedAmount: existing.charged_amount,
      date: existing.date,
    },
  };
}

export function updateTransactionCategory(
  id: number,
  category: string | null,
): boolean {
  const db = getDatabase();
  const result = db
    .prepare(
      "UPDATE transactions SET category = $category, updated_at = datetime('now') WHERE id = $id",
    )
    .run({ id: id, category: category });
  return result.changes > 0;
}

export function updateTransactionTranslation(
  id: number,
  descriptionEn: string,
): boolean {
  const db = getDatabase();
  const result = db
    .prepare(
      "UPDATE transactions SET description_en = $descriptionEn, updated_at = datetime('now') WHERE id = $id",
    )
    .run({ id: id, descriptionEn: descriptionEn });
  return result.changes > 0;
}

export function countTransactions(filters?: TransactionFilters): number {
  const db = getDatabase();
  const { conditions, params } = buildFilterClauses(filters ?? {});

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const sql = `
    SELECT COUNT(*) AS count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN providers p ON a.provider_id = p.id
    ${whereClause}
  `;

  const row = db.prepare(sql).get(params) as { count: number };
  return row.count;
}
