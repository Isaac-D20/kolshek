import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import {
  createProvider,
  getProvider,
  listProviders,
  deleteProvider,
} from "../../src/db/repositories/providers.js";
import { getAccountsByProvider } from "../../src/db/repositories/accounts.js";
import { listTransactions } from "../../src/db/repositories/transactions.js";
import { startDashboard } from "../../src/web/server.js";

describe("Multiple External Deposit Providers", () => {
  let serverInstance: ReturnType<typeof startDashboard>;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    initDatabase(":memory:");
    process.env.KOLSHEK_DISABLE_AUTH = "1";
    serverInstance = startDashboard(0);
    await new Promise((resolve) => {
      if (serverInstance.server.listening) resolve(null);
      else serverInstance.server.on("listening", resolve);
    });
    const address = serverInstance.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://localhost:${port}`;
    token = serverInstance.token;
  });

  afterAll(async () => {
    serverInstance.server.close();
    closeDatabase();
  });

  it("creates multiple external deposit providers via API without overwriting data", async () => {
    // 1. Create first external deposit provider
    const res1 = await fetch(`${baseUrl}/api/v2/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: "external_deposit",
        displayName: "External Deposit",
        credentials: { amount: "5000", date: "2025-01-10" },
      }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    const p1 = data1.data;
    expect(p1.id).toBeDefined();
    expect(p1.accounts).toHaveLength(1);
    expect(p1.accounts[0].balance).toBe(5000);
    expect(p1.accounts[0].accountNumber).toBe(`external-${p1.id}`);

    // 2. Create second external deposit provider
    const res2 = await fetch(`${baseUrl}/api/v2/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: "external_deposit",
        displayName: "External Deposit",
        credentials: { amount: "12000", date: "2025-02-15" },
      }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    const p2 = data2.data;
    expect(p2.id).toBeDefined();
    expect(p2.id).not.toBe(p1.id);
    expect(p2.alias).toBe("External Deposit 2");
    expect(p2.accounts).toHaveLength(1);
    expect(p2.accounts[0].balance).toBe(12000);
    expect(p2.accounts[0].accountNumber).toBe(`external-${p2.id}`);

    // 3. Verify provider 1 data was NOT overwritten
    const p1Accounts = getAccountsByProvider(p1.id);
    expect(p1Accounts).toHaveLength(1);
    expect(p1Accounts[0].balance).toBe(5000);
    expect(p1Accounts[0].accountNumber).toBe(`external-${p1.id}`);

    const p2Accounts = getAccountsByProvider(p2.id);
    expect(p2Accounts).toHaveLength(1);
    expect(p2Accounts[0].balance).toBe(12000);
    expect(p2Accounts[0].accountNumber).toBe(`external-${p2.id}`);

    // Verify transactions are separate
    const txs1 = listTransactions({ account: p1Accounts[0].accountNumber });
    expect(txs1).toHaveLength(1);
    expect(txs1[0].chargedAmount).toBe(5000);

    const txs2 = listTransactions({ account: p2Accounts[0].accountNumber });
    expect(txs2).toHaveLength(1);
    expect(txs2[0].chargedAmount).toBe(12000);

    // 4. Update second provider auth (amount and date)
    const updateRes = await fetch(`${baseUrl}/api/v2/providers/${p2.id}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: { amount: "15000", date: "2025-03-01" },
      }),
    });
    expect(updateRes.status).toBe(200);
    const updatedData = await updateRes.json();
    expect(updatedData.success).toBe(true);

    // Check that p2 account has new balance and exactly 1 transaction
    const p2UpdatedAccounts = getAccountsByProvider(p2.id);
    expect(p2UpdatedAccounts[0].balance).toBe(15000);
    const p2UpdatedTxs = listTransactions({ account: p2Accounts[0].accountNumber });
    expect(p2UpdatedTxs).toHaveLength(1);
    expect(p2UpdatedTxs[0].chargedAmount).toBe(15000);

    // Check that p1 is still completely unchanged
    const p1FinalAccounts = getAccountsByProvider(p1.id);
    expect(p1FinalAccounts[0].balance).toBe(5000);
    const p1FinalTxs = listTransactions({ account: p1Accounts[0].accountNumber });
    expect(p1FinalTxs).toHaveLength(1);
    expect(p1FinalTxs[0].chargedAmount).toBe(5000);

    // 5. Test GET /api/v2/providers returns both providers with accurate account and transaction counts
    const listRes = await fetch(`${baseUrl}/api/v2/providers`);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const externalProviders = listData.data.filter(
      (p: any) => p.companyId === "external_deposit"
    );
    expect(externalProviders).toHaveLength(2);
    expect(externalProviders.find((p: any) => p.id === p1.id)?.accountCount).toBe(1);
    expect(externalProviders.find((p: any) => p.id === p1.id)?.transactionCount).toBe(1);
    expect(externalProviders.find((p: any) => p.id === p2.id)?.accountCount).toBe(1);
    expect(externalProviders.find((p: any) => p.id === p2.id)?.transactionCount).toBe(1);

    // 6. Create third external deposit provider with custom alias
    const res3 = await fetch(`${baseUrl}/api/v2/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: "external_deposit",
        displayName: "External Deposit",
        alias: "Rental Income Deposit",
        credentials: { amount: "7500", date: "2025-04-01" },
      }),
    });
    expect(res3.status).toBe(200);
    const data3 = await res3.json();
    expect(data3.data.alias).toBe("Rental Income Deposit");
    expect(data3.data.accounts[0].balance).toBe(7500);

    // 7. Delete provider 2 and verify provider 1 and 3 are intact
    const delRes = await fetch(`${baseUrl}/api/v2/providers/${p2.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    expect(getProvider(p2.id)).toBeNull();
    expect(getAccountsByProvider(p2.id)).toHaveLength(0);

    const p1Remaining = getAccountsByProvider(p1.id);
    expect(p1Remaining).toHaveLength(1);
    expect(p1Remaining[0].balance).toBe(5000);

    const p3Remaining = getAccountsByProvider(data3.data.id);
    expect(p3Remaining).toHaveLength(1);
    expect(p3Remaining[0].balance).toBe(7500);
  });
});
