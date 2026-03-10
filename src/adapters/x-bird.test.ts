import { describe, expect, test } from "bun:test";

import { buildBirdCommand, collectXBirdSource } from "./x-bird";

describe("x bird integration", () => {
  test("maps x family source types to bird CLI arguments", () => {
    expect(buildBirdCommand({ type: "x_bookmarks", configJson: JSON.stringify({ birdMode: "bookmarks" }) })).toEqual(["bird", "bookmarks"]);
    expect(buildBirdCommand({ type: "x_likes", configJson: JSON.stringify({ birdMode: "likes" }) })).toEqual(["bird", "likes"]);
    expect(
      buildBirdCommand({
        type: "x_multi",
        configJson: JSON.stringify({ birdMode: "multi", listIds: ["1", "2"] }),
      }),
    ).toEqual(["bird", "multi", "--list", "1", "--list", "2"]);
    expect(
      buildBirdCommand({
        type: "x_list",
        configJson: JSON.stringify({ birdMode: "list", listId: "2021198996157710621" }),
      }),
    ).toEqual(["bird", "list", "--list-id", "2021198996157710621"]);
    expect(buildBirdCommand({ type: "x_home", configJson: JSON.stringify({ birdMode: "home" }) })).toEqual(["bird", "home"]);
  });

  test("converts bird output into raw items", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        name: "X Home",
        type: "x_home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "tweet-1",
            text: "Interesting thread",
            url: "https://x.com/example/status/1",
            expanded_url: "https://example.com/article",
            author: "alice",
            created_at: "2026-03-09T08:00:00Z",
          },
        ]),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Interesting thread");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "bird",
      sourceType: "x_home",
      contentType: "social_post",
      canonicalHints: {
        expandedUrl: "https://example.com/article",
      },
    });
  });
});
