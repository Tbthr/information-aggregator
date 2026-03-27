import { describe, expect, test } from "bun:test";
import { normalizeItem } from "./normalize";
import type { RawItem, FilterContext } from "../types/index";

function makeRawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "raw-1",
    sourceId: "rss-1",
    title: "Test Article Title",
    url: "https://example.com/post",
    fetchedAt: "2026-03-09T00:00:00Z",
    metadataJson: JSON.stringify({
      provider: "rss",
      sourceType: "rss",
      contentType: "article",
      authorName: "John Doe",
      summary: "This is a test article summary",
      content: "This is the full content of the article that provides more details.",
    }),
    publishedAt: "2026-03-09T10:00:00Z",
    ...overrides,
  };
}

describe("normalizeItem", () => {
  test("produces article-only NormalizedItem with all required fields", () => {
    const raw = makeRawItem();
    const result = normalizeItem(raw);

    expect(result.id).toBe("raw-1");
    expect(result.sourceId).toBe("rss-1");
    expect(result.title).toBe("Test Article Title");
    expect(result.publishedAt).toBe("2026-03-09T10:00:00Z");
    expect(result.sourceType).toBe("rss");
    expect(result.contentType).toBe("article");
    expect(result.normalizedUrl).toBe("https://example.com/post");
    expect(result.normalizedTitle).toBe("test article title");
    expect(result.normalizedSummary).toBe("this is a test article summary");
    expect(result.normalizedContent).toBe("this is the full content of the article that provides more details.");
    expect(result.metadataJson).toBe(raw.metadataJson);
  });

  test("normalizes URL correctly (strips www, tracking params, fragment, trailing slash)", () => {
    const raw = makeRawItem({
      url: "https://www.EXAMPLE.COM/post/?utm_source=x&fbclid=abc#section",
    });
    const result = normalizeItem(raw);
    expect(result.normalizedUrl).toBe("https://example.com/post");
  });

  test("normalizes title (removes RT, site name, punctuation, lowercases, compresses whitespace)", () => {
    const raw = makeRawItem({
      title: "RT @user: Breaking News | Example Site!",
    });
    const result = normalizeItem(raw);
    expect(result.normalizedTitle).toBe("breaking news");
  });

  test("passes through filterContext from RawItem", () => {
    const filterContext: FilterContext = {
      packId: "pack-1",
      mustInclude: ["ai"],
      exclude: ["spam"],
    };
    const raw = makeRawItem({ filterContext });
    const result = normalizeItem(raw);
    expect(result.filterContext).toEqual(filterContext);
  });

  test("normalizes summary (light normalization)", () => {
    const raw = makeRawItem({
      metadataJson: JSON.stringify({
        provider: "rss",
        sourceType: "rss",
        contentType: "article",
        summary: "  Hello   <b>World</b> &amp; Test  ",
      }),
    });
    const result = normalizeItem(raw);
    // HTML tags removed, entities decoded
    expect(result.normalizedSummary).toBe("hello world & test");
  });

  test("normalizes content and truncates to 500 chars", () => {
    const longContent = "A".repeat(600);
    const raw = makeRawItem({
      metadataJson: JSON.stringify({
        provider: "rss",
        sourceType: "rss",
        contentType: "article",
        summary: "short",
        content: longContent,
      }),
    });
    const result = normalizeItem(raw);
    expect(result.normalizedContent!.length).toBeLessThanOrEqual(503); // 500 + "..."
    expect(result.normalizedContent!.endsWith("...")).toBe(true);
  });

  test("handles missing summary in metadata", () => {
    const raw = makeRawItem({
      metadataJson: JSON.stringify({
        provider: "rss",
        sourceType: "rss",
        contentType: "article",
        content: "Some content",
      }),
    });
    const result = normalizeItem(raw);
    expect(result.normalizedSummary).toBe("");
  });

  test("handles missing content in metadata", () => {
    const raw = makeRawItem({
      metadataJson: JSON.stringify({
        provider: "rss",
        sourceType: "rss",
        contentType: "article",
        summary: "Some summary",
      }),
    });
    const result = normalizeItem(raw);
    expect(result.normalizedContent).toBe("");
  });

  test("does not include removed fields", () => {
    const raw = makeRawItem();
    const result = normalizeItem(raw);

    // These fields should NOT exist in the new NormalizedItem
    expect(result.rawItemId).toBeUndefined();
    expect(result.canonicalUrl).toBeUndefined();
    expect(result.linkedCanonicalUrl).toBeUndefined();
    expect(result.relationshipToCanonical).toBeUndefined();
    expect(result.isDiscussionSource).toBeUndefined();
    expect(result.normalizedText).toBeUndefined();
    expect(result.exactDedupKey).toBeUndefined();
    expect(result.engagementScore).toBeUndefined();
    expect(result.content).toBeUndefined(); // top-level content removed
    expect(result.url).toBeUndefined(); // original url removed, only normalizedUrl
  });
});
