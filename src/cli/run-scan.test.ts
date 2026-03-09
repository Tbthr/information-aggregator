import { describe, expect, test } from "bun:test";
import { createDb } from "../db/client";
import { runScan } from "./run-scan";
import type { Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";

const testSources: Source[] = [
  { id: "rss-1", name: "One", type: "rss", enabled: true, configJson: "{}" },
  { id: "rss-2", name: "Two", type: "rss", enabled: false, configJson: "{}" },
  { id: "rss-3", name: "Three", type: "rss", enabled: true, configJson: "{}" },
];

const testProfiles: TopicProfile[] = [
  {
    id: "default",
    name: "Default",
    mode: "scan",
    topicIds: ["ai-news"],
    sourcePackIds: ["pack-a"],
  },
];

const testTopics: TopicDefinition[] = [
  { id: "ai-news", name: "AI News", keywords: ["ai", "model"] },
];

const testSourcePacks: SourcePack[] = [
  { id: "pack-a", name: "Pack A", sourceIds: ["rss-1", "rss-2"] },
];

describe("runScan", () => {
  test("returns markdown output for scan mode", async () => {
    const result = await runScan(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        collectSources: async () => [],
      },
    );
    expect(typeof result.markdown).toBe("string");
  });

  test("resolves profile packs before collection", async () => {
    let collectedSourceIds: string[] = [];

    await runScan(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        loadSources: async () => testSources,
        loadProfiles: async () => testProfiles,
        loadTopics: async () => testTopics,
        loadSourcePacks: async () => testSourcePacks,
        collectSources: async (sources) => {
          collectedSourceIds = sources.map((source) => source.id);
          return [];
        },
      },
    );

    expect(collectedSourceIds).toEqual(["rss-1"]);
  });

  test("persists raw items, normalized items, and output when not dry-run", async () => {
    const db = createDb(":memory:");

    const result = await runScan(
      {
        profileId: "default",
        dryRun: false,
      },
      {
        db,
        now: () => "2026-03-09T00:00:00Z",
        loadSources: async () => testSources,
        loadProfiles: async () => testProfiles,
        loadTopics: async () => testTopics,
        loadSourcePacks: async () => testSourcePacks,
        collectSources: async () => [
          {
            id: "raw-1",
            sourceId: "rss-1",
            title: "AI model release",
            url: "https://example.com/post",
            fetchedAt: "2026-03-09T00:00:00Z",
            metadataJson: "{}",
          },
        ],
      },
    );

    const rawCount = db.prepare("SELECT COUNT(*) AS count FROM raw_items").get() as { count: number };
    const normalizedCount = db.prepare("SELECT COUNT(*) AS count FROM normalized_items").get() as { count: number };
    const outputCount = db.prepare("SELECT COUNT(*) AS count FROM outputs").get() as { count: number };

    expect(typeof result.markdown).toBe("string");
    expect(rawCount.count).toBe(1);
    expect(normalizedCount.count).toBe(1);
    expect(outputCount.count).toBe(1);
  });
});
