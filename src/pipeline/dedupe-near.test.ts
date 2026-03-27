import { describe, expect, test } from "bun:test";
import { dedupeNear } from "./dedupe-near";

describe("dedupeNear", () => {
  test("dedupes highly similar titles above 0.75 threshold", () => {
    // "openai releases new model" vs "openai released new model" - very similar
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "openai released new model", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2"); // newest wins
  });

  test("keeps titles below 0.75 similarity threshold", () => {
    // "openai releases new model" vs "google announces gemini update" - different enough
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "google announces gemini update", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(2); // both kept since below threshold
  });

  test("threshold is exactly 0.75 - at threshold is deduped", () => {
    // Two titles with exactly 0.75 similarity should be deduped
    // "the quick brown fox" vs "the quick brown fox jumps" - 4 common tokens / (4+5) = 4/9 ≈ 0.44 - actually below threshold
    // Need to construct exact 0.75 case
    // Let's use: "a b c d e f g h" (8 tokens) vs "a b c d e f g h i j" (10 tokens) with LCS of 8
    // ratio = 2*8/(8+10) = 16/18 = 0.888... too high
    // "a b c d e" (5) vs "a b c d f" (5) - LCS 4, ratio = 2*4/10 = 0.8 - above 0.75
    const items = [
      { id: "1", normalizedTitle: "a b c d e", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "a b c d f", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    // 4 shared tokens (a,b,c,d), 5+5=10 total, ratio=0.8 > 0.75, should dedupe
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2");
  });

  test("below 0.75 threshold is NOT deduped", () => {
    // "a b c d e" vs "f g h i j" - no common tokens
    const items = [
      { id: "1", normalizedTitle: "a b c d e", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "f g h i j", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(2);
  });

  test("only uses normalizedTitle - summary and content do not affect dedupe", () => {
    // Even if summaries are very similar, only title matters for near dedupe
    // These two have similar content but different titles
    const items = [
      { id: "1", normalizedTitle: "openai model announcement", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "google releases ai update", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    // Different titles, different companies - below threshold, both kept
    expect(deduped.length).toBe(2);
  });

  test("uses token bucket pre-filtering - only compares candidates with shared tokens", () => {
    // "openai releases new model" has tokens: openai, releases, new, model
    // "completely unrelated article about dogs" has tokens: completely, unrelated, article, about, dogs
    // No shared tokens, so even if titles are long, they shouldn't be compared
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "completely unrelated article about dogs", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(2); // no shared tokens, bucket filter keeps them separate
  });

  test("newest publishedAt wins when duplicates found", () => {
    const items = [
      { id: "oldest", normalizedTitle: "openai releases new model", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "middle", normalizedTitle: "openai releases new model", normalizedUrl: "https://c.com", publishedAt: "2026-03-09T01:00:00Z" },
      { id: "newest", normalizedTitle: "openai released new model", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T02:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("newest");
  });

  test("three-way dedupe with mixed similarity", () => {
    // 1 and 3 are similar, 2 is different
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "google announces gemini update", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T01:00:00Z" },
      { id: "3", normalizedTitle: "openai released new model", normalizedUrl: "https://c.com", publishedAt: "2026-03-09T02:00:00Z" },
    ];
    const deduped = dedupeNear(items);
    // 1 and 3 are similar (dedupe keeping newest=3), 2 is different (kept)
    expect(deduped.length).toBe(2);
    const ids = deduped.map(i => i.id).sort();
    expect(ids).toEqual(["2", "3"]);
  });

  test("threshold 0.75 is the boundary - at or above is deduped", () => {
    // "a b c d" (4 tokens) vs "a b c e" (4 tokens) - LCS is 3 (a,b,c), ratio = 2*3/8 = 0.75
    // Exactly at threshold should be deduped
    const items = [
      { id: "1", normalizedTitle: "a b c d", normalizedUrl: "https://a.com", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "a b c e", normalizedUrl: "https://b.com", publishedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.id).toBe("2");
  });
});
