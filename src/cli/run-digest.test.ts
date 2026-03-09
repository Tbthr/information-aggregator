import { describe, expect, test } from "bun:test";
import { createDb } from "../db/client";
import { runDigest } from "./run-digest";
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
    mode: "digest",
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

describe("runDigest", () => {
  test("returns markdown output for digest mode", async () => {
    const result = await runDigest(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        collectSources: async () => [],
        buildClusters: () => [],
      },
    );
    expect(typeof result.markdown).toBe("string");
  });

  test("resolves profile packs before digest collection", async () => {
    let collectedSourceIds: string[] = [];

    await runDigest(
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
        buildClusters: () => [],
      },
    );

    expect(collectedSourceIds).toEqual(["rss-1"]);
  });

  test("persists raw items, normalized items, clusters, and output when not dry-run", async () => {
    const db = createDb(":memory:");

    const result = await runDigest(
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
    const clusterCount = db.prepare("SELECT COUNT(*) AS count FROM clusters").get() as { count: number };
    const outputCount = db.prepare("SELECT COUNT(*) AS count FROM outputs").get() as { count: number };

    expect(typeof result.markdown).toBe("string");
    expect(rawCount.count).toBe(1);
    expect(normalizedCount.count).toBe(1);
    expect(clusterCount.count).toBe(1);
    expect(outputCount.count).toBe(1);
  });

  test("uses ai scoring and summaries only after candidate reduction", async () => {
    let scoreCalls = 0;
    let summaryCalls = 0;
    let narrationCalls = 0;

    const result = await runDigest(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        aiClient: {
          scoreCandidate: async () => {
            scoreCalls += 1;
            return 0.9;
          },
          summarizeCluster: async () => {
            summaryCalls += 1;
            return "AI summary";
          },
          narrateDigest: async () => {
            narrationCalls += 1;
            return "AI narration";
          },
        },
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

    expect(typeof result.markdown).toBe("string");
    expect(result.markdown).toContain("AI narration");
    expect(result.markdown).toContain("AI summary");
    expect(scoreCalls).toBe(1);
    expect(summaryCalls).toBe(1);
    expect(narrationCalls).toBe(1);
  });

  test("keeps only items published within the last 24 hours", async () => {
    const result = await runDigest(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        now: () => "2026-03-09T12:00:00Z",
        loadSources: async () => testSources,
        loadProfiles: async () => testProfiles,
        loadTopics: async () => testTopics,
        loadSourcePacks: async () => testSourcePacks,
        collectSources: async () => [
          {
            id: "raw-new",
            sourceId: "rss-1",
            title: "Fresh AI release",
            url: "https://example.com/fresh",
            publishedAt: "2026-03-09T08:00:00Z",
            fetchedAt: "2026-03-09T12:00:00Z",
            metadataJson: "{}",
          },
          {
            id: "raw-old",
            sourceId: "rss-1",
            title: "Old AI release",
            url: "https://example.com/old",
            publishedAt: "2026-03-08T11:59:59Z",
            fetchedAt: "2026-03-09T12:00:00Z",
            metadataJson: "{}",
          },
        ],
      },
    );

    expect(result.markdown).toContain("Fresh AI release");
    expect(result.markdown).not.toContain("Old AI release");
  });

  test("falls back to fetchedAt when publishedAt is missing", async () => {
    const result = await runDigest(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        now: () => "2026-03-09T12:00:00Z",
        loadSources: async () => testSources,
        loadProfiles: async () => testProfiles,
        loadTopics: async () => testTopics,
        loadSourcePacks: async () => testSourcePacks,
        collectSources: async () => [
          {
            id: "raw-fallback",
            sourceId: "rss-1",
            title: "Fallback item",
            url: "https://example.com/fallback",
            fetchedAt: "2026-03-09T11:00:00Z",
            metadataJson: "{}",
          },
          {
            id: "raw-stale-fallback",
            sourceId: "rss-1",
            title: "Stale fallback item",
            url: "https://example.com/stale-fallback",
            fetchedAt: "2026-03-08T10:00:00Z",
            metadataJson: "{}",
          },
        ],
      },
    );

    expect(result.markdown).toContain("Fallback item");
    expect(result.markdown).not.toContain("Stale fallback item");
  });
});
