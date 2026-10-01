// Shared schedule config I/O — used by both CLI commands and web server.
// Reads/writes {dataDir}/schedule.json alongside the OS task scheduler.

import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { readFile, writeFile, fileExists } from "../cli/file-utils.js";
import type { ScheduleConfig } from "../types/index.js";
import { getAppPaths } from "./loader.js";
import { run } from "../core/scheduler/index.js";

export function scheduleJsonPath(): string {
  const paths = getAppPaths();
  return join(paths.data, "schedule.json");
}

export function scheduleLogPath(): string {
  const paths = getAppPaths();
  return join(paths.data, "schedule.log");
}

export async function readScheduleConfig(): Promise<ScheduleConfig | null> {
  if (!fileExists(scheduleJsonPath())) return null;
  try {
    const text = await readFile(scheduleJsonPath());
    return JSON.parse(text) as ScheduleConfig;
  } catch {
    return null;
  }
}

export async function writeScheduleConfig(config: ScheduleConfig): Promise<void> {
  await writeFile(scheduleJsonPath(), JSON.stringify(config, null, 2));
}

export async function deleteScheduleConfig(): Promise<void> {
  try {
    await unlink(scheduleJsonPath());
  } catch { /* ignore if not exists */ }
}

// Validate interval string like "6h" → number of hours (1–168), or null
export function parseInterval(value: string): number | null {
  const match = value.match(/^(\d+)h$/i);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  if (hours < 1 || hours > 168) return null;
  return hours;
}

// Resolve the kolshek binary path or invocation for OS scheduler registration
export async function resolveBinaryPath(): Promise<string> {
  // If running as a standalone compiled binary (not node / bun / etc.)
  const execBase = basename(process.execPath).toLowerCase().replace(/\.exe$/, "");
  if (execBase === "kolshek") {
    return process.execPath;
  }

  // Try which/where to find installed binary
  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    const out = await run([whichCmd, "kolshek"]);
    const firstLine = out.trim().split("\n")[0].trim();
    if (firstLine && existsSync(firstLine)) {
      return firstLine;
    }
  } catch { /* not found */ }

  // Determine project root directory relative to this file
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDir, "..", "..");

  const distCli = join(projectRoot, "dist", "cli", "index.js");
  if (existsSync(distCli)) {
    return `"${process.execPath}" "${distCli}"`;
  }

  const srcCli = join(projectRoot, "src", "cli", "index.ts");
  if (existsSync(srcCli)) {
    const tsxDistCli = join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(tsxDistCli)) {
      return `"${process.execPath}" "${tsxDistCli}" "${srcCli}"`;
    }
    const tsxBin = join(
      projectRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "tsx.cmd" : "tsx"
    );
    if (existsSync(tsxBin)) {
      return `"${tsxBin}" "${srcCli}"`;
    }
    return `"${process.execPath}" "${srcCli}"`;
  }

  // Fallback to script path if available
  const scriptPath = process.argv[1];
  if (scriptPath && existsSync(scriptPath)) {
    return `"${process.execPath}" "${scriptPath}"`;
  }

  return process.execPath;
}
