import { describe, expect, test } from "bun:test";

import type { QueryViewDefinition, Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";
import { runQuery } from "./run-query";

const testSources: Source[] = [
  { id: "rss-1", name: "One", type: "rss", enabled: true, configJson: "{}" },
];

const testProfiles: TopicProfile[] = [
  {
    id: "default",
    name: "Default",
    topicIds: ["ai-news"],
    sourcePackIds: ["pack-a"],
    defaultView: "daily-brief",
    defaultWindow: "24h",
  },
];

const testTopics: TopicDefinition[] = [
  { id: "ai-news", name: "AI News", keywords: ["ai", "model"] },
];

const testSourcePacks: SourcePack[] = [
  { id: "pack-a", name: "Pack A", sourceIds: ["rss-1"] },
];

const testViews: QueryViewDefinition[] = [
  { id: "daily-brief", name: "Daily Brief", defaultWindow: "24h", defaultSort: "ranked" },
];

describe("runQuery", () => {
  test("runs collect -> normalize -> dedupe -> rank with query-layer time filtering", async () => {
    const result = await runQuery(
      {
        command: "run",
        viewId: "daily-brief",
        format: "markdown",
      },
      {
        now: () => "2026-03-09T12:00:00Z",
        loadSources: async () => testSources,
        loadProfiles: async () => testProfiles,
        loadTopics: async () => testTopics,
        loadSourcePacks: async () => testSourcePacks,
        loadViews: async () => testViews,
        collectSources: async () => [
          {
            id: "fresh",
            sourceId: "rss-1",
            title: "Fresh AI model release",
            url: "https://example.com/fresh",
            publishedAt: "2026-03-09T11:00:00Z",
            fetchedAt: "2026-03-09T11:00:00Z",
            metadataJson: "{}",
          },
          {
            id: "stale",
            sourceId: "rss-1",
            title: "Old AI model release",
            url: "https://example.com/stale",
            publishedAt: "2026-03-08T10:00:00Z",
            fetchedAt: "2026-03-08T10:00:00Z",
            metadataJson: "{}",
          },
        ],
      },
    );

    expect(result.items.map((item) => item.id)).toEqual(["fresh"]);
    expect(result.rankedItems).toHaveLength(1);
    expect(result.clusters).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});
