// Dashboard HTTP server — Express with URL routing.
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { WEB_FILES } from "./web-files.js";
import {
  listProviders,
} from "../db/repositories/providers.js";
import {
  listCategoryRules, applyCategoryRules,
} from "../db/repositories/categories.js";
import {
  listTranslationRules, listUntranslatedGrouped,
} from "../db/repositories/translations.js";
import { getMonthlyReport } from "../db/repositories/reports.js";
import { listBudgets, setBudget } from "../db/repositories/budgets.js";


export function startDashboard(port: number) {
  const app = express();
  const sessionToken = randomBytes(32).toString("hex");
  const cookieName = "kolshek_session";

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Auth Middleware
  app.use((req, res, next) => {
    if (req.query.token === sessionToken || req.cookies[cookieName] === sessionToken) {
      if (req.query.token) res.cookie(cookieName, sessionToken, { httpOnly: true, sameSite: 'strict' });
      return next();
    }
    if (req.path.startsWith("/api/")) return res.status(401).json({ success: false });
    res.status(401).send("Unauthorized");
  });

   // Asset Routes
   app.get(["/favicon.png", "/logo.png"], (_req, res) => {
    const asset = WEB_FILES[_req.path];
    if (!asset) return res.status(404).end();
    res.setHeader("Content-Type", asset.mime).send(asset.binary ? Buffer.from(asset.content, "base64") : asset.content);
  });

  // --- API Routes ---
  app.get("/api/v2/providers", (_req, res) => {
    const data = listProviders().map(p => ({ ...p, hasCredentials: true })); // Simplified for brevity
    res.json({ success: true, data });
  });

  // Category & Translation Rules (The Missing Pieces)
  app.get("/api/v2/categories/rules", (_req, res) => res.json({ success: true, data: listCategoryRules() }));
  app.post("/api/v2/categories/rules/apply", (_req, res) => res.json({ success: true, data: applyCategoryRules() }));

  app.get("/api/v2/translations/rules", (_req, res) => res.json({ success: true, data: listTranslationRules() }));
  app.get("/api/v2/translations/untranslated", (_req, res) => res.json({ success: true, data: listUntranslatedGrouped() }));

  // Budgets
  app.get("/api/v2/budgets", (_req, res) => res.json({ success: true, data: listBudgets() }));
  app.post("/api/v2/budgets", (req, res) => {
    setBudget(req.body.category, req.body.amount, req.body.period);
    res.json({ success: true });
  });

  // Reports, Spending, Trends... (Mapping existing functions)
  app.get("/api/v2/reports/monthly", (_req, res) => res.json({ success: true, data: getMonthlyReport({}) }));

  // SPA Fallback
  app.get("*", (_req, res) => {
    res.setHeader("Content-Type", "text/html").send(WEB_FILES["/index.html"].content);
  });

  const server = app.listen(port, "0.0.0.0");
  return { server, token: sessionToken };
}
