import { describe, expect, test } from "bun:test";
import { normalizeTitle, normalizeSummary, normalizeContent, normalizeWhitespace } from "./normalize-text";

describe("normalizeTitle", () => {
  test("removes RT @xxx: prefix", () => {
    expect(normalizeTitle("RT @user: This is a tweet")).toBe("this is a tweet");
  });

  test("removes trailing | SiteName pattern", () => {
    expect(normalizeTitle("Article Title | SiteName")).toBe("article title");
  });

  test("removes trailing | Site Name with spaces", () => {
    expect(normalizeTitle("Article Title | Example Site")).toBe("article title");
  });

  test("removes multiple pipe patterns", () => {
    expect(normalizeTitle("Title | Site | Another")).toBe("title");
  });

  test("removes punctuation", () => {
    expect(normalizeTitle("What's New in Tech!?")).toBe("whats new in tech");
  });

  test("collapses whitespace", () => {
    expect(normalizeTitle("  Hello   World  ")).toBe("hello world");
  });

  test("lowercases text", () => {
    expect(normalizeTitle("UPPERCASE TITLE")).toBe("uppercase title");
  });

  test("handles combined cases", () => {
    expect(normalizeTitle("RT @elonmusk: SpaceX Launch | Space News!")).toBe("spacex launch");
  });
});

describe("normalizeSummary", () => {
  test("removes HTML tags", () => {
    expect(normalizeSummary("This is <b>bold</b> text")).toBe("this is bold text");
  });

  test("decodes HTML entities", () => {
    expect(normalizeSummary("Hello &amp; goodbye &lt;world&gt;")).toBe("hello & goodbye <world>");
  });

  test("compresses whitespace", () => {
    expect(normalizeSummary("Hello    world   test")).toBe("hello world test");
  });

  test("trims whitespace", () => {
    expect(normalizeSummary("  Hello world  ")).toBe("hello world");
  });

  test("lowercases text", () => {
    expect(normalizeSummary("UPPERCASE TEXT")).toBe("uppercase text");
  });

  test("preserves sentence structure and punctuation", () => {
    expect(normalizeSummary("This is important! Or is it?")).toBe("this is important! or is it?");
  });

  test("handles empty string", () => {
    expect(normalizeSummary("")).toBe("");
  });
});

describe("normalizeContent", () => {
  test("removes HTML tags", () => {
    expect(normalizeContent("This is <b>bold</b> text")).toBe("this is bold text");
  });

  test("decodes HTML entities", () => {
    expect(normalizeContent("Hello &amp; goodbye &lt;world&gt;")).toBe("hello & goodbye <world>");
  });

  test("compresses whitespace", () => {
    expect(normalizeContent("Hello    world   test")).toBe("hello world test");
  });

  test("truncates to 500 characters", () => {
    const longContent = "A".repeat(600);
    expect(normalizeContent(longContent).length).toBe(500);
    expect(normalizeContent(longContent).endsWith("...")).toBe(true);
  });

  test("does not truncate content under 500 chars", () => {
    const shortContent = "A".repeat(400);
    expect(normalizeContent(shortContent).length).toBe(400);
  });

  test("preserves sentence structure", () => {
    expect(normalizeContent("First sentence. Second sentence! Third?")).toBe("first sentence. second sentence! third?");
  });
});

describe("normalizeWhitespace", () => {
  test("trims and collapses whitespace", () => {
    expect(normalizeWhitespace("  Hello   World  ")).toBe("Hello World");
  });
});
