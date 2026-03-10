import { describe, expect, test } from "bun:test";
import { parseRssItems } from "./rss";

describe("parseRssItems", () => {
  test("extracts title and link from RSS items", () => {
    const xml = `
      <rss><channel>
        <item><title>Hello</title><link>https://example.com/1</link></item>
      </channel></rss>
    `;
    const items = parseRssItems(xml, "rss-1");
    expect(items[0]?.title).toBe("Hello");
  });

  test("extracts pubDate as publishedAt from RSS items", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Hello</title>
          <link>https://example.com/1</link>
          <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;

    const items = parseRssItems(xml, "rss-1");

    expect(items[0]?.publishedAt).toBe("Mon, 09 Mar 2026 08:00:00 GMT");
  });

  test("emits stable collector metadata", () => {
    const xml = `
      <rss><channel>
        <item><title>Hello</title><link>https://example.com/1</link></item>
      </channel></rss>
    `;

    const items = parseRssItems(xml, "rss-1");

    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "rss",
      sourceType: "rss",
      contentType: "article",
    });
  });

  test("extracts published as publishedAt from Atom entries", () => {
    const xml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Hello Atom</title>
          <link href="https://example.com/atom-1" />
          <published>2026-03-09T08:00:00Z</published>
        </entry>
      </feed>
    `;

    const items = parseRssItems(xml, "rss-1");

    expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00Z");
  });
});
