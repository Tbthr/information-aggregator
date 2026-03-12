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
  clusters: [
    {
      id: "cluster-1",
      canonicalItemId: "item-1",
      memberItemIds: ["item-1"],
      dedupeMethod: "exact" as const,
      title: "Fresh AI launch",
      url: "https://example.com/fresh",
      summary: "Why it matters",
    },
  ],
  warnings: [],
} satisfies QueryResult;

describe("views", () => {
  test("daily-brief builds highlights and cluster sections and renders markdown", async () => {
    const model = await buildViewModel(queryResult, "daily-brief");
    const markdown = renderViewMarkdown(model, "daily-brief");

    expect(model.highlights).toEqual(["Fresh AI launch", "Second ranked item", "Third ranked item"]);
    expect(model.sections.map((section) => section.title)).toEqual(["Top Clusters", "Supporting Items"]);
    expect(markdown).toContain("# Daily Digest");
    expect(markdown).toContain("Fresh AI launch");
    expect(markdown).toContain("Why it matters");
    expect(model.sections[1]?.items[0]?.url).toBe("https://example.com/fresh");
    expect(model.sections[1]?.items[0]?.summary).toContain("linked article");
    expect(markdown).toContain("linked article");
  });
});
