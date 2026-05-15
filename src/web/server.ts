// Dashboard HTTP server — Express with URL routing.
// JSON API v2 routes for the React SPA dashboard.
// Authentication: single-use token in URL → HttpOnly session cookie.

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { WEB_FILES } from "./web-files.js";
import {
  listProviders,
  createProvider,
  deleteProvider,
  getProvider,
  resolveProviders,
  getProviderByAlias,
} from "../db/repositories/providers.js";
import {
  hasCredentials,
  storeCredentials,
  deleteCredentials,
} from "../security/keychain.js";
import {
  PROVIDERS,
  isValidCompanyId,
  type CompanyId,
} from "../types/provider.js";
import {
  countTransactions,
  listTransactions,
  searchTransactions,
  updateTransactionCategory,
} from "../db/repositories/transactions.js";
import {
  getAccountsByProvider,
  getAccount,
  updateAccountExcluded,
  purgeAccountData,
  upsertAccount,
} from "../db/repositories/accounts.js";
import {
  getLatestCompletedSyncLog,
  hasSuccessfulSync,
  listRecentSyncLogs,
  countSyncLogsSince,
} from "../db/repositories/sync-log.js";
import {
  readScheduleConfig,
  writeScheduleConfig,
  deleteScheduleConfig,
  resolveBinaryPath,
} from "../config/schedule.js";
import {
  registerSchedule,
  unregisterSchedule,
  checkScheduleRegistered,
  currentPlatform,
} from "../core/scheduler/index.js";
import { computeAuthStatus } from "../core/auth-status.js";
import {
  listCategoryRules,
  createCategoryRule,
  deleteCategoryRule,
  applyCategoryRules,
  createCategory,
  deleteCategory,
  renameCategory,
  listAllCategories,
  updateCategoryClassification,
  getClassificationMap,
  ensureCategoryWithClassification,
} from "../db/repositories/categories.js";
import {
  DEFAULT_SPENDING_EXCLUDES,
  DEFAULT_INCOME_EXCLUDES,
  DEFAULT_REPORT_EXCLUDES,
  BUILTIN_CLASSIFICATIONS,
  isValidClassification,
} from "../types/classification.js";
import {
  listTranslationRules,
  createTranslationRule,
  deleteTranslationRule,
  applyTranslationRules,
  translateByDescription,
  listUntranslatedGrouped,
  listTranslatedGrouped,
} from "../db/repositories/translations.js";
import {
  getMonthlyReport,
  getCategoryReport,
  getBalanceReport,
} from "../db/repositories/reports.js";
import { getSpending } from "../services/spending.js";
import { getIncome } from "../services/income.js";
import {
  getTotalTrendData,
  getCategoryTrendData,
  getFixedVariableTrendData,
} from "../services/trends.js";
import { getInsights } from "../services/insights.js";
import { syncProviders } from "../services/sync.js";
import { transactionHash } from "../core/sync-engine.js";
import { validateCsvImport, buildTransactionInput } from "../core/csv-import.js";
import { upsertTransaction } from "../db/repositories/transactions.js";
import { getDatabase } from "../db/database.js";
import type { RuleConditions } from "../types/category-rule.js";
import type { TransactionFilters } from "../types/transaction.js";
import {
  listCustomPages,
  getCustomPage,
  createCustomPage,
  updateCustomPage,
  deleteCustomPage,
  reorderCustomPages,
} from "../db/repositories/custom-pages.js";
import {
  listBudgets,
  setBudget,
  deleteBudget,
} from "../db/repositories/budgets.js";
import { validatePage } from "../core/page-schema.js";
import { querySchema } from "../core/page-schema.js";
import { executeQueryBatch } from "../services/query.js";
import type { AddressInfo } from "node:net";

// SSE listeners for custom page changes (create/update/delete notifications)
const pageEventListeners = new Set<(event: string) => void>();

function notifyPageChange(type: "page_changed" | "page_deleted", id: string): void {
  const data = JSON.stringify({ type, id });
  for (const listener of pageEventListeners) {
    try { listener(data); } catch { /* ignore closed streams */ }
  }
}

