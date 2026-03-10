import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { buildViewModel, renderViewMarkdown } from "./registry";

describe("x-longform-hot", () => {
  test("ranks long posts and linked articles and renders the expected sections", () => {
    const model = buildViewModel(
      {
        query: { command: "run", viewId: "x-longform-hot", format: "markdown", window: "all" },
        selection: {
          view: { id: "x-longform-hot", name: "X Longform Hot", defaultWindow: "all", defaultSourceTypes: ["x_home"] },
          topicIds: [],
          sourceIds: ["x-home-1"],
          sources: [],
          window: "all",
        },
        items: [],
        normalizedItems: [],
        rankedItems: [
          {
            id: "tweet-1",
            title: "An in-depth thread about agent orchestration and evaluation",
            url: "https://x.com/example/status/1",
            canonicalUrl: "https://example.com/article",
            linkedCanonicalUrl: "https://example.com/article",
            relationshipToCanonical: "share",
            normalizedText: "in depth thread about agent orchestration and evaluation with link",
            engagementScore: 0.9,
            sourceWeightScore: 1,
            freshnessScore: 1,
            topicMatchScore: 1,
            contentQualityAi: 0,
            finalScore: 4.2,
          },
        ],
        clusters: [
          {
            id: "cluster-1",
            canonicalItemId: "tweet-1",
            memberItemIds: ["tweet-1"],
            dedupeMethod: "exact" as const,
            title: "Agent orchestration thread",
            url: "https://x.com/example/status/1",
            summary: "Longform thread",
          },
        ],
        warnings: [],
      } satisfies QueryResult,
      "x-longform-hot",
    );
    const markdown = renderViewMarkdown(model, "x-longform-hot");

    expect(markdown).toContain("Hot Posts");
    expect(markdown).toContain("Linked Articles");
    expect(markdown).toContain("Clusters");
    expect(markdown).toContain("[An in-depth thread about agent orchestration and evaluation](https://example.com/article)");
    expect(markdown).toContain("linked article");
  });
});
