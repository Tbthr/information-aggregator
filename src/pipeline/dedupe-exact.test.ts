import { describe, expect, test } from "bun:test";
import { dedupeExact } from "./dedupe-exact";

describe("dedupeExact", () => {
  test("keeps one item per exact dedup key", () => {
    const items = [
      { id: "1", exactDedupKey: "a", processedAt: "2026-03-09T00:00:00Z" },
      { id: "2", exactDedupKey: "a", processedAt: "2026-03-09T01:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2");
  });

  test("prefers the original article over a community discussion item for the same canonical url", () => {
    const items = [
      {
        id: "article",
        exactDedupKey: "https://example.com/post",
        canonicalUrl: "https://example.com/post",
        contentType: "article",
        processedAt: "2026-03-09T00:00:00Z",
      },
      {
        id: "reddit-thread",
        exactDedupKey: "https://example.com/post",
        canonicalUrl: "https://example.com/post",
        contentType: "community_post",
        processedAt: "2026-03-09T01:00:00Z",
      },
    ];

    const deduped = dedupeExact(items);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("article");
  });

  test("dedupes x posts to the expanded article canonical url", () => {
    const items = [
      {
        id: "tweet-1",
        exactDedupKey: "https://example.com/article",
        canonicalUrl: "https://example.com/article",
        contentType: "social_post",
        processedAt: "2026-03-09T01:00:00Z",
      },
      {
        id: "article",
        exactDedupKey: "https://example.com/article",
        canonicalUrl: "https://example.com/article",
        contentType: "article",
        processedAt: "2026-03-09T00:00:00Z",
      },
    ];

    const deduped = dedupeExact(items);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("article");
  });
});
