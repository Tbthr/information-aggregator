import { describe, expect, test } from "bun:test";
import { renderDigestMarkdown } from "./digest";

describe("renderDigestMarkdown", () => {
  test("renders top sections and grouped highlights", () => {
    const markdown = renderDigestMarkdown({
      highlights: ["Top trend"],
      clusters: [{ title: "New model released", summary: "Why it matters", url: "https://example.com" }],
    });
    expect(markdown).toContain("Top trend");
    expect(markdown).toContain("New model released");
  });
});
