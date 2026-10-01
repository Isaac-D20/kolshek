import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseInterval, scheduleLogPath, scheduleJsonPath, resolveBinaryPath } from "../../src/config/schedule.js";

describe("schedule config utils", () => {
  describe("parseInterval", () => {
    it("parses valid hour strings", () => {
      expect(parseInterval("1h")).toBe(1);
      expect(parseInterval("6h")).toBe(6);
      expect(parseInterval("24h")).toBe(24);
      expect(parseInterval("168h")).toBe(168);
    });

    it("rejects invalid format or out-of-range hours", () => {
      expect(parseInterval("0h")).toBeNull();
      expect(parseInterval("169h")).toBeNull();
      expect(parseInterval("6")).toBeNull();
      expect(parseInterval("invalid")).toBeNull();
      expect(parseInterval("1.5h")).toBeNull();
    });
  });

  describe("schedule paths", () => {
    it("returns paths in the user data directory", () => {
      expect(scheduleJsonPath()).toContain("schedule.json");
      expect(scheduleLogPath()).toContain("schedule.log");
    });
  });

  describe("resolveBinaryPath", () => {
    it("resolves an executable invocation containing node or kolshek", async () => {
      const binaryPath = await resolveBinaryPath();
      expect(binaryPath).toBeDefined();
      expect(typeof binaryPath).toBe("string");
      expect(binaryPath.length).toBeGreaterThan(0);
      expect(binaryPath).toMatch(/(node|kolshek|tsx)/i);
    });
  });
});
