import { describe, expect, test } from "bun:test";
import { normalizeItems } from "./normalize";

describe("normalizeItems", () => {
  test("produces normalized items with canonical url and normalized title", () => {
    const normalized = normalizeItems([
      {
        id: "raw-1",
        sourceId: "s1",
        title: " Hello World ",
        url: "https://example.com/post?utm_source=x",
        fetchedAt: "2026-03-09T00:00:00Z",
        metadataJson: "{}",
      },
    ]);
    expect(normalized[0]?.normalizedTitle).toBe("hello world");
    expect(normalized[0]?.canonicalUrl).toBe("https://example.com/post");
  });

  test("prefers expanded article urls for x sources", () => {
    const normalized = normalizeItems([
      {
        id: "tweet-1",
        sourceId: "x-home",
        title: "Interesting thread",
        url: "https://x.com/openai/status/123",
        fetchedAt: "2026-03-09T00:00:00Z",
        metadataJson: JSON.stringify({
          provider: "bird",
          sourceType: "x_home",
          contentType: "social_post",
          canonicalHints: {
            expandedUrl: "https://example.com/article",
          },
        }),
      },
    ]);

    expect(normalized[0]?.canonicalUrl).toBe("https://example.com/article");
    expect(normalized[0]?.exactDedupKey).toBe("https://example.com/article");
  });
});
