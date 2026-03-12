import { describe, expect, test } from "bun:test";

import { collectDigestFeedSource, parseDigestFeedItems } from "./digest-feed";

describe("parseDigestFeedItems", () => {
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
        { headers: { "content-type": "application/json" } },
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
});
