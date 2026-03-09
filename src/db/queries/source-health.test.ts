import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { getSourceHealth, recordSourceFailure, recordSourceSuccess, recordSourceZeroItems } from "./source-health";

describe("source health", () => {
  test("increments error count on failure", () => {
    const db = createDb(":memory:");
    recordSourceFailure(db, "source-1", "timeout");
    const health = getSourceHealth(db, "source-1");
    expect(health?.errorCount).toBe(1);
  });

  test("tracks success and zero item runs", () => {
    const db = createDb(":memory:");
    recordSourceZeroItems(db, "source-1");
    recordSourceSuccess(db, "source-1", "2026-03-09T00:00:00Z");
    const health = getSourceHealth(db, "source-1");
    expect(health?.consecutiveZeroItemRuns).toBe(0);
  });
});
