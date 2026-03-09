import { describe, expect, test } from "bun:test";
import { scoreTopicMatch } from "./topic-match";

describe("scoreTopicMatch", () => {
  test("scores include keywords positively and exclude keywords negatively", () => {
    const score = scoreTopicMatch(
      { normalizedTitle: "ai model release tutorial", normalizedText: "" },
      { includeKeywords: ["ai", "tutorial"], excludeKeywords: ["crypto"] },
    );
    expect(score).toBeGreaterThan(0);
  });
});
