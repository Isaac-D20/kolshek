import { describe, it, expect } from "vitest";
import {
  escapeXml,
  shellQuote,
  systemdEscape,
  splitCommandLine,
  validateBinaryPath,
} from "../../src/core/scheduler/escape.js";

describe("escapeXml", () => {
  it("escapes ampersands", () => {
    expect(escapeXml("H&M")).toBe("H&amp;M");
  });

  it("escapes angle brackets", () => {
    expect(escapeXml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeXml("O'Reilly")).toBe("O&apos;Reilly");
  });

  it("handles multiple entities in one string", () => {
    expect(escapeXml('a&b<c>d"e\'f')).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  it("passes through strings with no special chars", () => {
    expect(escapeXml("/usr/local/bin/kolshek")).toBe("/usr/local/bin/kolshek");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});

describe("shellQuote", () => {
  it("wraps simple path in single quotes", () => {
    expect(shellQuote("/usr/bin/kolshek")).toBe("'/usr/bin/kolshek'");
  });

  it("handles spaces in path", () => {
    expect(shellQuote("/home/user/my programs/kolshek")).toBe("'/home/user/my programs/kolshek'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  it("handles dollar signs", () => {
    expect(shellQuote("$HOME/bin")).toBe("'$HOME/bin'");
  });

  it("handles backticks", () => {
    expect(shellQuote("`whoami`")).toBe("'`whoami`'");
  });

  it("handles empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
});

describe("systemdEscape", () => {
  it("wraps simple path in double quotes", () => {
    expect(systemdEscape("/usr/bin/kolshek")).toBe('"/usr/bin/kolshek"');
  });

  it("handles spaces in path", () => {
    expect(systemdEscape("/opt/my app/kolshek")).toBe('"/opt/my app/kolshek"');
  });

  it("escapes embedded backslashes", () => {
    expect(systemdEscape("C:\\Program Files\\kolshek")).toBe('"C:\\\\Program Files\\\\kolshek"');
  });

  it("escapes embedded double quotes", () => {
    expect(systemdEscape('path/"quoted"/bin')).toBe('"path/\\"quoted\\"/bin"');
  });

  it("handles empty string", () => {
    expect(systemdEscape("")).toBe('""');
  });
});

describe("splitCommandLine", () => {
  it("splits unquoted whitespace-separated tokens", () => {
    expect(splitCommandLine("node dist/cli/index.js fetch")).toEqual([
      "node",
      "dist/cli/index.js",
      "fetch",
    ]);
  });

  it("preserves arguments enclosed in double quotes", () => {
    expect(
      splitCommandLine('"C:\\Program Files\\nodejs\\node.exe" "C:\\My App\\dist\\cli\\index.js"')
    ).toEqual([
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\My App\\dist\\cli\\index.js",
    ]);
  });

  it("preserves arguments enclosed in single quotes", () => {
    expect(splitCommandLine("'/usr/local/bin/node' '/opt/kolshek/index.js'")).toEqual([
      "/usr/local/bin/node",
      "/opt/kolshek/index.js",
    ]);
  });

  it("handles a single command without args", () => {
    expect(splitCommandLine("/usr/local/bin/kolshek")).toEqual([
      "/usr/local/bin/kolshek",
    ]);
  });

  it("handles empty string", () => {
    expect(splitCommandLine("")).toEqual([]);
  });
});

describe("validateBinaryPath", () => {
  it("allows valid path and quoted invocations", () => {
    expect(validateBinaryPath("/usr/local/bin/kolshek")).toBe("/usr/local/bin/kolshek");
    expect(
      validateBinaryPath('"C:\\Program Files\\nodejs\\node.exe" "C:\\path\\index.js"')
    ).toBe('"C:\\Program Files\\nodejs\\node.exe" "C:\\path\\index.js"');
  });

  it("throws on missing binaryPath", () => {
    expect(() => validateBinaryPath("")).toThrow("binaryPath is required");
  });

  it("throws on control characters", () => {
    expect(() => validateBinaryPath("/usr/bin/kolshek\nrm -rf /")).toThrow(
      "binaryPath contains control characters"
    );
  });

  it("throws on unsafe shell characters", () => {
    expect(() => validateBinaryPath("kolshek & calc.exe")).toThrow(
      "binaryPath contains unsafe shell characters"
    );
    expect(() => validateBinaryPath("kolshek | tee log")).toThrow(
      "binaryPath contains unsafe shell characters"
    );
    expect(() => validateBinaryPath("kolshek; calc.exe")).not.toThrow();
  });
});
