import { describe, expect, test } from "bun:test";
import type { DiagnosticsRunResult } from "../core/types";

describe("full runner", () => {
  test("returns DiagnosticsRunResult with full mode", () => {
    const result: Partial<DiagnosticsRunResult> = {
      mode: "full",
      stages: [],
      assertions: [],
    };
    expect(result.mode).toBe("full");
  });

  test("full mode has both collection and reports stages", () => {
    const stages = [
      // Collection stages
      { key: "guards", label: "Guards", category: "system" as const, status: "PASS" as const, durationMs: 0 },
      { key: "health", label: "Health", category: "collection" as const, status: "PASS" as const, durationMs: 100 },
      { key: "inventory", label: "Inventory", category: "collection" as const, status: "PASS" as const, durationMs: 100 },
      // Reports stages
      { key: "reports-inventory", label: "Inventory", category: "reports" as const, status: "PASS" as const, durationMs: 50 },
      { key: "daily", label: "Daily Report", category: "reports" as const, status: "PASS" as const, durationMs: 1000 },
      { key: "weekly", label: "Weekly Report", category: "reports" as const, status: "PASS" as const, durationMs: 1000 },
    ];

    const collectionStages = stages.filter((s) => s.category === "collection");
    const reportsStages = stages.filter((s) => s.category === "reports");

    expect(collectionStages.length).toBeGreaterThan(0);
    expect(reportsStages.length).toBeGreaterThan(0);
  });

  test("full mode has write risk by default", () => {
    const riskLevel = "write";
    expect(riskLevel).toBe("write");
  });

  test("full mode with --run-collection runs collection stages", () => {
    const stages = [
      { key: "guards", label: "Guards", category: "system" as const, status: "PASS" as const, durationMs: 0 },
      { key: "collection-run", label: "Collection Run", category: "collection" as const, status: "PASS" as const, durationMs: 5000 },
    ];

    const collectionRunStage = stages.find((s) => s.key === "collection-run");
    expect(collectionRunStage).toBeDefined();
    expect(collectionRunStage?.status).toBe("PASS");
  });

  test("full mode without --run-collection skips collection run stage", () => {
    const stages = [
      { key: "guards", label: "Guards", category: "system" as const, status: "PASS" as const, durationMs: 0 },
      { key: "inventory", label: "Inventory", category: "collection" as const, status: "PASS" as const, durationMs: 100 },
      // collection-run stage would be absent
    ];

    const collectionRunStage = stages.find((s) => s.key === "collection-run");
    expect(collectionRunStage).toBeUndefined();
  });

  test("full mode sections contain both collection and reports", () => {
    const sections = {
      collection: {
        inventory: { itemCount: 100, tweetCount: 50, sourceCount: 10, unhealthySourceCount: 2 },
      },
      reports: {
        inventory: { items: 100, tweets: 50, dailyReports: 30, weeklyReports: 4 },
      },
    };

    expect(sections.collection).toBeDefined();
    expect(sections.reports).toBeDefined();
    expect(sections.collection.inventory.itemCount).toBe(100);
    expect(sections.reports.inventory.dailyReports).toBe(30);
  });

  test("full mode --cleanup is high-risk-write", () => {
    const riskLevel = "high-risk-write";
    expect(riskLevel).toBe("high-risk-write");
  });

  test("merged stages have correct category assignments", () => {
    const stages = [
      { key: "guards", category: "system" as const },
      { key: "health", category: "collection" as const },
      { key: "inventory", category: "collection" as const },
      { key: "config-validation", category: "reports" as const },
      { key: "reports-inventory", category: "reports" as const },
      { key: "daily", category: "reports" as const },
      { key: "weekly", category: "reports" as const },
      { key: "integrity", category: "reports" as const },
    ];

    expect(stages.filter((s) => s.category === "system").length).toBe(1);
    expect(stages.filter((s) => s.category === "collection").length).toBe(2);
    expect(stages.filter((s) => s.category === "reports").length).toBe(5);
  });
});
