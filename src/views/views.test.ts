import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { buildViewModel, renderViewMarkdown } from "./registry";

const queryResult = {
  args: {
    packIds: ["ai-news"],
    viewId: "daily-brief",
    window: "24h",
  },
  selection: {
    packIds: ["ai-news"],
    viewId: "daily-brief",
    window: "24h",
    sources: [],
    keywords: ["ai", "news"],
  },
  items: [],
  normalizedItems: [],
  rankedItems: [
    {
      id: "item-1",
      title: "Fresh AI launch",
      url: "https://example.com/fresh",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 3.2,
    },
    {
      id: "item-2",
      title: "Second ranked item",
      url: "https://example.com/second",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 3.0,
    },
    {
      id: "item-3",
      title: "Third ranked item",
      url: "https://example.com/third",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 2.95,
    },
    {
      id: "item-4",
      title: "Thread sharing the launch",
      url: "https://x.com/example/status/2",
      linkedCanonicalUrl: "https://example.com/fresh",
      relationshipToCanonical: "share",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 2.9,
    },
  ],
  clusters: [],
  warnings: [],
} satisfies QueryResult;

describe("views", () => {
  test("daily-brief builds articles list without AI client", async () => {
    // 无 AI client 时，视图仍能正常构建
    const model = await buildViewModel(queryResult, "daily-brief");
    const markdown = renderViewMarkdown(model, "daily-brief");

    // 验证基本结构
    expect(model.viewId).toBe("daily-brief");
    expect(model.title).toBe("Daily Brief");

    // 无 AI client 时，summary 和 highlights 为空
    expect(model.summary).toBe("");
    expect(model.highlights).toEqual([]);

    // 应该有 articles section
    expect(model.sections.map((section) => section.title)).toContain("Articles");
    const articlesSection = model.sections.find((s) => s.title === "Articles");
    expect(articlesSection?.items).toHaveLength(4);
    expect(articlesSection?.items[0]?.title).toBe("Fresh AI launch");

    // 验证 markdown 渲染
    expect(markdown).toContain("# Daily Digest");
    expect(markdown).toContain("Fresh AI launch");
  });

  test("daily-brief markdown contains expected sections", async () => {
    const model = await buildViewModel(queryResult, "daily-brief");
    const markdown = renderViewMarkdown(model, "daily-brief");

    // 验证 markdown 结构
    expect(markdown).toContain("# Daily Digest");
    expect(markdown).toContain("## 精选文章");
  });
});
