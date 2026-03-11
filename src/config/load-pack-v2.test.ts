import { describe, expect, test } from "bun:test";
import { validateInlineSource, validateSourcePackV2 } from "./load-pack-v2";
import type { InlineSource, SourcePackV2 } from "../types/index";

describe("validateInlineSource", () => {
  test("validates required fields", () => {
    const input = {
      type: "rss",
      url: "https://example.com/feed.xml",
    };
    const result = validateInlineSource(input);
    expect(result.type).toBe("rss");
    expect(result.url).toBe("https://example.com/feed.xml");
    expect(result.enabled).toBe(true);
  });

  test("preserves optional fields", () => {
    const input = {
      type: "rss",
      url: "https://example.com/feed.xml",
      description: "Example feed",
      enabled: false,
    };
    const result = validateInlineSource(input);
    expect(result.description).toBe("Example feed");
    expect(result.enabled).toBe(false);
  });

  test("throws on missing type", () => {
    expect(() => validateInlineSource({ url: "https://example.com" })).toThrow();
  });

  test("throws on missing url", () => {
    expect(() => validateInlineSource({ type: "rss" })).toThrow();
  });

  test("throws on invalid type", () => {
    expect(() => validateInlineSource({ type: "invalid", url: "https://example.com" })).toThrow();
  });
});

describe("validateSourcePackV2", () => {
  test("validates required fields", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
      },
      sources: [
        { type: "rss", url: "https://example.com/feed.xml" },
      ],
    };
    const result = validateSourcePackV2(input);
    expect(result.id).toBe("test-pack");
    expect(result.name).toBe("Test Pack");
    expect(result.sources).toHaveLength(1);
  });

  test("preserves optional fields", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        description: "A test pack",
        keywords: ["test", "example"],
      },
      sources: [],
    };
    const result = validateSourcePackV2(input);
    expect(result.description).toBe("A test pack");
    expect(result.keywords).toEqual(["test", "example"]);
  });

  test("throws on missing pack.id", () => {
    expect(() => validateSourcePackV2({ pack: { name: "Test" }, sources: [] })).toThrow();
  });

  test("throws on missing pack.name", () => {
    expect(() => validateSourcePackV2({ pack: { id: "test" }, sources: [] })).toThrow();
  });
});
