import { describe, expect, test, mock } from "bun:test";

// Set up mocks BEFORE importing the module under test
mock.module("../lib/prisma", () => ({
  prisma: {
    pack: { findMany: async () => [], upsert: async () => ({}) },
    source: { findMany: async () => [], upsert: async () => ({}) },
    item: {
      findMany: async () => [],
      createMany: async () => ({ count: 0 }),
      update: async () => ({}),
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
});
