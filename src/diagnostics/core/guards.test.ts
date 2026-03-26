import { describe, expect, test } from "bun:test";
import {
  inferEnvFromDatabaseUrl,
  redactDatabaseHost,
  normalizeAndValidateArgs,
  deriveRiskLevel,
  shouldBlockDueToEnvMismatch,
  type DiagnosticsMode,
} from "./guards";

describe("inferEnvFromDatabaseUrl", () => {
  test("returns test for URLs containing 'test'", () => {
    expect(inferEnvFromDatabaseUrl("postgresql://localhost/testdb")).toBe("test");
    expect(inferEnvFromDatabaseUrl("postgresql://user:pass@host:5432/test_db")).toBe("test");
  });

  test("returns production for URLs containing 'prod'", () => {
    expect(inferEnvFromDatabaseUrl("postgresql://localhost/proddb")).toBe("production");
    expect(inferEnvFromDatabaseUrl("postgresql://user:pass@host:5432/prod_db")).toBe("production");
  });

  test("returns unknown when cannot determine", () => {
    expect(inferEnvFromDatabaseUrl("postgresql://localhost/mydb")).toBe("unknown");
    expect(inferEnvFromDatabaseUrl("postgresql://user:pass@host:5432/database")).toBe("unknown");
  });
});

describe("redactDatabaseHost", () => {
  test("redacts password and port details", () => {
    const redacted = redactDatabaseHost("postgresql://user:secretpass@host.example.com:5432/mydb");
    expect(redacted).not.toContain("secretpass");
    expect(redacted).not.toContain("5432");
    expect(redacted).toContain("host.example.com");
    expect(redacted).toContain("mydb");
  });

  test("handles URLs without password", () => {
    const redacted = redactDatabaseHost("postgresql://localhost/mydb");
    expect(redacted).toBe("postgresql://localhost/mydb");
  });
});

describe("normalizeAndValidateArgs", () => {
  test("rejects collection with --cleanup", () => {
    const result = normalizeAndValidateArgs("collection", { cleanup: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cleanup");
  });

  test("rejects reports --config-only --cleanup", () => {
    const result = normalizeAndValidateArgs("reports", { configOnly: true, cleanup: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("config-only");
    expect(result.error).toContain("cleanup");
  });

  test("rejects reports --config-only --daily-only", () => {
    const result = normalizeAndValidateArgs("reports", { configOnly: true, dailyOnly: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("config-only");
    expect(result.error).toContain("daily-only");
  });

  test("rejects reports --config-only --weekly-only", () => {
    const result = normalizeAndValidateArgs("reports", { configOnly: true, weeklyOnly: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("config-only");
    expect(result.error).toContain("weekly-only");
  });

  test("rejects reports --daily-only --weekly-only", () => {
    const result = normalizeAndValidateArgs("reports", { dailyOnly: true, weeklyOnly: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("daily-only");
    expect(result.error).toContain("weekly-only");
  });

  test("accepts valid collection args", () => {
    const result = normalizeAndValidateArgs("collection", {});
    expect(result.ok).toBe(true);
  });

  test("accepts valid reports --config-only args", () => {
    const result = normalizeAndValidateArgs("reports", { configOnly: true });
    expect(result.ok).toBe(true);
  });

  test("accepts valid reports --daily-only args", () => {
    const result = normalizeAndValidateArgs("reports", { dailyOnly: true });
    expect(result.ok).toBe(true);
  });

  test("accepts valid reports --weekly-only args", () => {
    const result = normalizeAndValidateArgs("reports", { weeklyOnly: true });
    expect(result.ok).toBe(true);
  });
});

describe("deriveRiskLevel", () => {
  test("collection mode is read-only by default", () => {
    expect(deriveRiskLevel("collection", { runCollection: false, cleanup: false })).toBe("read-only");
  });

  test("collection --run-collection is write", () => {
    expect(deriveRiskLevel("collection", { runCollection: true, cleanup: false })).toBe("write");
  });

  test("reports --config-only is read-only", () => {
    expect(deriveRiskLevel("reports", { configOnly: true, cleanup: false })).toBe("read-only");
  });

  test("reports --daily-only is write", () => {
    expect(deriveRiskLevel("reports", { dailyOnly: true, cleanup: false })).toBe("write");
  });

  test("reports --weekly-only is write", () => {
    expect(deriveRiskLevel("reports", { weeklyOnly: true, cleanup: false })).toBe("write");
  });

  test("full mode is write", () => {
    expect(deriveRiskLevel("full", { runCollection: false, cleanup: false })).toBe("write");
  });

  test("full --run-collection is write", () => {
    expect(deriveRiskLevel("full", { runCollection: true, cleanup: false })).toBe("write");
  });

  test("any mode with cleanup is high-risk-write", () => {
    expect(deriveRiskLevel("collection", { runCollection: true, cleanup: true })).toBe("high-risk-write");
    expect(deriveRiskLevel("reports", { dailyOnly: true, cleanup: true })).toBe("high-risk-write");
    expect(deriveRiskLevel("full", { runCollection: false, cleanup: true })).toBe("high-risk-write");
  });
});

describe("env guard", () => {
  test("DIAGNOSTICS_ENV=test with production inferred env is rejected", () => {
    expect(shouldBlockDueToEnvMismatch("test", "production")).toBe(true);
    expect(shouldBlockDueToEnvMismatch("production", "test")).toBe(true);
    expect(shouldBlockDueToEnvMismatch("test", "test")).toBe(false);
    expect(shouldBlockDueToEnvMismatch("production", "production")).toBe(false);
  });

  test("allows execution when inferred env is unknown", () => {
    expect(shouldBlockDueToEnvMismatch("test", "unknown")).toBe(false);
    expect(shouldBlockDueToEnvMismatch("production", "unknown")).toBe(false);
  });
});
