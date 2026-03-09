import { describe, expect, test } from "bun:test";
import { normalizeItems } from "./normalize";

describe("normalizeItems", () => {
  test("produces normalized items with canonical url and normalized title", () => {
    const normalized = normalizeItems([
      {
        id: "raw-1",
        sourceId: "s1",
        title: " Hello World ",
        url: "https://example.com/post?utm_source=x",
        fetchedAt: "2026-03-09T00:00:00Z",
        metadataJson: "{}",
      },
    ]);
    expect(normalized[0]?.normalizedTitle).toBe("hello world");
    expect(normalized[0]?.canonicalUrl).toBe("https://example.com/post");
  });
});
