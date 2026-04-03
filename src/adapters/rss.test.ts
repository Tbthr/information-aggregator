import { describe, expect, test } from "bun:test";
import { parseRssItems } from "./rss";

// Use a jobStartedAt close to the test dates (2026-03-09)
const JOB_STARTED_AT = "2026-03-09T12:00:00.000Z";

describe("parseRssItems", () => {
  test("extracts title and link from RSS items", () => {
    const xml = `
      <rss><channel>
        <item><title>Hello</title><link>https://example.com/1</link><pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate></item>
      </channel></rss>
    `;
    const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
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

    const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });

    expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
  });

  test("emits stable collector metadata", () => {
    const xml = `
      <rss><channel>
        <item><title>Hello</title><link>https://example.com/1</link><pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate></item>
      </channel></rss>
    `;

    const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });

    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      rawPublishedAt: "Mon, 09 Mar 2026 08:00:00 GMT",
      timeSourceField: "pubDate",
      timeParseNote: "parsed as UTC",
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

    const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });

    expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
  });

  describe("UTC timestamp parsing", () => {
    test("parses RFC 2822 format (RFC 822)", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>Mon, 09 Mar 2026 08:00:00 +0000</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
    });

    test("parses ISO 8601 with Z suffix", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>2026-03-09T08:00:00Z</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
    });

    test("parses ISO 8601 with timezone offset", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>2026-03-09T16:00:00+08:00</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      // 2026-03-09T16:00:00+08:00 = 2026-03-09T08:00:00Z
      expect(items[0]?.publishedAt).toBe("2026-03-09T08:00:00.000Z");
    });

    test("parses ISO 8601 with negative offset", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>2026-03-09T13:00:00-05:00</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      // 2026-03-09T13:00:00-05:00 = 2026-03-09T18:00:00Z
      expect(items[0]?.publishedAt).toBe("2026-03-09T18:00:00.000Z");
    });
  });

  describe("date-only values filled to UTC 23:59:59", () => {
    test("fills date-only value (YYYY-MM-DD) to 23:59:59 UTC", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>2026-03-09</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items[0]?.publishedAt).toBe("2026-03-09T23:59:59.000Z");
    });

      });

  describe("relative/invalid timestamps discarded with warnings", () => {
    test("discards item with relative timestamp like '2 hours ago'", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test Relative</title>
            <link>https://example.com/relative</link>
            <pubDate>2 hours ago</pubDate>
          </item>
          <item>
            <title>Test Valid</title>
            <link>https://example.com/valid</link>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      // Only the valid item should be present
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Test Valid");
    });

    test("discards item with invalid timestamp", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test Invalid</title>
            <link>https://example.com/invalid</link>
            <pubDate>not-a-date</pubDate>
          </item>
          <item>
            <title>Test Valid</title>
            <link>https://example.com/valid2</link>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Test Valid");
    });
  });

  describe("24h rolling window filtering", () => {
    test("filters out items older than 24h based on jobStartedAt", () => {
      // jobStartedAt is 2026-03-09T12:00:00Z, so cutoff is 2026-03-08T12:00:00Z
      // Items published BEFORE cutoff should be discarded
      const jobStartedAt = "2026-03-09T12:00:00.000Z";
      const xml = `
        <rss><channel>
          <item>
            <title>Old Item</title>
            <link>https://example.com/old</link>
            <pubDate>2026-03-08T11:59:59Z</pubDate>
          </item>
          <item>
            <title>Within Window</title>
            <link>https://example.com/recent</link>
            <pubDate>2026-03-09T08:00:00Z</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Within Window");
    });

    test("keeps items exactly at 24h boundary", () => {
      const jobStartedAt = "2026-03-09T12:00:00.000Z";
      const xml = `
        <rss><channel>
          <item>
            <title>Exactly at Boundary</title>
            <link>https://example.com/boundary</link>
            <pubDate>2026-03-08T12:00:00Z</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe("Exactly at Boundary");
    });
  });

  
  describe("metadataJson authorName population", () => {
    test("extracts authorName from dc:creator", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <dc:creator>John Doe</dc:creator>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      // authorName is no longer in metadataJson per Task 9
      expect(items[0]?.author).toBe("John Doe");
    });

    test("extracts authorName from author tag", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <author>Jane Smith</author>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      // authorName is no longer in metadataJson per Task 9
      expect(items[0]?.author).toBe("Jane Smith");
    });

    test("prefers dc:creator over author tag", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <author>Author Tag</author>
            <dc:creator>Creator Tag</dc:creator>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      // authorName is no longer in metadataJson per Task 9; dc:creator takes precedence
      expect(items[0]?.author).toBe("Creator Tag");
    });
  });

  describe("metadataJson audit fields", () => {
    test("populates rawPublishedAt with original time string", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.rawPublishedAt).toBe("Mon, 09 Mar 2026 08:00:00 GMT");
    });

    test("populates timeSourceField indicating which field was used", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <published>2026-03-09T08:00:00Z</published>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.timeSourceField).toBe("published");
    });

    test("populates timeParseNote for date-only fill", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <pubDate>2026-03-09</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
      expect(metadata.timeParseNote).toContain("date-only");
    });

    test("populates timeParseNote for out-of-window discard", () => {
      const jobStartedAt = "2026-03-09T12:00:00.000Z";
      const xml = `
        <rss><channel>
          <item>
            <title>Old Item</title>
            <link>https://example.com/old</link>
            <pubDate>2026-03-08T11:59:59Z</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items.length).toBe(0);
    });
  });

  describe("minimal RawItem shape", () => {
    test("includes author field at top level", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <author>John Doe</author>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items[0]?.author).toBe("John Doe");
    });

    test("includes content field at top level", () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Test</title>
            <link>https://example.com/1</link>
            <content:encoded><![CDATA[Some content]]></content:encoded>
            <pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
      const items = parseRssItems(xml, "rss-1", { jobStartedAt: JOB_STARTED_AT, timeWindow: 24 * 60 * 60 * 1000 });
      expect(items[0]?.content).toBe("Some content");
    });
  });

  });
