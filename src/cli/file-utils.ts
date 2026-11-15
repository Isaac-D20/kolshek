import { promises as fs } from "fs";
import { existsSync } from "fs";
import { spawn, spawnSync } from "child_process";
import type { SpawnSyncReturns, SpawnOptions } from "child_process";

/** Read a file as text. */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

/**
 * Read a file synchronously as text
 */
export function readFileSync(filePath: string): string {
  return require("fs").readFileSync(filePath, "utf-8");
}

/** Check if a file exists. */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/** Write a file. */
export async function writeFile(filePath: string, content: string | Buffer): Promise<void> {
  await fs.writeFile(filePath, content);
}

/**
 * Write a file synchronously
 */
export function writeFileSync(filePath: string, content: string | Buffer): void {
  require("fs").writeFileSync(filePath, content);
}

/** Spawn a child process and resolve when it exits. */
export function spawnAsync(cmd: string[], options?: SpawnOptions & { stdio?: "inherit" | "pipe" }): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0], cmd.slice(1), {
      stdio: options?.stdio || "inherit",
      ...options,
    });

    proc.on("error", reject);
    proc.on("exit", (code) => resolve(code ?? 0));
  });
}

/** Spawn a child process synchronously. */
export function spawnSync_compat(cmd: string[], options?: SpawnOptions): SpawnSyncReturns<Buffer> {
  return spawnSync(cmd[0], cmd.slice(1), {
    stdio: "inherit",
    ...options,
  });
}

/** Read stdin as text. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/** Run a subprocess and capture its output. */
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

