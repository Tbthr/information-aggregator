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
});
