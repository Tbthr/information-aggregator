import { describe, expect, test } from "bun:test";

import { enrichCandidates } from "./enrich";

describe("enrichCandidates", () => {
  test("runs enrichment only after candidate reduction", async () => {
    let scoreCalls = 0;

    const enriched = await enrichCandidates(
      [
        { id: "a", title: "A", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0, topicMatchScore: 0 },
        { id: "b", title: "B", normalizedTitle: "b", normalizedText: "b", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0, topicMatchScore: 0 },
        { id: "c", title: "C", normalizedTitle: "c", normalizedText: "c", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0, topicMatchScore: 0 },
      ],
      {
        limit: 2,
        scoreCandidate: async () => {
          scoreCalls += 1;
          return 0.8;
        },
      },
    );

    expect(scoreCalls).toBe(2);
    expect(enriched[0]?.contentQualityAi).toBe(0.8);
    expect(enriched[2]?.contentQualityAi).toBe(0);
  });
});
