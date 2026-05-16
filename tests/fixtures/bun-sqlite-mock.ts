/**
 * Compatibility shim: wraps better-sqlite3 Database API to support $-prefixed parameter binding.
 * This enables code written for Bun's sqlite API to work under Node.js with better-sqlite3.
 *
 * Key feature: converts $-prefixed keys in param objects (e.g. { $name: "x" })
 * to unprefixed keys expected by better-sqlite3 (e.g. { name: "x" }).
 */
import BetterSqlite3 from "better-sqlite3";

/** Strip $ prefix from parameter object keys for better-sqlite3 compatibility. */
function stripDollarPrefix(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const stripped = key.startsWith("$") ? key.slice(1) : key;
    result[stripped] = value;
  }
  return result;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(path: string, _options?: { create?: boolean }) {
    this.db = new BetterSqlite3(path === ":memory:" ? ":memory:" : path);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      get: (params?: Record<string, unknown>) =>
        params && Object.keys(params).length > 0
          ? stmt.get(stripDollarPrefix(params))
          : stmt.get(),
      all: (params?: Record<string, unknown>) =>
        params && Object.keys(params).length > 0
          ? stmt.all(stripDollarPrefix(params))
          : stmt.all(),
      run: (params?: Record<string, unknown>) =>
        params && Object.keys(params).length > 0
          ? stmt.run(stripDollarPrefix(params))
          : stmt.run(),
    };
  }

  close(): void {
    this.db.close();
  }
}
