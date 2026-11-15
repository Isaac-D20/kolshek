import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import { createProvider } from "../../src/db/repositories/providers.js";
import { upsertAccount } from "../../src/db/repositories/accounts.js";
import { upsertTransaction } from "../../src/db/repositories/transactions.js";
import { executeQuery, executeQueryBatch } from "../../src/services/query.js";

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
});
