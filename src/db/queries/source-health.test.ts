import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import {
  getSourceHealth,
  recordSourceFailureWithMetrics,
  recordSourceSuccessWithMetrics,
  recordSourceZeroItems,
} from "./source-health";

describe("source health", () => {
  test("increments error count and consecutive failures on failure", () => {
    const db = createDb(":memory:");
    recordSourceFailureWithMetrics(db, "source-1", {
      error: "timeout",
      fetchedAt: "2026-03-09T00:00:00Z",
      latencyMs: 420,
    });
    const health = getSourceHealth(db, "source-1");
    expect(health?.errorCount).toBe(1);
    expect(health?.consecutiveFailures).toBe(1);
    expect(health?.lastFetchLatencyMs).toBe(420);
  });

  test("tracks success metrics and resets failure streak", () => {
    const db = createDb(":memory:");
    recordSourceFailureWithMetrics(db, "source-1", {
      error: "timeout",
      fetchedAt: "2026-03-09T00:00:00Z",
      latencyMs: 500,
    });
    recordSourceSuccessWithMetrics(db, "source-1", {
      fetchedAt: "2026-03-09T00:01:00Z",
      latencyMs: 120,
      itemCount: 3,
    });
    const health = getSourceHealth(db, "source-1");
    expect(health?.lastSuccessAt).toBe("2026-03-09T00:01:00Z");
    expect(health?.lastItemCount).toBe(3);
    expect(health?.lastFetchLatencyMs).toBe(120);
    expect(health?.consecutiveFailures).toBe(0);
    expect(health?.consecutiveZeroItemRuns).toBe(0);
  });

  test("tracks zero-item success runs separately", () => {
    const db = createDb(":memory:");
    recordSourceZeroItems(db, "source-1");
    const health = getSourceHealth(db, "source-1");
    expect(health?.consecutiveZeroItemRuns).toBe(1);
    expect(health?.consecutiveFailures).toBe(0);
  });
});
