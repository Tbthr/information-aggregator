import { describe, expect, test } from "bun:test";
import { discoverFeedUrl } from "./website";

describe("discoverFeedUrl", () => {
  test("finds alternate rss links in html", () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
      </head></html>
    `;
    expect(discoverFeedUrl("https://example.com", html)).toBe("https://example.com/feed.xml");
  });
});
