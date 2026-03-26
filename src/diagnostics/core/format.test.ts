import { describe, expect, test } from "bun:test";
import { formatDiagnosticsRun, serializeDiagnosticsRun } from "./format";
import type { DiagnosticsRunResult } from "./types";

function makeResult(overrides: Partial<DiagnosticsRunResult> = {}): DiagnosticsRunResult {
  const base: DiagnosticsRunResult = {
    mode: "collection",
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: "2024-01-01T00:01:00.000Z",
    durationMs: 60000,
    effectiveEnv: "test",
    inferredEnv: "test",
    dbHost: "postgresql://localhost/testdb",
    riskLevel: "read-only",
    status: "PASS",
    summary: { pass: 3, warn: 1, fail: 0, skip: 1 },
    stages: [
      { key: "preflight", label: "Preflight", category: "system", status: "PASS", durationMs: 100 },
      { key: "guards", label: "Guards", category: "system", status: "WARN", durationMs: 50 },
      { key: "inventory", label: "Inventory", category: "collection", status: "SKIP", durationMs: 0 },
      { key: "health", label: "Health", category: "collection", status: "PASS", durationMs: 5000 },
    ],
    assertions: [
      { id: "C-01", category: "collection", status: "PASS", blocking: true, message: "source health OK" },
      { id: "C-02", category: "collection", status: "WARN", blocking: false, message: "some items stale" },
    ],
  };
  return { ...base, ...overrides };
}

describe("formatDiagnosticsRun", () => {
  test("returns a non-empty string", () => {
    const result = makeResult();
    const output = formatDiagnosticsRun(result);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("includes PASS status in output", () => {
    const result = makeResult({ status: "PASS" });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("PASS");
  });

  test("includes FAIL status in output", () => {
    const result = makeResult({ status: "FAIL" });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("FAIL");
  });

  test("includes mode in output", () => {
    const result = makeResult({ mode: "collection" });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("COLLECTION");
  });

  test("includes duration in output", () => {
    const result = makeResult({ durationMs: 65000 });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("65000");
  });

  test("includes summary counts", () => {
    const result = makeResult({ summary: { pass: 5, warn: 2, fail: 1, skip: 0 } });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("5 pass");
    expect(output).toContain("2 warn");
    expect(output).toContain("1 fail");
  });

  test("includes stage labels", () => {
    const result = makeResult();
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("Preflight");
    expect(output).toContain("Guards");
    expect(output).toContain("Inventory");
  });

  test("includes assertion messages", () => {
    const result = makeResult();
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("source health OK");
    expect(output).toContain("some items stale");
  });

  test("includes risk level", () => {
    const result = makeResult({ riskLevel: "write" });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("write");
  });

  test("handles WARN status gracefully", () => {
    const result = makeResult({ status: "WARN" });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("WARN");
  });

  test("handles SKIP status gracefully", () => {
    const result = makeResult({ status: "SKIP" });
    const output = formatDiagnosticsRun(result);
    expect(output).toContain("SKIP");
  });
});

describe("serializeDiagnosticsRun", () => {
  test("returns valid JSON string", () => {
    const result = makeResult();
    const json = serializeDiagnosticsRun(result);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test("round-trips through JSON parse", () => {
    const result = makeResult();
    const json = serializeDiagnosticsRun(result);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("collection");
    expect(parsed.status).toBe("PASS");
  });

  test("includes all top-level fields", () => {
    const result = makeResult();
    const json = serializeDiagnosticsRun(result);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty("mode");
    expect(parsed).toHaveProperty("startedAt");
    expect(parsed).toHaveProperty("finishedAt");
    expect(parsed).toHaveProperty("durationMs");
    expect(parsed).toHaveProperty("effectiveEnv");
    expect(parsed).toHaveProperty("inferredEnv");
    expect(parsed).toHaveProperty("dbHost");
    expect(parsed).toHaveProperty("riskLevel");
    expect(parsed).toHaveProperty("status");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("stages");
    expect(parsed).toHaveProperty("assertions");
  });

  test("serializes sections if present", () => {
    const result = makeResult({
      sections: {
        collection: {
          inventory: { itemCount: 100, tweetCount: 50, sourceCount: 10, unhealthySourceCount: 2 },
        },
      },
    });
    const json = serializeDiagnosticsRun(result);
    const parsed = JSON.parse(json);
    expect(parsed.sections?.collection?.inventory?.itemCount).toBe(100);
  });

  test("handles result with no sections", () => {
    const result = makeResult({ sections: undefined });
    const json = serializeDiagnosticsRun(result);
    const parsed = JSON.parse(json);
    expect(parsed.sections).toBeUndefined();
  });
});

describe("format error handling", () => {
  test("formatDiagnosticsRun handles malformed input gracefully", () => {
    // Pass a partial object that is not a valid DiagnosticsRunResult
    const invalid = { mode: "collection" } as DiagnosticsRunResult;
    expect(() => formatDiagnosticsRun(invalid)).not.toThrow();
  });

  test("serializeDiagnosticsRun handles malformed input gracefully", () => {
    const invalid = { mode: "collection" } as DiagnosticsRunResult;
    expect(() => serializeDiagnosticsRun(invalid)).not.toThrow();
  });
});
