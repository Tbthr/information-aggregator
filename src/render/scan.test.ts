import { describe, expect, test } from "bun:test";
import { renderScanMarkdown } from "./scan";

describe("renderScanMarkdown", () => {
  test("renders a ranked list of results", () => {
    const markdown = renderScanMarkdown([
      { title: "Hello", url: "https://example.com", finalScore: 0.9, sourceName: "Example" },
    ]);
    expect(markdown).toContain("Hello");
    expect(markdown).toContain("https://example.com");
  });
});
