import { describe, expect, test } from "bun:test";
import { collectHnSource, parseHnItems } from "./hn";

describe("parseHnItems", () => {
  test("maps hacker news api items into raw items", () => {
    const items = parseHnItems(
      [
        { id: 1, title: "Show HN: Demo", url: "https://example.com/demo", by: "alice", time: 1700000000, score: 120 },
      ],
      "hn-top",
    );

    expect(items[0]?.sourceId).toBe("hn-top");
    expect(items[0]?.title).toBe("Show HN: Demo");
    expect(items[0]?.author).toBe("alice");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "hn",
      sourceType: "hn",
      contentType: "community_post",
      engagement: {
        score: 120,
      },
      canonicalHints: {
        externalUrl: "https://example.com/demo",
        discussionUrl: "https://news.ycombinator.com/item?id=1",
      },
    });
  });

  test("collects Algolia front page payloads from hits", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: "42",
              title: "Launch HN: Example",
              url: "https://example.com/launch",
              author: "alice",
              created_at_i: 1700000000,
              points: 77,
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const items = await collectHnSource(
      {
        id: "hn-front-page",
        type: "hn",
        enabled: true,
        url: "https://hn.algolia.com/api/v1/search?tags=front_page",
        configJson: "{}",
      },
      fetchImpl,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("hn-42");
    expect(items[0]?.title).toBe("Launch HN: Example");
    expect(items[0]?.author).toBe("alice");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "hn",
      sourceType: "hn",
      contentType: "community_post",
      engagement: {
        score: 77,
      },
      canonicalHints: {
        externalUrl: "https://example.com/launch",
        discussionUrl: "https://news.ycombinator.com/item?id=42",
      },
    });
  });
});
