import { describe, expect, test } from "bun:test";
import { rankCandidates, type RankableCandidate } from "./rank";

describe("rankCandidates", () => {
  test("orders candidates by final score descending", () => {
    const candidates: RankableCandidate[] = [
      { id: "a", sourceWeightScore: 0.1, engagementScore: 0 },
      { id: "b", sourceWeightScore: 0.9, engagementScore: 0 },
    ];
    const ranked = rankCandidates(candidates);
    expect(ranked[0]?.id).toBe("b");
  });

  test("applies simplified scoring formula: sourceWeightScore * 0.4 + engagementScore * 0.15", () => {
    const candidates: RankableCandidate[] = [
      { id: "low", sourceWeightScore: 0.1, engagementScore: 0 },
      { id: "high_source", sourceWeightScore: 0.9, engagementScore: 0 },
      { id: "high_engagement", sourceWeightScore: 0.1, engagementScore: 100 },
    ];
    const ranked = rankCandidates(candidates);
    // high_source: 0.9 * 0.4 + 0 * 0.15 = 0.36
    // high_engagement: 0.1 * 0.4 + 100 * 0.15 = 0.04 + 15 = 15.04
    expect(ranked[0]?.id).toBe("high_engagement");
    expect(ranked[1]?.id).toBe("high_source");
    expect(ranked[2]?.id).toBe("low");
  });
});
