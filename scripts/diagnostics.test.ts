import { describe, expect, test } from "bun:test";
import { normalizeAndValidateArgs, deriveRiskLevel } from "../src/diagnostics/core/guards";
import type { DiagnosticsArgs, DiagnosticsMode } from "../src/diagnostics/core/types";

describe("diagnostics CLI", () => {
  // Note: This tests the CLI argument parsing logic without running the actual commands.
  // The full CLI integration tests would require database access.

  describe("argument validation", () => {
    test("rejects collection mode with cleanup", () => {
      const result = normalizeAndValidateArgs("collection", { cleanup: true });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("cleanup");
    });

    test("rejects collection mode with config-only", () => {
      const result = normalizeAndValidateArgs("collection", { configOnly: true });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("config-only");
    });

    test("rejects collection mode with daily-only", () => {
      const result = normalizeAndValidateArgs("collection", { dailyOnly: true });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("daily-only");
    });

    test("rejects collection mode with weekly-only", () => {
      const result = normalizeAndValidateArgs("collection", { weeklyOnly: true });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("weekly-only");
    });

    test("accepts valid collection mode args", () => {
      const result = normalizeAndValidateArgs("collection", {});
      expect(result.ok).toBe(true);
    });

    test("accepts collection mode with runCollection", () => {
      const result = normalizeAndValidateArgs("collection", { runCollection: true });
      expect(result.ok).toBe(true);
      expect(result.args?.runCollection).toBe(true);
    });

    test("rejects reports mode with config-only and cleanup", () => {
      const result = normalizeAndValidateArgs("reports", { configOnly: true, cleanup: true });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("config-only");
      expect(result.error).toContain("cleanup");
    });

    test("rejects reports mode with config-only and daily-only", () => {
      const result = normalizeAndValidateArgs("reports", { configOnly: true, dailyOnly: true });
      expect(result.ok).toBe(false);
    });

    test("rejects reports mode with config-only and weekly-only", () => {
      const result = normalizeAndValidateArgs("reports", { configOnly: true, weeklyOnly: true });
      expect(result.ok).toBe(false);
    });

    test("rejects reports mode with daily-only and weekly-only", () => {
      const result = normalizeAndValidateArgs("reports", { dailyOnly: true, weeklyOnly: true });
      expect(result.ok).toBe(false);
    });

    test("accepts valid reports mode args", () => {
      const result = normalizeAndValidateArgs("reports", {});
      expect(result.ok).toBe(true);
    });

    test("accepts reports mode with config-only", () => {
      const result = normalizeAndValidateArgs("reports", { configOnly: true });
      expect(result.ok).toBe(true);
      expect(result.args?.configOnly).toBe(true);
    });

    test("accepts reports mode with daily-only", () => {
      const result = normalizeAndValidateArgs("reports", { dailyOnly: true });
      expect(result.ok).toBe(true);
      expect(result.args?.dailyOnly).toBe(true);
    });

    test("accepts reports mode with weekly-only", () => {
      const result = normalizeAndValidateArgs("reports", { weeklyOnly: true });
      expect(result.ok).toBe(true);
      expect(result.args?.weeklyOnly).toBe(true);
    });

    test("accepts reports mode with cleanup", () => {
      const result = normalizeAndValidateArgs("reports", { cleanup: true });
      expect(result.ok).toBe(true);
      expect(result.args?.cleanup).toBe(true);
    });

    test("accepts full mode with cleanup", () => {
      const result = normalizeAndValidateArgs("full", { cleanup: true });
      expect(result.ok).toBe(true);
    });

    test("accepts full mode with runCollection and cleanup", () => {
      const result = normalizeAndValidateArgs("full", { runCollection: true, cleanup: true });
      expect(result.ok).toBe(true);
    });
  });

  describe("risk level derivation", () => {
    test("collection mode without runCollection is read-only", () => {
      expect(deriveRiskLevel("collection", {})).toBe("read-only");
    });

    test("collection mode with runCollection is write", () => {
      expect(deriveRiskLevel("collection", { runCollection: true })).toBe("write");
    });

    test("reports mode with configOnly is read-only", () => {
      expect(deriveRiskLevel("reports", { configOnly: true })).toBe("read-only");
    });

    test("reports mode with dailyOnly is write", () => {
      expect(deriveRiskLevel("reports", { dailyOnly: true })).toBe("write");
    });

    test("reports mode with weeklyOnly is write", () => {
      expect(deriveRiskLevel("reports", { weeklyOnly: true })).toBe("write");
    });

    test("reports mode with cleanup is high-risk-write", () => {
      expect(deriveRiskLevel("reports", { cleanup: true })).toBe("high-risk-write");
    });

    test("full mode is write", () => {
      expect(deriveRiskLevel("full", {})).toBe("write");
    });

    test("full mode with cleanup is high-risk-write", () => {
      expect(deriveRiskLevel("full", { cleanup: true })).toBe("high-risk-write");
    });
  });

  describe("DiagnosticsArgs structure", () => {
    test("args object has correct shape", () => {
      const args: DiagnosticsArgs = {
        mode: "collection",
        runCollection: false,
        configOnly: false,
        dailyOnly: false,
        weeklyOnly: false,
        cleanup: false,
        allowWrite: false,
        confirmProduction: false,
        confirmCleanup: false,
        apiUrl: undefined,
        jsonOutput: undefined,
        verbose: false,
      };

      expect(args.mode).toBe("collection");
      expect(args.runCollection).toBe(false);
    });

    test("mode accepts collection, reports, full", () => {
      const modes: DiagnosticsMode[] = ["collection", "reports", "full"];
      modes.forEach((mode) => {
        const args: DiagnosticsArgs = { mode };
        expect(args.mode).toBe(mode);
      });
    });
  });
});
