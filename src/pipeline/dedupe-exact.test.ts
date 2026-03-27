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

  test("ignores contentType - newest publishedAt always wins regardless of type", () => {
    // Spec says NO contentType priority - just pick newest publishedAt
    const items = [
      { id: "article-old", normalizedUrl: "https://example.com/post", contentType: "article", publishedAt: "2026-03-09T00:00:00Z" },
      { id: "community-new", normalizedUrl: "https://example.com/post", contentType: "community_post", publishedAt: "2026-03-09T01:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("community-new"); // newest publishedAt wins, not article
  });

  test("uses publishedAt not processedAt", () => {
    const items = [
      { id: "1", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T00:00:00Z", processedAt: "2026-03-09T12:00:00Z" },
      { id: "2", normalizedUrl: "https://example.com/post", publishedAt: "2026-03-09T01:00:00Z", processedAt: "2026-03-09T08:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2"); // newest publishedAt wins, not newest processedAt
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
});
