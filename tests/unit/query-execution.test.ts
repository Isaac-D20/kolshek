import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import { createProvider } from "../../src/db/repositories/providers.js";
import { upsertAccount, updateAccountExcluded } from "../../src/db/repositories/accounts.js";
import { upsertTransaction } from "../../src/db/repositories/transactions.js";
import { executeQuery, executeQueryBatch, type NetWorthResult } from "../../src/services/query.js";
import { pageDefinitionSchema } from "../../src/core/page-schema.js";

beforeAll(() => {
  initDatabase(":memory:");
  const provider = createProvider("hapoalim", "Bank Hapoalim", "bank");
  const account = upsertAccount(provider.id, "12345", "hapoalim", 1000, "ILS");

  upsertTransaction({
    accountId: account.id,
    type: "normal",
    date: "2026-03-15",
    processedDate: "2026-03-15",
    originalAmount: 150,
    originalCurrency: "ILS",
    chargedAmount: -150,
    chargedCurrency: "ILS",
    description: "Supermarket",
    status: "completed",
    hash: "tx-1",
    uniqueId: "tx-1",
    category: "Groceries",
  });

  upsertTransaction({
    accountId: account.id,
    type: "normal",
    date: "2026-04-10",
    processedDate: "2026-04-10",
    originalAmount: 300,
    originalCurrency: "ILS",
    chargedAmount: -300,
    chargedCurrency: "ILS",
    description: "Electricity",
    status: "completed",
    hash: "tx-2",
    uniqueId: "tx-2",
    category: "Utilities",
  });
});

afterAll(() => {
  closeDatabase();
});

describe("Query execution", () => {
  it("executes trend query with 4-digit year period filter", () => {
    const result = executeQuery({
      type: "trend",
      interval: "month",
      series: "total",
      metric: "sum",
      filters: {
        period: "2026",
      },
    }) as { points: Array<{ date: string; value: number }> };

    expect(result).toBeDefined();
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual({ date: "2026-03", value: 150 });
    expect(result.points[1]).toEqual({ date: "2026-04", value: 300 });
  });

  it("executes batch queries matching page widgets", () => {
    const batch = executeQueryBatch([
      {
        key: "chart_1",
        query: {
          type: "trend",
          interval: "month",
          series: "total",
          metric: "sum",
          filters: {
            period: "2026",
          },
        },
      },
    ]);

    expect(batch["chart_1"]).toBeDefined();
    expect((batch["chart_1"] as any).points).toHaveLength(2);
  });

  it("calculates net worth history across multiple accounts", () => {
    // Current state of account 12345:
    // Anchor balance = 1000
    // tx-1: 2026-03-15: -150
    // tx-2: 2026-04-10: -300
    // Reconstructed balance:
    // End of 2026-02: 1000 - (-150 + -300) = 1450 (complete: false because earliest tx is 2026-03-15)
    // End of 2026-03: 1000 - (-300) = 1300 (complete: true)
    // End of 2026-04: 1000 - 0 = 1000 (complete: true)
    // End of 2026-05: 1000 - 0 = 1000 (complete: true)

    const result = executeQuery({
      type: "net_worth",
      interval: "month",
      from: "2026-02-01",
      to: "2026-05-31",
    }) as NetWorthResult;

    expect(result).toBeDefined();
    expect(result.currency).toBe("ILS");
    expect(result.points).toHaveLength(4);
    expect(result.points[0]).toEqual({ date: "2026-02", value: 1450, complete: false });
    expect(result.points[1]).toEqual({ date: "2026-03", value: 1300, complete: true });
    expect(result.points[2]).toEqual({ date: "2026-04", value: 1000, complete: true });
    expect(result.points[3]).toEqual({ date: "2026-05", value: 1000, complete: true });
    expect(result.coverage.partialAccounts).toContain("12345");
  });

  it("reconstructs daily and weekly net worth intervals", () => {
    const dayResult = executeQuery({
      type: "net_worth",
      interval: "day",
      from: "2026-03-14",
      to: "2026-03-16",
    }) as NetWorthResult;

    expect(dayResult.points).toHaveLength(3);
    // Before tx-1 (on 2026-03-15): balance was 1450
    expect(dayResult.points[0]).toEqual({ date: "2026-03-14", value: 1450, complete: false });
    // After tx-1 (-150): balance is 1300
    expect(dayResult.points[1]).toEqual({ date: "2026-03-15", value: 1300, complete: true });
    expect(dayResult.points[2]).toEqual({ date: "2026-03-16", value: 1300, complete: true });

    const weekResult = executeQuery({
      type: "net_worth",
      interval: "week",
      from: "2026-03-01",
      to: "2026-04-30",
    }) as NetWorthResult;

    expect(weekResult.points.length).toBeGreaterThan(0);
    expect(weekResult.points[0].date).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("handles account filters and excluded accounts in net worth calculation", () => {
    const provider = createProvider("max", "Max IT Finance", "credit_card");
    const cardAccount = upsertAccount(provider.id, "99999", "max", -500, "ILS");
    updateAccountExcluded(cardAccount.id, true);

    upsertTransaction({
      accountId: cardAccount.id,
      type: "normal",
      date: "2026-04-01",
      processedDate: "2026-04-01",
      originalAmount: 200,
      originalCurrency: "ILS",
      chargedAmount: -200,
      chargedCurrency: "ILS",
      description: "Card purchase",
      status: "completed",
      hash: "tx-card",
      uniqueId: "tx-card",
    });

    // Excluded account 99999 should not affect net worth
    const result = executeQuery({
      type: "net_worth",
      interval: "month",
      from: "2026-04-01",
      to: "2026-04-30",
    }) as NetWorthResult;

    expect(result.points[0].value).toBe(1000);

    // Filtering by specific account
    const singleAccountResult = executeQuery({
      type: "net_worth",
      interval: "month",
      accounts: ["12345"],
      from: "2026-04-01",
      to: "2026-04-30",
    }) as NetWorthResult;

    expect(singleAccountResult.points[0].value).toBe(1000);
  });

  it("validates page definition schema containing net_worth query widget", () => {
    const validPageDefinition = {
      id: "net-worth",
      title: "Net Worth Over Time",
      definition: {
        type: "chart",
        chartType: "line",
        title: "Net Worth Over Time",
        query: {
          type: "net_worth",
          interval: "month",
        },
      },
    };

    const parsed = pageDefinitionSchema.safeParse(validPageDefinition);
    expect(parsed.success).toBe(true);
  });
});
