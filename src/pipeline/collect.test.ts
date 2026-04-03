import { describe, expect, test } from "bun:test";
import { collectSources } from "./collect";

describe("collectSources", () => {
  test("collects from multiple sources and flattens results", async () => {
    const items = await collectSources(
      [{ id: "s1", type: "rss", enabled: true, url: "https://a.com/feed", tags: [], sourceWeightScore: 0.5, contentType: "article", name: "Test Source", weightScore: null, authConfigJson: null }],
      {
        adapters: {
          rss: async () => [
            {
              id: "item-1",
              sourceId: "s1",
              sourceType: "rss",
              contentType: "article",
              sourceName: "Test Source",
              title: "Hello",
              url: "https://a.com/1",
              publishedAt: "2026-03-09T00:00:00Z",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: "{}",
            },
          ],
        },
        adapterConcurrency: 4,
        sourceConcurrency: 4,
        timeWindow: 24 * 60 * 60 * 1000,
      },
    );
    expect(items).toHaveLength(1);
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({});
  });

  test("reports source event metrics for success and failure paths", async () => {
    const events: Array<{ sourceId: string; status: string; itemCount: number; latencyMs?: number }> = [];

    await collectSources(
      [
        { id: "s1", type: "rss", enabled: true, url: "https://a.com/feed", tags: [], sourceWeightScore: 0.5, contentType: "article", name: "Test Source", weightScore: null, authConfigJson: null },
        { id: "s2", type: "rss", enabled: true, url: "https://b.com/feed", tags: [], sourceWeightScore: 0.5, contentType: "article", name: "Test Source", weightScore: null, authConfigJson: null },
      ],
      {
        adapters: {
          rss: async (source) => {
            if (source.id === "s2") {
              throw new Error("boom");
            }
            return [
              {
                id: "item-1",
                sourceId: "s1",
                sourceType: "rss",
                contentType: "article",
                sourceName: "Test Source",
                title: "Hello",
                url: "https://a.com/1",
                publishedAt: "2026-03-09T00:00:00Z",
                fetchedAt: "2026-03-09T00:00:00Z",
                metadataJson: "{}",
              },
            ];
          },
        },
        onSourceEvent: (event) => {
          events.push(event);
        },
        adapterConcurrency: 4,
        sourceConcurrency: 4,
        timeWindow: 24 * 60 * 60 * 1000,
      },
    );

    expect(events).toHaveLength(2);
    expect(events[0]?.status).toBe("success");
    expect(events[0]?.itemCount).toBe(1);
    expect(typeof events[0]?.latencyMs).toBe("number");
    expect(events[1]?.status).toBe("failure");
    expect(events[1]?.itemCount).toBe(0);
  });
});
