import { describe, expect, test } from "bun:test";
import { rankCandidates } from "./rank";

describe("rankCandidates", () => {
  test("orders candidates by final score descending", () => {
    const ranked = rankCandidates([
      { id: "a", sourceWeightScore: 0.1, freshnessScore: 0.1, engagementScore: 0, topicMatchScore: 0.1, contentQualityAi: 0 },
      { id: "b", sourceWeightScore: 0.9, freshnessScore: 0.9, engagementScore: 0, topicMatchScore: 0.9, contentQualityAi: 0 },
    ]);
    expect(ranked[0]?.id).toBe("b");
  });
});
