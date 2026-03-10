import { describe, expect, test } from "bun:test";
import { parseRedditListing } from "./reddit";

describe("parseRedditListing", () => {
  test("maps reddit listing children into raw items", () => {
    const items = parseRedditListing(
      {
        data: {
          children: [
            {
              data: {
                id: "abc",
                title: "Interesting post",
                url: "https://www.reddit.com/r/artificial/comments/abc",
                url_overridden_by_dest: "https://example.com/post",
                permalink: "/r/artificial/comments/abc",
                author: "bob",
                subreddit: "artificial",
                score: 88,
                num_comments: 12,
              },
            },
          ],
        },
      },
      "reddit-ai",
    );

    expect(items[0]?.id).toBe("reddit-abc");
    expect(items[0]?.sourceId).toBe("reddit-ai");
    expect(items[0]?.author).toBe("bob");
    expect(items[0]?.url).toBe("https://example.com/post");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "reddit",
      sourceType: "reddit",
      contentType: "community_post",
      engagement: {
        score: 88,
        comments: 12,
      },
      canonicalHints: {
        externalUrl: "https://example.com/post",
        discussionUrl: "https://www.reddit.com/r/artificial/comments/abc",
      },
      subreddit: "artificial",
    });
  });
});
