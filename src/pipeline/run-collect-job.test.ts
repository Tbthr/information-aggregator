import { describe, expect, test, mock } from "bun:test";

// Track archived items for verification
let archivedItems: Array<{
  id?: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  publishedAt: Date | null;
  fetchedAt: Date;
  author: string | null;
  summary: string | null;
  content: string | null;
  metadataJson: string | null;
  packId: string | null;
}> = [];

let archivedItemCount = 0;
let updatedItemCount = 0;

// Set up mocks BEFORE importing the module under test
mock.module("../lib/prisma", () => ({
  prisma: {
    pack: { findMany: async () => [], upsert: async () => ({}) },
    source: { findMany: async () => [], upsert: async () => ({}) },
    item: {
      findMany: async ({ where }: { where: { url: { in: string[] } } }) => {
        return archivedItems.filter((i) => where.url.in.includes(i.url)).map((i) => ({ id: i.id!, url: i.url }));
      },
      createMany: async ({ data }: { data: typeof archivedItems }) => {
        archivedItemCount += data.length;
        for (const item of data) {
          archivedItems.push({ ...item, id: `generated-${archivedItems.length}` });
        }
        return { count: data.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<typeof archivedItems[0]> }) => {
        updatedItemCount++;
        const idx = archivedItems.findIndex((i) => i.id === where.id);
        if (idx !== -1) {
          archivedItems[idx] = { ...archivedItems[idx], ...data };
        }
        return archivedItems[idx];
      },
    },
    sourceHealth: { upsert: async () => ({}) },
  },
}));

mock.module("../config/load-pack-prisma", () => ({
  loadAllPacksFromDb: async () => [],
}));

mock.module("../config/source-id", () => ({
  generateSourceId: (url: string) => url,
}));

mock.module("../adapters/build-adapters", () => ({
  buildAdapters: () => ({ rss: async () => [] }),
}));

mock.module("../ai/providers", () => ({
  createAiClient: () => null,
}));

mock.module("../archive/enrich-prisma", () => ({
  getItemsToEnrich: async () => [],
  enrichItems: async () => ({ successCount: 0, failCount: 0, totalCount: 0 }),
}));

// Import after mocks are set up
import { runCollectJob, type PipelineCounts, type ArchiveCounts, type SourceFailure } from "./run-collect-job";

