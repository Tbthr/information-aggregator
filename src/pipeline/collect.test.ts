import { describe, expect, test } from "bun:test";
import { collectSources } from "./collect";

describe("collectSources", () => {
  test("collects from multiple sources and flattens results", async () => {
    const items = await collectSources(
      [{ id: "s1", name: "A", type: "rss", enabled: true, configJson: "{}", url: "https://a.com/feed" }],
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
        { id: "s1", name: "A", type: "rss", enabled: true, configJson: "{}", url: "https://a.com/feed" },
        { id: "s2", name: "B", type: "rss", enabled: true, configJson: "{}", url: "https://b.com/feed" },
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

  test("dispatches to the hn adapter when configured", async () => {
    const items = await collectSources(
      [{ id: "hn-1", name: "HN", type: "hn", enabled: true, configJson: "{}", url: "https://example.com/hn" }],
      {
        adapters: {
          hn: async () => [
            {
              id: "hn-1",
              sourceId: "hn-1",
              title: "Show HN",
              url: "https://example.com/post",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: "{}",
            },
          ],
        },
      },
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.sourceId).toBe("hn-1");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "hn",
      sourceType: "hn",
      contentType: "community_post",
      canonicalHints: {
        externalUrl: "https://example.com/post",
        discussionUrl: "https://news.ycombinator.com/item?id=1",
      },
    });
  });

  test("dispatches to the reddit adapter when configured", async () => {
    const items = await collectSources(
      [{ id: "reddit-1", name: "Reddit", type: "reddit", enabled: true, configJson: "{}", url: "https://example.com/reddit" }],
      {
        adapters: {
          reddit: async () => [
            {
              id: "reddit-abc",
              sourceId: "reddit-1",
              title: "Interesting post",
              url: "https://example.com/post",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: "{}",
            },
          ],
        },
      },
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.sourceId).toBe("reddit-1");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "reddit",
      sourceType: "reddit",
      contentType: "community_post",
      canonicalHints: {
        externalUrl: "https://example.com/post",
        discussionUrl: "https://www.reddit.com/r/artificial/comments/abc",
      },
    });
  });
});
