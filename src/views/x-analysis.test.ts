import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { buildViewModel, renderViewMarkdown } from "./registry";

const queryResult = {
  args: {
    packIds: ["x-bookmarks"],
    viewId: "x-bookmarks-analysis",
    window: "7d",
  },
  selection: {
    packIds: ["x-bookmarks"],
    viewId: "x-bookmarks-analysis",
    window: "7d",
    sources: [],
    keywords: [],
  },
  items: [],
  normalizedItems: [],
  rankedItems: [
    {
      id: "tweet-1",
      title: "Agents are reshaping workflows",
      url: "https://x.com/example/status/1",
      linkedCanonicalUrl: "https://example.com/article",
      relationshipToCanonical: "share",
      sourceId: "x-bookmarks-1",
      normalizedText: "agents workflow agents workflow",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.8,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 3.5,
    },
  ],
  clusters: [],
  warnings: [],
} satisfies QueryResult;

describe("x analysis views", () => {
  test("x-bookmarks-analysis summarizes themes and notable items", async () => {
    const model = await buildViewModel(queryResult, "x-bookmarks-analysis");
    const markdown = renderViewMarkdown(model, "x-bookmarks-analysis");

    expect(markdown).toContain("Summary");
    expect(markdown).toContain("Top Themes");
    expect(markdown).toContain("Notable Items");
    expect(markdown).toContain("https://example.com/article");
    expect(markdown).toContain("linked article");
  });

  test("x-bookmarks-analysis keeps mixed Chinese and English themes readable", async () => {
    const model = await buildViewModel(
      {
        ...queryResult,
        rankedItems: [
          {
            ...queryResult.rankedItems[0],
            title: "高质量长文，推荐阅读。这文章只有长期使用 AI 和本身有很好写作功底的才写的出来。",
            normalizedTitle: "高质量长文，推荐阅读。这文章只有长期使用 ai 和本身有很好写作功底的才写的出来。",
            normalizedText: "高质量长文，推荐阅读。这文章只有长期使用 ai 和本身有很好写作功底的才写的出来。 人文工作者如果用好 ai 跟程序员用 ai 一样可以极大的放大自身能力。",
          },
        ],
      },
      "x-bookmarks-analysis",
    );

    const topThemes = model.sections.find((section) => section.title === "Top Themes");

    expect(topThemes?.items[0]?.title).toBe("高质量长文，推荐阅读。这文章只有长期使用...");
    expect(topThemes?.items[0]?.title.includes("使用 ai 和本身")).toBe(false);
  });

  test("x-likes-analysis summarizes interest signals", async () => {
    const model = await buildViewModel(
      {
        ...queryResult,
        args: { ...queryResult.args, viewId: "x-likes-analysis" },
        selection: { ...queryResult.selection, viewId: "x-likes-analysis" },
      },
      "x-likes-analysis",
    );
    const markdown = renderViewMarkdown(model, "x-likes-analysis");

    expect(markdown).toContain("Summary");
    expect(markdown).toContain("Top Themes");
    expect(markdown).toContain("Notable Items");
    expect(markdown).toContain("https://example.com/article");
    expect(markdown).toContain("linked article");
  });
});
