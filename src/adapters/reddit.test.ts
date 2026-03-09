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
                url: "https://example.com/post",
                author: "bob",
                subreddit: "artificial",
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
  });
});
