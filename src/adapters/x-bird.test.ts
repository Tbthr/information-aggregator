import { describe, expect, test } from "bun:test";

import { buildBirdCommand, collectXBirdSource } from "./x-bird";

describe("x bird integration", () => {
  test("maps x family source types to bird CLI arguments", () => {
    expect(buildBirdCommand({ type: "x_bookmarks", configJson: JSON.stringify({ birdMode: "bookmarks" }) })).toEqual(["bird", "bookmarks", "--json"]);
    expect(buildBirdCommand({ type: "x_likes", configJson: JSON.stringify({ birdMode: "likes" }) })).toEqual(["bird", "likes", "--json"]);
    expect(
      buildBirdCommand({
        type: "x_list",
        configJson: JSON.stringify({ birdMode: "list", listId: "2021198996157710621" }),
      }),
    ).toEqual(["bird", "list-timeline", "2021198996157710621", "--json"]);
    expect(buildBirdCommand({ type: "x_home", configJson: JSON.stringify({ birdMode: "home" }) })).toEqual(["bird", "home", "--json"]);
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

  test("converts real bird json shape without explicit url fields", async () => {
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
            id: "2030994765169205673",
            text: "Human-like agent\n\nwith a lot more detail",
            createdAt: "Mon Mar 09 13:11:00 +0000 2026",
            likeCount: 42,
            replyCount: 17,
            retweetCount: 2,
            author: {
              username: "GoSailGlobal",
              name: "Jason Zhu",
            },
          },
        ]),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Human-like agent");
    expect(items[0]?.snippet).toBe("Human-like agent\n\nwith a lot more detail");
    expect(items[0]?.url).toBe("https://x.com/GoSailGlobal/status/2030994765169205673");
    expect(items[0]?.author).toBe("GoSailGlobal");
    expect(items[0]?.publishedAt).toBe("Mon Mar 09 13:11:00 +0000 2026");
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "bird",
      sourceType: "x_home",
      contentType: "social_post",
      engagement: {
        score: 42,
        comments: 17,
        reactions: 2,
      },
    });
  });

  test("prefers article titles and truncates long tweet text for scan output", async () => {
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
            id: "2031007472094461985",
            text: "拖了很久的news-aggregator-skill 重磅更新！！\n后面还有非常长的一大段正文，scan 不应该把整段都塞进标题里。",
            createdAt: "Mon Mar 09 14:01:30 +0000 2026",
            author: {
              username: "LufzzLiz",
              name: "岚叔",
            },
            article: {
              title: "news-aggregator-skill 重磅更新",
            },
          },
        ]),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("news-aggregator-skill 重磅更新");
    expect(items[0]?.snippet).toContain("后面还有非常长的一大段正文");
  });

  test("prefers explicit auth token config over browser profile settings", () => {
    process.env.BIRD_AUTH_TOKEN_TEST = "auth-token-from-env";
    process.env.BIRD_CT0_TEST = "ct0-from-env";

    expect(
      buildBirdCommand({
        type: "x_home",
        configJson: JSON.stringify({
          birdMode: "home",
          authTokenEnv: "BIRD_AUTH_TOKEN_TEST",
          ct0Env: "BIRD_CT0_TEST",
          chromeProfile: "Default",
          cookieSource: ["chrome"],
        }),
      }),
    ).toEqual(["bird", "--auth-token", "auth-token-from-env", "--ct0", "ct0-from-env", "home", "--json"]);

    delete process.env.BIRD_AUTH_TOKEN_TEST;
    delete process.env.BIRD_CT0_TEST;
  });
});
