import { describe, expect, test } from "bun:test";
import { discoverFeedUrl } from "./feed-discovery";

describe("feed-discovery", () => {
  test("discoverFeedUrl finds RSS feed from link tag", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        </head>
      </html>
    `;
    expect(discoverFeedUrl("https://example.com", html)).toBe("https://example.com/feed.xml");
  });

  test("discoverFeedUrl finds Atom feed from link tag", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/atom+xml" href="/atom.xml">
        </head>
      </html>
    `;
    expect(discoverFeedUrl("https://example.com", html)).toBe("https://example.com/atom.xml");
  });

  test("discoverFeedUrl handles absolute URLs", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="https://cdn.example.com/feed.xml">
        </head>
      </html>
    `;
    expect(discoverFeedUrl("https://example.com", html)).toBe("https://cdn.example.com/feed.xml");
  });

  test("discoverFeedUrl returns null when no feed found", () => {
    const html = `
      <html>
        <head>
          <title>No Feed Here</title>
        </head>
      </html>
    `;
    expect(discoverFeedUrl("https://example.com", html)).toBeNull();
  });
});
