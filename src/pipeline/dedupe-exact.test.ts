import { describe, expect, test } from "bun:test";
import { dedupeExact } from "./dedupe-exact";

describe("dedupeExact", () => {
  test("keeps one item per normalizedUrl", () => {
    const items = [
      { id: "1", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T01:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2"); // newest publishedAt wins
  });

  test("keeps newest publishedAt when same normalizedUrl has multiple items", () => {
    const items = [
      { id: "oldest", normalizedUrl: "https://example.com/article", publishedAt: "2026-03-01T00:00:00Z" },
      { id: "middle", normalizedUrl: "https://example.com/article", publishedAt: "2026-03-15T00:00:00Z" },
      { id: "newest", normalizedUrl: "https://example.com/article", publishedAt: "2026-03-20T00:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("newest");
  });

  test("different normalizedUrls are kept separate", () => {
    const items = [
      { id: "1", normalizedUrl: "https://example.com/post1", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedUrl: "https://example.com/post2", publishedAt: "2026-03-09T01:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(2);
  });

  test("winner selection uses topicIds.length as primary criterion", () => {
    // Item with more topics should win
    const items = [
      { id: "few-topics", normalizedUrl: "https://example.com/post", topicIds: ["t1"], publishedAt: "2026-03-09T00:00:00Z" },
      { id: "many-topics", normalizedUrl: "https://example.com/post", topicIds: ["t1", "t2", "t3"], publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("many-topics");
  });

  test("winner selection uses sourcePriority as secondary criterion", () => {
    const items = [
      { id: "low-priority", normalizedUrl: "https://example.com/post", sourcePriority: 1, publishedAt: "2026-03-09T00:00:00Z" },
      { id: "high-priority", normalizedUrl: "https://example.com/post", sourcePriority: 10, publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("high-priority");
  });

  test("winner selection uses engagementScore as tertiary criterion (null = -1)", () => {
    const items = [
      { id: "no-engagement", normalizedUrl: "https://example.com/post", engagementScore: null, publishedAt: "2026-03-09T00:00:00Z" },
      { id: "has-engagement", normalizedUrl: "https://example.com/post", engagementScore: 50, publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("has-engagement");
  });

  test("winner selection uses id as final tiebreaker (lexicographic)", () => {
    const items = [
      { id: "zzz", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "aaa", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("aaa"); // "aaa" < "zzz" lexicographically
  });

  test("handles missing publishedAt - treats as oldest", () => {
    const items = [
      { id: "no-date", normalizedUrl: "https://example.com/post" },
      { id: "with-date", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T00:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("with-date");
  });

  test("handles empty input", () => {
    const deduped = dedupeExact([]);
    expect(deduped).toHaveLength(0);
  });
});
