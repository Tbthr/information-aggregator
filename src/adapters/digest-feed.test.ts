import { describe, expect, test } from "bun:test";

import { collectDigestFeedSource, parseDigestFeedItems } from "./digest-feed";

describe("parseDigestFeedItems", () => {
  describe("基本解析", () => {
    test("extracts digest entries and preserves linked canonical url hints", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Digest Entry</title>
            <link>https://digest.example/1</link>
            <description><![CDATA[Read <a href="https://example.com/article">full article</a>]]></description>
          </item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(1);
      expect(items[0]?.url).toBe("https://digest.example/1");
      expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
        provider: "digest_feed",
        sourceType: "digest_feed",
        contentType: "digest_entry",
        canonicalHints: {
          linkedUrl: "https://example.com/article",
        },
      });
    });

    test("extracts snippet from description", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Digest Entry</title>
            <link>https://digest.example/1</link>
            <description>This is a <b>digest</b> entry with formatting.</description>
          </item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(1);
      // 现在会正确处理多个空格
      expect(items[0]?.snippet).toBe("This is a digest entry with formatting.");
    });

    test("handles multiple items", () => {
      const xml = `
        <rss><channel>
          <item><title>Digest 1</title><link>https://example.com/1</link></item>
          <item><title>Digest 2</title><link>https://example.com/2</link></item>
          <item><title>Digest 3</title><link>https://example.com/3</link></item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(3);
      expect(items[0]?.title).toBe("Digest 1");
      expect(items[1]?.title).toBe("Digest 2");
      expect(items[2]?.title).toBe("Digest 3");
    });

    test("filters out items with empty urls", () => {
      const xml = `
        <rss><channel>
          <item><title>Digest 1</title><link>https://example.com/1</link></item>
          <item><title>No Link</title></item>
          <item><title>Digest 2</title><link>https://example.com/2</link></item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(2);
      expect(items[0]?.url).toBe("https://example.com/1");
      expect(items[1]?.url).toBe("https://example.com/2");
    });
  });

  describe("时间字段提取", () => {
    test("extracts publishedAt from pubDate", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Digest Entry</title>
            <link>https://digest.example/1</link>
            <pubDate>Mon, 12 Jan 2026 10:30:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(1);
      expect(items[0]?.publishedAt).toBe("2026-01-12T10:30:00.000Z");
    });

    test("handles missing pubDate gracefully", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Digest Entry</title>
            <link>https://digest.example/1</link>
          </item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(1);
      expect(items[0]?.publishedAt).toBeUndefined();
    });

    test("handles invalid pubDate gracefully", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Digest Entry</title>
            <link>https://digest.example/1</link>
            <pubDate>Invalid Date String</pubDate>
          </item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      expect(items).toHaveLength(1);
      expect(items[0]?.publishedAt).toBeUndefined();
    });
  });

  describe("JSON 解析", () => {
    test("collects json digest payloads from digest arrays", async () => {
      const fetchImpl = (async () =>
        new Response(
          JSON.stringify({
            user: {
              name: "Kevin He",
              slug: "kevin",
            },
            digests: [
              {
                id: 165,
                type: "4h",
                content: "Digest summary with https://example.com/article inside",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as unknown as typeof fetch;

      const items = await collectDigestFeedSource(
        {
          id: "digest-source",
          type: "digest_feed",
          enabled: true,
          url: "https://clawfeed.kevinhe.io/feed/kevin",
          configJson: JSON.stringify({
            format: "json",
            itemPath: "digests",
            contentField: "content",
          }),
        },
        fetchImpl,
      );

      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe("Digest 165");
      expect(items[0]?.url).toBe("https://example.com/article");
      expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
        provider: "digest_feed",
        sourceType: "digest_feed",
        contentType: "digest_entry",
        canonicalHints: {
          linkedUrl: "https://example.com/article",
        },
      });
    });

    test("extracts publishedAt from JSON with various field names", async () => {
      const fetchImpl = (async () =>
        new Response(
          JSON.stringify({
            digests: [
              {
                id: 1,
                content: "Digest with https://example.com/article",
                publishedAt: "2026-01-12T10:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as unknown as typeof fetch;

      const items = await collectDigestFeedSource(
        {
          id: "digest-source",
          type: "digest_feed",
          enabled: true,
          url: "https://example.com/feed",
          configJson: JSON.stringify({ format: "json" }),
        },
        fetchImpl,
      );

      expect(items).toHaveLength(1);
      expect(items[0]?.publishedAt).toBe("2026-01-12T10:00:00.000Z");
    });

    test("tries alternative date field names in JSON", async () => {
      const fetchImpl = (async () =>
        new Response(
          JSON.stringify({
            digests: [
              {
                id: 1,
                content: "Digest with https://example.com/article",
                created_at: "2026-01-12T08:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as unknown as typeof fetch;

      const items = await collectDigestFeedSource(
        {
          id: "digest-source",
          type: "digest_feed",
          enabled: true,
          url: "https://example.com/feed",
          configJson: JSON.stringify({ format: "json" }),
        },
        fetchImpl,
      );

      expect(items).toHaveLength(1);
      expect(items[0]?.publishedAt).toBe("2026-01-12T08:00:00.000Z");
    });
  });

  describe("健壮性", () => {
    test("handles malformed item without crashing", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Valid Item</title>
            <link>https://example.com/valid</link>
          </item>
          <item>
            Malformed content without proper tags
          </item>
        </channel></rss>
      `;

      const items = parseDigestFeedItems(xml, "digest-source");

      // 第二个 item 没有 link，应该被过滤掉
      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe("Valid Item");
    });
  });
});

describe("collectDigestFeedSource", () => {
  describe("错误处理", () => {
    test("throws on empty URL", async () => {
      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: undefined,
      };

      await expect(collectDigestFeedSource(source)).rejects.toThrow("requires a URL");
    });

    test("throws on non-OK response", async () => {
      const mockFetch = async () =>
        new Response("Not Found", { status: 404, statusText: "Not Found" });

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
      };

      await expect(collectDigestFeedSource(source, mockFetch as typeof fetch)).rejects.toThrow(
        "404: Not Found",
      );
    });

    test("throws on empty response", async () => {
      const mockFetch = async () =>
        new Response("", { status: 200, headers: { "content-type": "text/xml" } });

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
      };

      await expect(collectDigestFeedSource(source, mockFetch as typeof fetch)).rejects.toThrow(
        "empty response",
      );
    });

    test("throws when XML structure changed", async () => {
      const mockFetch = async () =>
        new Response("<html><body>No items here</body></html>", {
          status: 200,
          headers: { "content-type": "text/xml" },
        });

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
      };

      await expect(collectDigestFeedSource(source, mockFetch as typeof fetch)).rejects.toThrow(
        "no <item> elements found",
      );
    });

    test("throws on JSON parse error", async () => {
      const mockFetch = async () =>
        new Response("Invalid JSON {{{", {
          status: 200,
          headers: { "content-type": "application/json" },
        });

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
        configJson: JSON.stringify({ format: "json" }),
      };

      await expect(collectDigestFeedSource(source, mockFetch as typeof fetch)).rejects.toThrow(
        "Failed to parse",
      );
    });

    test("throws when JSON itemPath does not resolve to array", async () => {
      const mockFetch = async () =>
        new Response(
          JSON.stringify({
            digests: "not an array",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
        configJson: JSON.stringify({ format: "json", itemPath: "digests" }),
      };

      await expect(collectDigestFeedSource(source, mockFetch as typeof fetch)).rejects.toThrow(
        "requires config.itemPath to resolve to an array",
      );
    });
  });

  describe("正常流程", () => {
    test("successfully parses valid XML response", async () => {
      const mockFetch = async () =>
        new Response(
          `
          <rss><channel>
            <item>
              <title>Test Digest</title>
              <link>https://example.com/article</link>
            </item>
          </channel></rss>
        `,
          { status: 200, headers: { "content-type": "text/xml" } },
        );

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
      };

      const items = await collectDigestFeedSource(source, mockFetch as typeof fetch);

      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe("Test Digest");
      expect(items[0]?.url).toBe("https://example.com/article");
    });

    test("auto-detects JSON format from content type", async () => {
      const mockFetch = async () =>
        new Response(
          JSON.stringify({
            digests: [
              {
                id: 1,
                content: "Auto-detected JSON with https://example.com/article",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );

      const source = {
        id: "digest-source",
        type: "digest_feed" as const,
        enabled: true,
        url: "https://example.com/feed",
        // No format config, should auto-detect from content type
        configJson: JSON.stringify({}),
      };

      const items = await collectDigestFeedSource(source, mockFetch as typeof fetch);

      expect(items).toHaveLength(1);
      expect(items[0]?.url).toBe("https://example.com/article");
    });
  });
});
