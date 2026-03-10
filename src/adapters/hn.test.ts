import { describe, expect, test } from "bun:test";
import { parseHnItems } from "./hn";

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
});
