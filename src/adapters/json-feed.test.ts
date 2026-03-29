import { describe, expect, test } from "bun:test";
import { parseJsonFeedItems } from "./json-feed";

// Use a jobStartedAt close to the test dates (2026-03-09)
const JOB_STARTED_AT = "2026-03-09T12:00:00.000Z";

describe("parseJsonFeedItems", () => {
  test("extracts items from JSON Feed", () => {
    const payload = {
      version: "https://jsonfeed.org/version/1.1",
      items: [{ id: "1", title: "Hello", url: "https://example.com/1" }],
    };
    const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
    expect(items[0]?.url).toBe("https://example.com/1");
  });

  test("extracts date_published as publishedAt", () => {
    const payload = {
      version: "https://jsonfeed.org/version/1.1",
      items: [
        {
          id: "1",
          title: "Hello",
          url: "https://example.com/1",
          date_published: "2026-03-09T08:00:00Z",
        },
      ],
    };

    const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);

    expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
  });

  test("emits stable collector metadata", () => {
    const payload = {
      version: "https://jsonfeed.org/version/1.1",
      items: [{ id: "1", title: "Hello", url: "https://example.com/1" }],
    };

    const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);

    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "json-feed",
      sourceKind: "json-feed",
      contentType: "article",
      rawPublishedAt: undefined,
      timeSourceField: undefined,
      timeParseNote: "no timestamp found",
      summary: undefined,
      content: undefined,
      authorName: undefined,
    });
  });

  describe("UTC timestamp parsing", () => {
    test("parses ISO 8601 with Z suffix", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09T08:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
    });

    test("parses ISO 8601 with timezone offset", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09T16:00:00+08:00",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      // 2026-03-09T16:00:00+08:00 = 2026-03-09T08:00:00Z
      expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
    });

    test("parses ISO 8601 with negative offset", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09T13:00:00-05:00",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      // 2026-03-09T13:00:00-05:00 = 2026-03-09T18:00:00Z
      expect(items[0]?.publishedAt).toBe("2026-03-09T18:00:00.000Z");
    });
  });

  describe("date-only values filled to UTC 23:59:59", () => {
    test("fills date-only value (YYYY-MM-DD) to 23:59:59 UTC", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      expect(items[0]?.publishedAt).toBe("2026-03-09T23:59:59.000Z");
    });
  });

  describe("relative/invalid timestamps discarded with warnings", () => {
    test("discards item with relative timestamp like '2 hours ago'", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test Relative",
            url: "https://example.com/relative",
            date_published: "2 hours ago",
          },
          {
            id: "2",
            title: "Test Valid",
            url: "https://example.com/valid",
            date_published: "2026-03-09T08:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      // Only the valid item should be present
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Test Valid");
    });

    test("discards item with invalid timestamp", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test Invalid",
            url: "https://example.com/invalid",
            date_published: "not-a-date",
          },
          {
            id: "2",
            title: "Test Valid",
            url: "https://example.com/valid2",
            date_published: "2026-03-09T08:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Test Valid");
    });
  });

  describe("24h rolling window filtering", () => {
    test("filters out items older than 24h based on jobStartedAt", () => {
      // jobStartedAt is 2026-03-09T12:00:00Z, so cutoff is 2026-03-08T12:00:00Z
      // Items published BEFORE cutoff should be discarded
      const jobStartedAt = "2026-03-09T12:00:00.000Z";
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Old Item",
            url: "https://example.com/old",
            date_published: "2026-03-08T11:59:59Z",
          },
          {
            id: "2",
            title: "Within Window",
            url: "https://example.com/recent",
            date_published: "2026-03-09T08:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", jobStartedAt);
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Within Window");
    });

    test("keeps items exactly at 24h boundary", () => {
      const jobStartedAt = "2026-03-09T12:00:00.000Z";
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Exactly at Boundary",
            url: "https://example.com/boundary",
            date_published: "2026-03-08T12:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", jobStartedAt);
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Exactly at Boundary");
    });
  });

  describe("metadataJson summary fallback from content", () => {
    test("uses content_text as summary when no explicit summary", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            content_text: "This is a test summary",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.summary).toBe("This is a test summary");
    });

    test("prefers content_html over content_text for summary", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            content_text: "Plain text",
            content_html: "<p>HTML content</p>",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.summary).toBe("<p>HTML content</p>");
    });

    test("falls back to content_text when no content_html", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            content_text: "Plain text content",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.summary).toBe("Plain text content");
    });
  });

  describe("metadataJson authorName population", () => {
    test("extracts authorName from author object", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            author: { name: "John Doe" },
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.authorName).toBe("John Doe");
    });

    test("handles missing author name gracefully", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            author: {},
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.authorName).toBeUndefined();
    });
  });

  describe("metadataJson audit fields", () => {
    test("populates rawPublishedAt with original time string", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09T08:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.rawPublishedAt).toBe("2026-03-09T08:00:00Z");
    });

    test("populates timeSourceField indicating date_published was used", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09T08:00:00Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.timeSourceField).toBe("date_published");
    });

    test("populates timeParseNote for date-only fill", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            date_published: "2026-03-09",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.timeParseNote).toContain("date-only");
    });

    test("populates timeParseNote for out-of-window discard", () => {
      const jobStartedAt = "2026-03-09T12:00:00.000Z";
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Old Item",
            url: "https://example.com/old",
            date_published: "2026-03-08T11:59:59Z",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", jobStartedAt);
      expect(items.length).toBe(0);
    });
  });

  describe("minimal RawItem shape", () => {
    test("does not include author field at top level", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            author: { name: "John Doe" },
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      // author should be in metadataJson.authorName, not at top level
      expect(items[0]).not.toHaveProperty("author");
      expect(items[0]?.metadataJson).toContain("authorName");
    });

    test("does not include content field at top level", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [
          {
            id: "1",
            title: "Test",
            url: "https://example.com/1",
            content_html: "<p>Some content</p>",
          },
        ],
      };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT);
      // content should be in metadataJson.content, not at top level
      expect(items[0]).not.toHaveProperty("content");
      expect(items[0]?.metadataJson).toContain("content");
    });
  });

  describe("filterContext", () => {
    test("populates filterContext from fourth parameter", () => {
      const payload = {
        version: "https://jsonfeed.org/version/1.1",
        items: [{ id: "1", title: "Test", url: "https://example.com/1" }],
      };
      const filterContext = { topicIds: ["topic-1"], mustInclude: ["AI"], exclude: ["spam"] };
      const items = parseJsonFeedItems(payload, "json-1", JOB_STARTED_AT, filterContext);
      expect(items[0]?.filterContext).toEqual(filterContext);
    });
  });
});
