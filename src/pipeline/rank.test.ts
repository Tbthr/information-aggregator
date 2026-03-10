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

  test("keeps engagement bounded so discussion pages do not outrank the original article", () => {
    const ranked = rankCandidates([
      {
        id: "article",
        sourceWeightScore: 0.9,
        freshnessScore: 0.9,
        engagementScore: 0.2,
        topicMatchScore: 0.8,
        contentQualityAi: 0,
        contentType: "article",
      },
      {
        id: "discussion",
        sourceWeightScore: 0.9,
        freshnessScore: 0.9,
        engagementScore: 10,
        topicMatchScore: 0.8,
        contentQualityAi: 0,
        contentType: "community_post",
      },
    ]);

    expect(ranked[0]?.id).toBe("article");
    expect(ranked[1]?.finalScore).toBeLessThan(1.1);
  });
});
