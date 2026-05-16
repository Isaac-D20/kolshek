/**
 * OS task scheduler — registers/unregisters recurring kolshek fetch tasks.
 *
 * Dispatches to platform-specific backends (Windows Task Scheduler,
 * macOS launchd, Linux systemd/cron).
 */

import { spawn } from "child_process";
import type { ScheduleConfig } from "../../types/index.js";

/** Run a subprocess and return stdout. Throws on non-zero exit. */
export async function run(
  cmd: string[],
  stdin?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0], cmd.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    if (stdin !== undefined) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    proc.on("exit", (exitCode) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");

      if (exitCode !== 0) {
        reject(new Error(`Command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on("error", reject);
  });
}

export interface SchedulerBackend {
  register(config: ScheduleConfig): Promise<void>;
  unregister(): Promise<void>;
  isRegistered(): Promise<boolean>;
}

type Platform = "win32" | "darwin" | "linux";

function getPlatform(): Platform {
  const p = process.platform;
  if (p === "win32" || p === "darwin" || p === "linux") return p;
  throw new Error(`Unsupported platform for scheduling: ${p}`);
}

async function getBackend(): Promise<SchedulerBackend> {
  const platform = getPlatform();
  switch (platform) {
    case "win32": {
      const mod = await import("./windows.js");
      return mod.default;
    }
    case "darwin": {
      const mod = await import("./macos.js");
      return mod.default;
    }
    case "linux": {
      const mod = await import("./linux.js");
      return mod.default;
    }
  }
}

export async function registerSchedule(config: ScheduleConfig): Promise<void> {
  const backend = await getBackend();
  await backend.register(config);
}

export async function unregisterSchedule(): Promise<void> {
  const backend = await getBackend();
  await backend.unregister();
}

export async function checkScheduleRegistered(): Promise<boolean> {
  const backend = await getBackend();
  return backend.isRegistered();
}

export function currentPlatform(): Platform {
  return getPlatform();
}
