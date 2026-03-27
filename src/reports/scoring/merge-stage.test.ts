import { describe, expect, test } from "bun:test";
import { applyMergeStage } from "./merge-stage";

describe("applyMergeStage", () => {
  test("merges base score and signals into runtime score", () => {
    const result = applyMergeStage({
      baseScore: 10,
      signalScores: { engagement: 50, freshness: 5 },
    });
    expect(result.runtimeScore).toBeGreaterThan(10);
    expect(result.runtimeScore).toBeGreaterThan(50);
  });

  test("handles zero signals gracefully", () => {
    const result = applyMergeStage({
      baseScore: 10,
      signalScores: { engagement: 0, freshness: 0 },
    });
    expect(result.runtimeScore).toBe(10);
  });

  test("handles missing signal fields", () => {
    const result = applyMergeStage({
      baseScore: 15,
      signalScores: { engagement: 20 },
    });
    expect(result.runtimeScore).toBeGreaterThan(15);
  });

  test("runtime score reflects base + engagement signal", () => {
    const result = applyMergeStage({
      baseScore: 10,
      signalScores: { engagement: 100 },
    });
    // Runtime should incorporate engagement signal
    expect(result.runtimeScore).toBeGreaterThanOrEqual(10);
    expect(result.runtimeScore).toBeGreaterThanOrEqual(100);
  });
});