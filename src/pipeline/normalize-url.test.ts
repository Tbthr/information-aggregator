import { describe, expect, test } from "bun:test";
import { normalizeUrl } from "./normalize-url";

describe("normalizeUrl", () => {
  test("domain lowercase", () => {
    expect(normalizeUrl("https://EXAMPLE.COM/post")).toBe("https://example.com/post");
  });

  test("strips www. prefix", () => {
    expect(normalizeUrl("https://www.example.com/post")).toBe("https://example.com/post");
  });

  test("strips fragment", () => {
    expect(normalizeUrl("https://example.com/post#section")).toBe("https://example.com/post");
  });

  test("removes tracking parameters", () => {
    expect(normalizeUrl("https://example.com/post?utm_source=x&ref=test&id=1")).toBe("https://example.com/post?id=1");
  });

  test("removes fbclid", () => {
    expect(normalizeUrl("https://example.com/post?fbclid=abc123")).toBe("https://example.com/post");
  });

  test("removes gclid", () => {
    expect(normalizeUrl("https://example.com/post?gclid=xyz789")).toBe("https://example.com/post");
  });

  test("normalizes trailing slash", () => {
    expect(normalizeUrl("https://example.com/post/")).toBe("https://example.com/post");
  });

  test("normalizes twitter to x.com", () => {
    expect(normalizeUrl("https://twitter.com/openai/status/123?utm_source=x")).toBe("https://x.com/openai/status/123");
  });

  test("preserves pathname case after domain", () => {
    expect(normalizeUrl("https://example.com/Some/Path/Here")).toBe("https://example.com/Some/Path/Here");
  });
});
