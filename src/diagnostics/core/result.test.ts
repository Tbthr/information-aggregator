import { describe, expect, test } from "bun:test";
import {
  summarizeStageStatuses,
  deriveRunStatus,
  createRunResult,
  type DiagnosticsStageResult,
} from "./result";

describe("summarizeStageStatuses", () => {
  test("counts pass/warn/fail/skip correctly", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "PASS", durationMs: 10 },
      { key: "b", label: "B", category: "system", status: "WARN", durationMs: 10 },
      { key: "c", label: "C", category: "system", status: "FAIL", durationMs: 10 },
      { key: "d", label: "D", category: "system", status: "SKIP", durationMs: 10 },
      { key: "e", label: "E", category: "system", status: "PASS", durationMs: 10 },
    ];
    const summary = summarizeStageStatuses(stages);
    expect(summary.pass).toBe(2);
    expect(summary.warn).toBe(1);
    expect(summary.fail).toBe(1);
    expect(summary.skip).toBe(1);
  });

  test("handles empty stages", () => {
    const summary = summarizeStageStatuses([]);
    expect(summary.pass).toBe(0);
    expect(summary.warn).toBe(0);
    expect(summary.fail).toBe(0);
    expect(summary.skip).toBe(0);
  });
});

describe("deriveRunStatus", () => {
  test("returns FAIL when any stage is FAIL", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "PASS", durationMs: 10 },
      { key: "b", label: "B", category: "system", status: "FAIL", durationMs: 10 },
      { key: "c", label: "C", category: "system", status: "WARN", durationMs: 10 },
    ];
    expect(deriveRunStatus(stages)).toBe("FAIL");
  });

  test("returns WARN when no FAIL but has WARN", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "PASS", durationMs: 10 },
      { key: "b", label: "B", category: "system", status: "WARN", durationMs: 10 },
    ];
    expect(deriveRunStatus(stages)).toBe("WARN");
  });

  test("returns PASS when all pass", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "PASS", durationMs: 10 },
      { key: "b", label: "B", category: "system", status: "PASS", durationMs: 10 },
    ];
    expect(deriveRunStatus(stages)).toBe("PASS");
  });

  test("returns SKIP when all skip", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "SKIP", durationMs: 10 },
    ];
    expect(deriveRunStatus(stages)).toBe("SKIP");
  });
});

describe("createRunResult", () => {
  test("creates run result with correct status derived from stages", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "FAIL", durationMs: 10 },
    ];
    const result = createRunResult({
      mode: "collection",
      effectiveEnv: "test",
      inferredEnv: "test",
      dbHost: "localhost",
      riskLevel: "read-only",
      stages,
      assertions: [],
    });
    expect(result.status).toBe("FAIL");
    expect(result.summary.fail).toBe(1);
    expect(result.summary.pass).toBe(0);
  });

  test("creates run result with WARN status", () => {
    const stages: DiagnosticsStageResult[] = [
      { key: "a", label: "A", category: "system", status: "WARN", durationMs: 10 },
    ];
    const result = createRunResult({
      mode: "reports",
      effectiveEnv: "test",
      inferredEnv: "test",
      dbHost: "localhost",
      riskLevel: "read-only",
      stages,
      assertions: [],
    });
    expect(result.status).toBe("WARN");
  });
});