// Track active fetch so we don't allow concurrent syncs
let activeFetch: { promise: Promise<void>; events: string[]; listeners: Set<(event: string) => void>; abort: AbortController } | null = null;

// SPA assets cache headers
const CACHE_CONTROL = "public, max-age=86400";

// --- JSON API helpers ---

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
};

// MAX_PAGINATION_LIMIT prevents dumping entire DB via ?limit=999999999
const MAX_PAGINATION_LIMIT = 500;

// Validate that a user-supplied regex isn't pathologically complex (ReDoS)
function isSafeRegex(pattern: string): boolean {
  if (pattern.length > 200) return false;
  if (/(\+|\*|\{)\)?(\+|\*|\{)/.test(pattern)) return false;
  if ((pattern.match(/\|/g) || []).length > 20) return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

// Sanitize error messages — strip file paths and internal details
function sanitizeError(msg: string): string {
  return msg.replace(/[A-Z]:\\[^\s:]+/gi, "[path]")
    .replace(/\/[^\s:]*\/[^\s:]*/g, "[path]")
    .replace(/at\s+.+\(.+\)/g, "")
    .trim();
}

// Parse ?exclude= and ?include= query params for classification filtering.
function resolveExcludedClassifications(
  query: any,
  defaultExclusions: readonly string[],
): readonly string[] {
  const excludeParam = query.exclude;
  const includeParam = query.include;

  if (excludeParam !== undefined) {
    if (excludeParam === "") return [];
    return String(excludeParam).split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (includeParam !== undefined) {
    if (includeParam === "") return defaultExclusions;
    const included = new Set(String(includeParam).split(",").map((s) => s.trim()).filter(Boolean));
    return BUILTIN_CLASSIFICATIONS.filter((c) => !included.has(c));
  }

  return defaultExclusions;
}

export function startDashboard(port: number): { server: any; token: string } {
  const app = express();

  // Generate a one-time session token
  const sessionToken = randomBytes(32).toString("hex");
  const cookieName = "kolshek_session";

  // Configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow localhost and Vite dev server
      if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        callback(null, true);
      } else {
        callback(null, true); 
      }
    },
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json());

  // Set security headers on all responses
  app.use((req, res, next) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(key, value);
    }
    next();
  });

  // --- Authentication ---

  // POST /api/v2/auth/token — exchange a token for a session cookie.
  app.post("/api/v2/auth/token", (req, res) => {
    const token = req.body.token;
    if (token !== sessionToken) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid token." } });
    }
    res.setHeader("Set-Cookie", `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.json({ success: true, data: null });
  });

  // Authentication Middleware
  app.use((req, res, next) => {
    // Check for token in query param (initial browser open)
    const urlToken = req.query.token;
    if (urlToken === sessionToken) {
      res.setHeader("Set-Cookie", `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
      // Redirect to clean URL
      const url = new URL(req.url, `http://${req.headers.host}`);
      url.searchParams.delete("token");
      return res.redirect(url.pathname + url.search);
    }

    // Check cookie
    if (req.cookies[cookieName] === sessionToken) {
      return next();
    }

    // Unauthenticated
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Session expired. Relaunch the dashboard." } });
    }
    res.status(401).send("Session expired or unauthorized. Relaunch the dashboard to get a new URL.");
  });

  // CSRF protection: block cross-origin mutations
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.origin;
      if (!origin || (!origin.includes("localhost") && !origin.includes("127.0.0.1"))) {
        return res.status(403).send("Forbidden: cross-origin request");
      }
    }
    next();
  });

  // --- Static Assets ---
  app.get(["/favicon.png", "/favicon.ico", "/logo.png"], (req, res) => {
    const key = req.path === "/favicon.ico" ? "/favicon.png" : req.path;
    const asset = WEB_FILES[key];
    if (!asset) return res.status(404).end();
    const body = asset.binary ? Buffer.from(asset.content, "base64") : asset.content;
    res.setHeader("Content-Type", asset.mime);
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.send(body);
  });

  // --- API Routes ---

  // Providers
  app.get("/api/v2/providers", async (req, res) => {
    try {
      const providers = listProviders();
      const data = await Promise.all(
        providers.map(async (p) => {
          const hasCreds = await hasCredentials(p.alias);
          const accounts = getAccountsByProvider(p.id);
          const txCount = countTransactions({ providerId: p.id });
          const latestSync = getLatestCompletedSyncLog(p.id);
          const everSucceeded = hasSuccessfulSync(p.id);
          const authStatus = computeAuthStatus(
            hasCreds,
            (latestSync?.status as "success" | "error") ?? null,
            everSucceeded,
          );
          return {
            ...p,
            hasCredentials: hasCreds,
            authStatus,
            accountCount: accounts.length,
            accounts: accounts.map((a) => ({
              id: a.id,
              accountNumber: a.accountNumber,
              displayName: a.displayName,
              balance: a.balance,
              currency: a.currency,
              excluded: a.excluded,
            })),
            transactionCount: txCount,
          };
        }),
      );
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "PROVIDERS_LIST_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.post("/api/v2/providers", async (req, res) => {
    try {
      const { companyId, alias, credentials } = req.body;
      if (!isValidCompanyId(companyId)) return res.status(400).json({ success: false, error: { code: "INVALID_COMPANY_ID", message: "Invalid provider type." } });
      if (!/^[a-zA-Z0-9_-]+$/.test(alias || companyId)) return res.status(400).json({ success: false, error: { code: "INVALID_ALIAS", message: "Invalid alias." } });

      const info = PROVIDERS[companyId as CompanyId];
      if (credentials) {
        await storeCredentials(alias || companyId, credentials);
      }
      const provider = createProvider(companyId, info.displayName, info.type, alias || companyId);
      res.status(201).json({ success: true, data: provider });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "PROVIDER_CREATE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.delete("/api/v2/providers/:id", async (req, res) => {
    try {
      const provider = getProvider(Number(req.params.id));
      if (!provider) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found." } });
      await deleteCredentials(provider.alias);
      deleteProvider(provider.id);
      res.json({ success: true, data: { deleted: true, id: provider.id } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "PROVIDER_DELETE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.post("/api/v2/providers/:id/auth", async (req, res) => {
    try {
      const provider = getProvider(Number(req.params.id));
      if (!provider) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Provider not found." } });

      const info = PROVIDERS[provider.companyId as CompanyId];
      if (!info) return res.status(400).json({ success: false, error: { code: "UNKNOWN_TYPE", message: "Unknown provider type." } });

      const { credentials } = req.body;
      if (!credentials) return res.status(400).json({ success: false, error: { code: "MISSING_CREDENTIALS", message: "Credentials object is required." } });

      for (const field of info.loginFields) {
        if (field !== "otpLongTermToken" && !credentials[field]) {
          return res.status(400).json({ success: false, error: { code: "MISSING_FIELD", message: `Missing required field: ${field}` } });
        }
      }

      await storeCredentials(provider.alias, credentials);
      res.json({ success: true, data: { updated: true } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "AUTH_UPDATE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.get("/api/v2/providers/fields/:companyId", (req, res) => {
    const { companyId } = req.params;
    if (!isValidCompanyId(companyId)) return res.status(400).json({ success: false, error: { code: "INVALID_COMPANY_ID", message: "Unknown provider type." } });
    const info = PROVIDERS[companyId as CompanyId];
    res.json({ success: true, data: { companyId, displayName: info.displayName, type: info.type, loginFields: info.loginFields } });
  });

  // Accounts
  app.get("/api/v2/accounts/balance", (req, res) => {
    try {
      res.json({ success: true, data: getBalanceReport() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "BALANCE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.patch("/api/v2/accounts/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const account = getAccount(id);
      if (!account) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Account ${id} not found` } });
      const { excluded } = req.body;
      if (typeof excluded !== "boolean") return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Body must include { excluded: boolean }" } });
      updateAccountExcluded(id, excluded);
      res.json({ success: true, data: { ...account, excluded } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "ACCOUNT_UPDATE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.delete("/api/v2/accounts/:id/data", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const account = getAccount(id);
      if (!account) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Account ${id} not found` } });
      const result = purgeAccountData(id);
      res.json({ success: true, data: { id, transactionsDeleted: result.transactionsDeleted } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "PURGE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  // Transactions
  app.get("/api/v2/transactions", (req, res) => {
    try {
      const query = req.query;
      const searchQuery = (query.search as string) ?? "";
      const filters: TransactionFilters = {};
      if (query.from) filters.from = query.from as string;
      if (query.to) filters.to = query.to as string;
      if (query.provider) filters.providerId = Number(query.provider);
      if (query.category) {
        const cat = query.category as string;
        filters.category = cat === "Uncategorized" ? null : cat;
      }
      if (query.status) filters.status = query.status as TransactionFilters["status"];
      if (query.minAmount) filters.minAmount = Number(query.minAmount);
      if (query.maxAmount) filters.maxAmount = Number(query.maxAmount);
      filters.limit = Math.min(Number(query.limit) || 50, MAX_PAGINATION_LIMIT);
      filters.offset = Number(query.offset) || 0;

      const data = searchQuery ? searchTransactions(searchQuery, filters) : listTransactions(filters);
      const total = countTransactions(filters);
      res.json({ success: true, data: { transactions: data, total } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "TRANSACTIONS_LIST_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.patch("/api/v2/transactions/:id/category", (req, res) => {
    try {
      const txId = Number(req.params.id);
      const { category: rawCategory } = req.body;
      const category = rawCategory === null ? null : String(rawCategory || "");
      if (rawCategory === undefined || category === "") {
        return res.status(400).json({ success: false, error: { code: "MISSING_CATEGORY", message: "Category is required." } });
      }
      const updated = updateTransactionCategory(txId, category);
      if (!updated) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Transaction not found." } });
      if (category) ensureCategoryWithClassification(category);
      res.json({ success: true, data: { updated: true, id: txId, category } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "TX_CATEGORY_UPDATE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  // Reports
  app.get("/api/v2/reports/monthly", (req, res) => {
    try {
      const from = (req.query.from as string) ?? undefined;
      const to = (req.query.to as string) ?? undefined;
      const excl = resolveExcludedClassifications(req.query, DEFAULT_REPORT_EXCLUDES);
      res.json({ success: true, data: getMonthlyReport({ from, to }, undefined, excl) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "MONTHLY_REPORT_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.get("/api/v2/reports/categories", (req, res) => {
    try {
      const from = (req.query.from as string) ?? undefined;
      const to = (req.query.to as string) ?? undefined;
      const excl = resolveExcludedClassifications(req.query, DEFAULT_REPORT_EXCLUDES);
      res.json({ success: true, data: getCategoryReport({ from, to }, undefined, excl) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "CATEGORY_REPORT_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.get("/api/v2/reports/balance", (req, res) => {
    try {
      const excl = resolveExcludedClassifications(req.query, DEFAULT_REPORT_EXCLUDES);
      res.json({ success: true, data: getBalanceReport(excl) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "BALANCE_REPORT_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  // Spending & Income
  app.get("/api/v2/spending", (req, res) => {
    try {
      const month = (req.query.month as string) ?? undefined;
      const groupBy = (req.query.groupBy as any) ?? "category";
      const excl = resolveExcludedClassifications(req.query, DEFAULT_SPENDING_EXCLUDES);
      res.json({ success: true, data: getSpending({ month, groupBy, excludeClassifications: excl }) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SPENDING_REPORT_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.get("/api/v2/income", (req, res) => {
    try {
      const month = (req.query.month as string) ?? undefined;
      const excl = resolveExcludedClassifications(req.query, DEFAULT_INCOME_EXCLUDES);
      res.json({ success: true, data: getIncome({ month, excludeClassifications: excl }) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "INCOME_REPORT_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  // Trends & Insights
  app.get("/api/v2/trends/total", (req, res) => {
    try {
      const months = Number(req.query.months ?? "6");
      const excl = resolveExcludedClassifications(req.query, DEFAULT_REPORT_EXCLUDES);
      res.json({ success: true, data: getTotalTrendData({ months, excludeClassifications: excl }) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "TRENDS_TOTAL_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.get("/api/v2/trends/category", (req, res) => {
    try {
      const category = (req.query.category as string) ?? "";
      if (!category) return res.status(400).json({ success: false, error: { code: "MISSING_CATEGORY", message: "category is required." } });
      const months = Number(req.query.months ?? "6");
      const excl = resolveExcludedClassifications(req.query, DEFAULT_REPORT_EXCLUDES);
      res.json({ success: true, data: getCategoryTrendData(category, { months, excludeClassifications: excl }) });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "TRENDS_CATEGORY_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  app.get("/api/v2/insights", (req, res) => {
    try {
      res.json({ success: true, data: getInsights() });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "INSIGHTS_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  // Categories
  app.get("/api/v2/categories/all", (req, res) => {
    res.json({ success: true, data: listAllCategories() });
  });

  app.post("/api/v2/categories", (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ success: false, error: { code: "MISSING_NAME", message: "Name required." } });
      const created = createCategory(name);
      if (!created) return res.status(409).json({ success: false, error: { code: "ALREADY_EXISTS", message: "Exists." } });
      res.status(201).json({ success: true, data: { created: true, name } });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "CATEGORY_CREATE_FAILED", message: sanitizeError(String(err)) } });
    }
  });

  // Custom Pages
  app.get("/api/v2/pages", (req, res) => {
    res.json({ success: true, data: listCustomPages() });
  });

  app.get("/api/v2/pages/:id", (req, res) => {
    const page = getCustomPage(req.params.id);
    if (!page) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Page not found" } });
    res.json({ success: true, data: page });
  });

  // SSE: Page Events
  app.get("/api/v2/pages/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const listener = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };
    pageEventListeners.add(listener);
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    req.on("close", () => {
      pageEventListeners.delete(listener);
    });
  });

  // SSE: Fetch/Sync
  app.get("/api/v2/fetch/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!activeFetch) {
      res.write(`data: ${JSON.stringify({ type: "idle" })}\n\n`);
      return res.end();
    }

    const { events, listeners } = activeFetch;
    const listener = (data: string) => {
      res.write(`data: ${data}\n\n`);
      const parsed = JSON.parse(data);
      if (parsed.type === "done" || parsed.type === "error") {
        res.end();
      }
    };

    listeners.add(listener);
    for (const evt of events) {
      res.write(`data: ${evt}\n\n`);
    }

    req.on("close", () => {
      listeners.delete(listener);
    });
  });

  app.post("/api/v2/fetch", (req, res) => {
    if (activeFetch) return res.status(409).json({ success: false, error: { code: "ALREADY_RUNNING", message: "A sync is already in progress." } });

    const { visible, providers: providerIds } = req.body;
    const allProviders = listProviders();
    const providers = providerIds
      ? allProviders.filter((p) => providerIds.includes(p.id))
      : allProviders;

    if (providers.length === 0) return res.status(400).json({ success: false, error: { code: "NO_PROVIDERS", message: "No providers." } });

    const events: string[] = [];
    const listeners: Set<(data: string) => void> = new Set();
    const abortController = new AbortController();

    const pushEvent = (data: string) => {
      events.push(data);
      for (const l of listeners) l(data);
    };

    const fetchPromise = syncProviders(providers, {
      visible,
      signal: abortController.signal,
      onProgress: (alias, stage) => pushEvent(JSON.stringify({ type: "progress", provider: alias, stage })),
    }).then((result) => {
      for (const r of result.results) {
        pushEvent(JSON.stringify({ type: "result", provider: r.alias, success: r.success, added: r.transactionsAdded, updated: r.transactionsUpdated, error: r.error ? sanitizeError(r.error) : undefined }));
      }
      pushEvent(JSON.stringify({ type: "done", success: !result.hasErrors, totalAdded: result.totalAdded, totalUpdated: result.totalUpdated }));
    }).catch((err) => {
      pushEvent(JSON.stringify({ type: "error", message: sanitizeError(String(err)) }));
    }).finally(() => {
      activeFetch = null;
    });

    activeFetch = { promise: fetchPromise, events, listeners, abort: abortController };
    pushEvent(JSON.stringify({ type: "start", providers: providers.map(p => p.alias), visible }));

    res.json({ success: true, data: { started: true } });
  });

  // SPA Fallback
  app.get("*", (req, res) => {
    const asset = WEB_FILES["/index.html"];
    if (!asset) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "text/html");
    res.send(asset.content);
  });

  const server = app.listen(port, "127.0.0.1");

  return { server, token: sessionToken };
}
