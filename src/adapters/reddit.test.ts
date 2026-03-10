import { describe, expect, test } from "bun:test";
import { collectRedditSource, parseRedditListing } from "./reddit";

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

  test("collects real listing payloads and keeps the external article url", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          kind: "Listing",
          data: {
            children: [
              {
                kind: "t3",
                data: {
                  id: "xyz",
                  title: "[R] Interesting result",
                  url: "https://www.reddit.com/r/MachineLearning/comments/xyz",
                  url_overridden_by_dest: "https://example.com/paper",
                  permalink: "/r/MachineLearning/comments/xyz",
                  author: "carol",
                  subreddit: "MachineLearning",
                  created_utc: 1700000000,
                  score: 15,
                  num_comments: 3,
                },
              },
            ],
          },
        }),
        { headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const items = await collectRedditSource(
      {
        id: "reddit-ml",
        name: "Reddit ML",
        type: "reddit",
        enabled: true,
        url: "https://www.reddit.com/r/MachineLearning/.json",
        configJson: "{}",
      },
      fetchImpl,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("reddit-xyz");
    expect(items[0]?.url).toBe("https://example.com/paper");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "reddit",
      sourceType: "reddit",
      contentType: "community_post",
      engagement: {
        score: 15,
        comments: 3,
      },
      canonicalHints: {
        externalUrl: "https://example.com/paper",
        discussionUrl: "https://www.reddit.com/r/MachineLearning/comments/xyz",
      },
      subreddit: "MachineLearning",
    });
  });

  test("sends a reddit-friendly user agent when fetching listings", async () => {
    let capturedUserAgent = "";
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(String(input));
      capturedUserAgent = request.headers.get("user-agent") ?? "";

      return new Response(JSON.stringify({ data: { children: [] } }), {
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    await collectRedditSource(
      {
        id: "reddit-ml",
        name: "Reddit ML",
        type: "reddit",
        enabled: true,
        url: "https://www.reddit.com/r/MachineLearning/.json",
        configJson: "{}",
      },
      fetchImpl,
    );

    expect(capturedUserAgent).toContain("information-aggregator");
  });
});
