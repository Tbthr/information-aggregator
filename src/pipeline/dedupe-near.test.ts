import { describe, expect, test } from "bun:test";
import { dedupeNear } from "./dedupe-near";

describe("dedupeNear", () => {
  test("dedupes highly similar titles above 0.75 threshold", () => {
    // "openai releases new model" vs "openai released new model" - very similar
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "openai released new model", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2"); // newest wins
  });

  test("keeps titles below 0.75 similarity threshold", () => {
    // "openai releases new model" vs "google announces gemini update" - different enough
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "google announces gemini update", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(2); // both kept since below threshold
  });

  test("threshold is exactly 0.75 - at threshold is deduped", () => {
    // "a b c d e" (5 tokens) vs "a b c d f" (5 tokens) - LCS 4, ratio = 2*4/10 = 0.8 - above 0.75
    const items = [
      { id: "1", normalizedTitle: "a b c d e", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "a b c d f", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2");
  });

  test("below 0.75 threshold is NOT deduped", () => {
    // "a b c d e" vs "f g h i j" - no common tokens
    const items = [
      { id: "1", normalizedTitle: "a b c d e", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "f g h i j", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(2);
  });

  test("A≈B, B≈C produces single cluster (input-order independent via connected components)", () => {
    // This is the key test for input-order independence
    // Items 1 and 3 are similar (A≈C), but 2 is between them (B≈A and B≈C)
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "openai has released new model", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T01:00:00Z" },
      { id: "3", normalizedTitle: "openai released new model", normalizedContent: "", normalizedUrl: "https://c.com", publishedAt: "2026-03-09T02:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    // All three should be in one cluster, winner is the newest
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("3"); // newest wins
  });

  test("transitive clustering - three-way similarity", () => {
    // 1 and 3 are similar, 2 is different
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "google announces gemini update", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T01:00:00Z" },
      { id: "3", normalizedTitle: "openai released new model", normalizedContent: "", normalizedUrl: "https://c.com", publishedAt: "2026-03-09T02:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    // 1 and 3 are similar (cluster), 2 is different (cluster)
    expect(deduped.length).toBe(2);
    const ids = deduped.map((i) => i.id).sort();
    expect(ids).toEqual(["2", "3"]);
  });

  test("winner selection uses tags.length as primary criterion", () => {
    const items = [
      { id: "few-tags", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", sourceDefaultTags: ["t1"], publishedAt: "2026-03-09T00:00:00Z" },
      { id: "many-tags", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://b.com", sourceDefaultTags: ["t1", "t2", "t3"], publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("many-tags");
  });

  test("winner selection uses sourcePriority as secondary criterion", () => {
    const items = [
      { id: "low-priority", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", sourceDefaultTags: [], sourcePriority: 1, publishedAt: "2026-03-09T00:00:00Z" },
      { id: "high-priority", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://b.com", sourceDefaultTags: [], sourcePriority: 10, publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("high-priority");
  });

  test("winner selection uses engagementScore (null = -1)", () => {
    const items = [
      { id: "no-engagement", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://a.com", engagementScore: null, publishedAt: "2026-03-09T00:00:00Z" },
      { id: "has-engagement", normalizedTitle: "openai releases new model", normalizedContent: "", normalizedUrl: "https://b.com", engagementScore: 50, publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("has-engagement");
  });

  test("handles empty input", () => {
    const deduped = dedupeNear([]);
    expect(deduped).toHaveLength(0);
  });

  test("uses combined title + body for comparison", () => {
    // Two items with different titles but very similar body should be deduped
    // The body is long enough that even with different titles, the combined similarity > 0.75
    const body = "OpenAI has released a new model called GPT-5 that achieves state of the art results on all major benchmarks including MMLU and HumanEval";
    const items = [
      { id: "1", normalizedTitle: "Breaking: AI News", normalizedContent: body, normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "Tech Update Today", normalizedContent: body, normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2"); // newest wins
  });

  test("case-insensitive comparison via tokenization", () => {
    // Same content in different cases should be deduped
    const items = [
      { id: "1", normalizedTitle: "OpenAI Releases New Model", normalizedContent: "GPT-5 is here", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "openai releases new model", normalizedContent: "gpt-5 is here", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2");
  });

  test("punctuation is stripped for comparison", () => {
    // Punctuation differences should not prevent dedup
    const items = [
      { id: "1", normalizedTitle: "OpenAI's new model: GPT-5!", normalizedContent: "", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "OpenAIs new model GPT-5", normalizedContent: "", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2");
  });

  test("body content contributes to similarity when titles differ", () => {
    // Two items with short different titles but identical long body content
    const body = "detailed analysis of the new artificial intelligence capabilities and their impact on society";
    const items = [
      { id: "1", normalizedTitle: "AI News", normalizedContent: body, normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "Tech Update", normalizedContent: body, normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    // The bodies are identical, so the combined tokens should be very similar
    expect(deduped.length).toBe(1);
  });
});
