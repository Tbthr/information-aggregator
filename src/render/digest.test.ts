import { describe, expect, test } from "bun:test";
import { renderDigestMarkdown } from "./digest";

describe("renderDigestMarkdown", () => {
  test("renders highlights and filters placeholder summaries", () => {
    const markdown = renderDigestMarkdown({
      narration: "AI narration",
      highlights: ["Top trend"],
      clusters: [
        { title: "New model released", summary: "This is a real summary", url: "https://example.com" },
        { title: "Placeholder item", summary: "Why it matters", url: "https://example.com/placeholder" },
      ],
    });
    expect(markdown).toContain("AI narration");
    expect(markdown).toContain("Top trend");
    expect(markdown).toContain("New model released");
    expect(markdown).toContain("This is a real summary");
    // "Why it matters" 占位符应该被过滤掉
    expect(markdown).not.toContain("Why it matters");
    expect(markdown).not.toContain("Placeholder item");
  });

  test("renders aiHighlights section when provided", () => {
    const markdown = renderDigestMarkdown({
      highlights: ["Top trend"],
      clusters: [],
      aiHighlights: {
        summary: "AI generated summary",
        trends: ["trend1", "trend2"],
        generatedAt: "2024-01-01T00:00:00Z",
      },
    });
    expect(markdown).toContain("## 今日看点");
    expect(markdown).toContain("AI generated summary");
    expect(markdown).toContain("trend1");
    expect(markdown).toContain("trend2");
  });
});