describe("runCollectJob", () => {
  test("returns sourceEvents, counts, archived, and failures", async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const result = await runCollectJob({ logger: mockLogger });

    // Verify top-level shape
    expect(result).toHaveProperty("sourceEvents");
    expect(result).toHaveProperty("counts");
    expect(result).toHaveProperty("archived");
    expect(result).toHaveProperty("failures");

    // counts has all pipeline stage fields
    const c = result.counts as PipelineCounts;
    expect(typeof c.raw).toBe("number");
    expect(typeof c.normalized).toBe("number");
    expect(typeof c.afterExactDedup).toBe("number");
    expect(typeof c.afterNearDedup).toBe("number");
    expect(typeof c.archivedNew).toBe("number");
    expect(typeof c.archivedUpdated).toBe("number");

    // archived has new/update counts
    const a = result.archived as ArchiveCounts;
    expect(typeof a.newCount).toBe("number");
    expect(typeof a.updateCount).toBe("number");

    // failures is an array of SourceFailure
    expect(Array.isArray(result.failures)).toBe(true);
    for (const f of result.failures as SourceFailure[]) {
      expect(typeof f.sourceId).toBe("string");
      expect(typeof f.error).toBe("string");
    }
  });

  test("failed sources appear in failures result when adapter throws", async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // Provide a pack with a source and an adapter that throws
    const testPacks = [
      {
        id: "test-pack",
        name: "Test Pack",
        description: "Test",
        sources: [
          {
            id: "test-source",
            type: "rss" as const,
            url: "https://example.com/feed.xml",
            name: "Test Source",
            enabled: true,
          },
        ],
      },
    ];

    const result = await runCollectJob({
      logger: mockLogger,
      packs: testPacks,
      adapters: {
        rss: async () => {
          throw new Error("adapter error");
        },
      },
    });

    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0].error).toContain("adapter error");
  });

  test("github-trending sources are skipped without failure", async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // Provide a pack with a github-trending source
    const testPacks = [
      {
        id: "test-pack",
        name: "Test Pack",
        description: "Test",
        sources: [
          {
            id: "github-trending",
            type: "github-trending" as const,
            url: "https://github.com/trending",
            name: "GitHub Trending",
            enabled: true,
          },
        ],
      },
    ];

    // github-trending adapter throws when called
    const result = await runCollectJob({
      logger: mockLogger,
      packs: testPacks,
      adapters: {
        "github-trending": async () => {
          throw new Error("github-trending should be skipped");
        },
      },
    });

    // github-trending should NOT appear in failures - it should be skipped silently
    const githubTrendingFailures = result.failures.filter((f) => f.sourceId === "github-trending");
    expect(githubTrendingFailures).toHaveLength(0);

    // There should be no source events for github-trending either
    const githubTrendingEvents = result.sourceEvents.filter((e) => e.sourceId === "github-trending");
    expect(githubTrendingEvents).toHaveLength(0);
  });

  test("Item.url stores normalizedUrl not original url", async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    archivedItems = [];
    archivedItemCount = 0;

    const testPacks = [
      {
        id: "pack-1",
        name: "Pack 1",
        description: "Test",
        sources: [
          {
            id: "source-1",
            type: "rss" as const,
            url: "https://example.com/feed",
            name: "Source 1",
            enabled: true,
          },
        ],
      },
    ];

    await runCollectJob({
      logger: mockLogger,
      packs: testPacks,
      adapters: {
        rss: async () => [
          {
            id: "item-1",
            sourceId: "source-1",
            title: "Test Article",
            // URL has tracking params that should be normalized
            url: "https://example.com/article?utm_source=test&utm_medium=email",
            fetchedAt: "2026-03-09T00:00:00Z",
            metadataJson: JSON.stringify({
              sourceType: "rss",
              authorName: "Test Author",
            }),
            publishedAt: "2026-03-09T00:00:00Z",
          },
        ],
      },
    });

    // Verify the archived item has normalizedUrl (without tracking params)
    expect(archivedItems.length).toBeGreaterThan(0);
    const archived = archivedItems[0];
    expect(archived.url).not.toContain("utm_source");
    expect(archived.url).not.toContain("utm_medium");
    // normalizedUrl should strip these params
    expect(archived.url).toBe("https://example.com/article");
  });

  test("first-pack-wins semantics on conflicting URLs", async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    archivedItems = [];
    archivedItemCount = 0;
    updatedItemCount = 0;

    const testPacks = [
      {
        id: "pack-1",
        name: "Pack 1",
        description: "First pack",
        sources: [
          {
            id: "source-1",
            type: "rss" as const,
            url: "https://example.com/feed1",
            name: "Source 1",
            enabled: true,
          },
        ],
      },
      {
        id: "pack-2",
        name: "Pack 2",
        description: "Second pack",
        sources: [
          {
            id: "source-2",
            type: "rss" as const,
            url: "https://example.com/feed2",
            name: "Source 2",
            enabled: true,
          },
        ],
      },
    ];

    await runCollectJob({
      logger: mockLogger,
      packs: testPacks,
      adapters: {
        rss: async (source) => {
          // Both sources return the same canonical URL
          return [
            {
              id: `item-from-${source.id}`,
              sourceId: source.id,
              title: "Same Article",
              // Same normalized URL
              url: "https://example.com/same-article",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: JSON.stringify({
                sourceType: "rss",
                authorName: "Author",
                content: "Article content",
              }),
              publishedAt: "2026-03-09T00:00:00Z",
            },
          ];
        },
      },
    });

    // Should have only one item (deduped by URL)
    expect(archivedItems.length).toBe(1);
    // PackId should be from first pack (pack-1)
    expect(archivedItems[0].packId).toBe("pack-1");
  });

  test("normalize -> filter -> exact dedupe -> near dedupe -> persist ordering", async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    archivedItems = [];
    archivedItemCount = 0;

    const testPacks = [
      {
        id: "pack-filtered",
        name: "Pack with Filter",
        description: "Filters out non-matching",
        mustInclude: ["rust"],
        sources: [
          {
            id: "source-filtered",
            type: "rss" as const,
            url: "https://example.com/filtered",
            name: "Filtered Source",
            enabled: true,
          },
        ],
      },
      {
        id: "pack-unfiltered",
        name: "Pack without Filter",
        description: "No filters",
        sources: [
          {
            id: "source-unfiltered",
            type: "rss" as const,
            url: "https://example.com/unfiltered",
            name: "Unfiltered Source",
            enabled: true,
          },
        ],
      },
    ];

    await runCollectJob({
      logger: mockLogger,
      packs: testPacks,
      adapters: {
        rss: async (source) => {
          if (source.id === "source-filtered") {
            return [
              {
                id: "item-rust",
                sourceId: "source-filtered",
                title: "Rust is Great",
                url: "https://example.com/rust-article",
                fetchedAt: "2026-03-09T00:00:00Z",
                metadataJson: JSON.stringify({
                  sourceType: "rss",
                }),
                publishedAt: "2026-03-09T00:00:00Z",
              },
              {
                id: "item-go",
                sourceId: "source-filtered",
                title: "Go is Also Great",
                url: "https://example.com/go-article",
                fetchedAt: "2026-03-09T00:00:00Z",
                metadataJson: JSON.stringify({
                  sourceType: "rss",
                }),
                publishedAt: "2026-03-09T00:00:00Z",
              },
            ];
          }
          return [
            {
              id: "item-python",
              sourceId: "source-unfiltered",
              title: "Python is Popular",
              url: "https://example.com/python-article",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: JSON.stringify({
                sourceType: "rss",
              }),
              publishedAt: "2026-03-09T00:00:00Z",
            },
          ];
        },
      },
    });

    // Pipeline flow:
    // 1. raw: 3 items (rust, go, python)
    // 2. normalized: 3 items
    // 3. after pack filter: pack-filtered mustInclude=["rust"] filters out "go", leaving rust + python = 2
    // 4. after exact dedup: 2 items (distinct URLs)
    // 5. after near dedup: 2 items
    // 6. archived: 2 items

    expect(archivedItems.length).toBe(2);

    // Verify filtered pack item has correct packId
    const rustItem = archivedItems.find((i) => i.title === "Rust is Great");
    expect(rustItem).toBeDefined();
    expect(rustItem!.packId).toBe("pack-filtered");

    // Verify unfiltered item has correct packId
    const pythonItem = archivedItems.find((i) => i.title === "Python is Popular");
    expect(pythonItem).toBeDefined();
    expect(pythonItem!.packId).toBe("pack-unfiltered");
  });
});
