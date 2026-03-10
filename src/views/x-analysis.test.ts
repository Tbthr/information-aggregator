import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { buildViewModel, renderViewMarkdown } from "./registry";

const queryResult = {
  query: { command: "run", viewId: "x-bookmarks-analysis", format: "markdown" },
  selection: {
    view: { id: "x-bookmarks-analysis", name: "X Bookmarks Analysis" },
    topicIds: [],
    sourceIds: ["x-bookmarks-1"],
    sources: [],
    window: "7d",
  },
  items: [],
  normalizedItems: [],
  rankedItems: [
    {
      id: "tweet-1",
      title: "Agents are reshaping workflows",
      url: "https://x.com/example/status/1",
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
  test("x-bookmarks-analysis summarizes themes and notable items", () => {
    const model = buildViewModel(queryResult, "x-bookmarks-analysis");
    const markdown = renderViewMarkdown(model, "x-bookmarks-analysis");

    expect(markdown).toContain("Summary");
    expect(markdown).toContain("Top Themes");
    expect(markdown).toContain("Notable Items");
  });

  test("x-likes-analysis summarizes interest signals", () => {
    const model = buildViewModel(
      {
        ...queryResult,
        query: { ...queryResult.query, viewId: "x-likes-analysis" },
        selection: {
          ...queryResult.selection,
          view: { id: "x-likes-analysis", name: "X Likes Analysis" },
        },
      },
      "x-likes-analysis",
    );
    const markdown = renderViewMarkdown(model, "x-likes-analysis");

    expect(markdown).toContain("Summary");
    expect(markdown).toContain("Top Themes");
    expect(markdown).toContain("Notable Items");
  });
});
