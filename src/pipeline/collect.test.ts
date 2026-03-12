import { describe, expect, test } from "bun:test";
import { collectSources } from "./collect";

describe("collectSources", () => {
  test("collects from multiple sources and flattens results", async () => {
    const items = await collectSources(
      [{ id: "s1", type: "rss", enabled: true, configJson: "{}", url: "https://a.com/feed" }],
      {
        adapters: {
          rss: async () => [
            {
              id: "item-1",
              sourceId: "s1",
              title: "Hello",
              url: "https://a.com/1",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: "{}",
            },
          ],
        },
      },
    );
    expect(items).toHaveLength(1);
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "rss",
      sourceType: "rss",
      contentType: "article",
    });
  });

  test("reports source event metrics for success and failure paths", async () => {
    const events: Array<{ sourceId: string; status: string; itemCount: number; latencyMs?: number }> = [];

    await collectSources(
      [
        { id: "s1", type: "rss", enabled: true, configJson: "{}", url: "https://a.com/feed" },
        { id: "s2", type: "rss", enabled: true, configJson: "{}", url: "https://b.com/feed" },
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
                title: "Hello",
                url: "https://a.com/1",
                fetchedAt: "2026-03-09T00:00:00Z",
                metadataJson: "{}",
              },
            ];
          },
        },
        onSourceEvent: (event) => {
          events.push(event);
        },
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
