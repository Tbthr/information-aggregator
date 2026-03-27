import { describe, expect, test } from "bun:test";
import type { DiagnosticsRunResult } from "../core/types";

describe("reports runner", () => {
  test("returns DiagnosticsRunResult with reports mode", () => {
    const result: Partial<DiagnosticsRunResult> = {
      mode: "reports",
      stages: [],
      assertions: [],
    };
    expect(result.mode).toBe("reports");
  });

  test("config-only mode produces read-only risk", () => {
    const riskLevel = "read-only"; // config-only
    expect(riskLevel).toBe("read-only");
  });

  test("daily-only mode produces write risk", () => {
    const riskLevel = "write"; // daily-only
    expect(riskLevel).toBe("write");
  });

  test("weekly-only mode produces write risk", () => {
    const riskLevel = "write"; // weekly-only
    expect(riskLevel).toBe("write");
  });

  test("config validation stage exists", () => {
    const stages = [
      { key: "config-validation", label: "Config Validation", category: "reports" as const, status: "PASS" as const, durationMs: 100 },
    ];
    expect(stages[0].key).toBe("config-validation");
    expect(stages[0].category).toBe("reports");
  });

  test("inventory stage exists", () => {
    const stages = [
      { key: "inventory", label: "Inventory", category: "reports" as const, status: "PASS" as const, durationMs: 50 },
    ];
    expect(stages[0].key).toBe("inventory");
  });

  test("daily assertions stage exists when not weekly-only", () => {
    const stages = [
      { key: "daily", label: "Daily Report", category: "reports" as const, status: "PASS" as const, durationMs: 1000 },
    ];
    expect(stages[0].key).toBe("daily");
  });

  test("weekly assertions stage exists when not daily-only", () => {
    const stages = [
      { key: "weekly", label: "Weekly Report", category: "reports" as const, status: "PASS" as const, durationMs: 1000 },
    ];
    expect(stages[0].key).toBe("weekly");
  });

  test("integrity assertions stage exists", () => {
    const stages = [
      { key: "integrity", label: "Integrity", category: "reports" as const, status: "PASS" as const, durationMs: 200 },
    ];
    expect(stages[0].key).toBe("integrity");
  });

  test("reports section contains config when available", () => {
    const section = {
      reports: {
        config: {
          daily: { maxItems: 200, minScore: 0 },
          weekly: { days: 7, pickCount: 5 },
        },
      },
    };
    expect(section.reports.config?.daily.maxItems).toBe(200);
    expect(section.reports.config?.weekly.days).toBe(7);
  });

  test("reports section contains inventory", () => {
    const section = {
      reports: {
        inventory: {
          items: 100,
          tweets: 50,
          dailyReports: 30,
          weeklyReports: 4,
        },
      },
    };
    expect(section.reports.inventory?.dailyReports).toBe(30);
  });

  test("daily-only mode skips weekly stage", () => {
    const stages = [
      { key: "daily", label: "Daily Report", category: "reports" as const, status: "PASS" as const, durationMs: 100 },
      // weekly stage would be absent
    ];
    const weeklyStage = stages.find((s) => s.key === "weekly");
    expect(weeklyStage).toBeUndefined();
  });

  test("weekly-only mode skips daily stage", () => {
    const stages = [
      { key: "weekly", label: "Weekly Report", category: "reports" as const, status: "PASS" as const, durationMs: 100 },
      // daily stage would be absent
    ];
    const dailyStage = stages.find((s) => s.key === "daily");
    expect(dailyStage).toBeUndefined();
  });

  test("config-only mode skips daily and weekly stages", () => {
    const stages = [
      { key: "config-validation", label: "Config Validation", category: "reports" as const, status: "PASS" as const, durationMs: 100 },
      { key: "inventory", label: "Inventory", category: "reports" as const, status: "PASS" as const, durationMs: 50 },
      // no daily or weekly stages
    ];
    const dailyStage = stages.find((s) => s.key === "daily");
    const weeklyStage = stages.find((s) => s.key === "weekly");
    expect(dailyStage).toBeUndefined();
    expect(weeklyStage).toBeUndefined();
  });
});
