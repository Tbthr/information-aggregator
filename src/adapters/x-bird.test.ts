import { describe, expect, test } from "bun:test";

import { buildBirdCommand, collectXBirdSource } from "./x-bird";

describe("x bird integration", () => {
  test("maps x family source types to bird CLI arguments", () => {
    expect(buildBirdCommand({ type: "x-bookmarks", configJson: JSON.stringify({ birdMode: "bookmarks" }) })).toEqual(["bird", "bookmarks", "--json"]);
    expect(buildBirdCommand({ type: "x-likes", configJson: JSON.stringify({ birdMode: "likes" }) })).toEqual(["bird", "likes", "--json"]);
    expect(
      buildBirdCommand({
        type: "x-list",
        configJson: JSON.stringify({ birdMode: "list", listId: "2021198996157710621" }),
      }),
    ).toEqual(["bird", "list-timeline", "2021198996157710621", "--json"]);
    expect(buildBirdCommand({ type: "x-home", configJson: JSON.stringify({ birdMode: "home" }) })).toEqual(["bird", "home", "--json"]);
  });

  test("supports count parameter", () => {
    expect(buildBirdCommand({ type: "x-home", configJson: JSON.stringify({ birdMode: "home", count: 50 }) })).toEqual(["bird", "home", "-n", "50", "--json"]);
    expect(buildBirdCommand({ type: "x-bookmarks", configJson: JSON.stringify({ birdMode: "bookmarks", count: 100 }) })).toEqual(["bird", "bookmarks", "-n", "100", "--json"]);
    expect(
      buildBirdCommand({
        type: "x-list",
        configJson: JSON.stringify({ birdMode: "list", listId: "123", count: 200 }),
      }),
    ).toEqual(["bird", "list-timeline", "123", "-n", "200", "--json"]);
  });

  test("supports fetchAll parameter for list/bookmarks/likes", () => {
    expect(buildBirdCommand({ type: "x-list", configJson: JSON.stringify({ birdMode: "list", listId: "123", fetchAll: true }) })).toEqual(["bird", "list-timeline", "123", "--all", "--json"]);
    expect(buildBirdCommand({ type: "x-list", configJson: JSON.stringify({ birdMode: "list", listId: "123", fetchAll: true, maxPages: 5 }) })).toEqual(["bird", "list-timeline", "123", "--all", "--max-pages", "5", "--json"]);
    expect(buildBirdCommand({ type: "x-bookmarks", configJson: JSON.stringify({ birdMode: "bookmarks", fetchAll: true }) })).toEqual(["bird", "bookmarks", "--all", "--json"]);
    expect(buildBirdCommand({ type: "x-likes", configJson: JSON.stringify({ birdMode: "likes", fetchAll: true, maxPages: 3 }) })).toEqual(["bird", "likes", "--all", "--max-pages", "3", "--json"]);
  });

  test("ignores fetchAll for home timeline", () => {
    // home 不支持 --all，应该忽略
    expect(buildBirdCommand({ type: "x-home", configJson: JSON.stringify({ birdMode: "home", fetchAll: true }) })).toEqual(["bird", "home", "--json"]);
    // 但 count 仍然有效
    expect(buildBirdCommand({ type: "x-home", configJson: JSON.stringify({ birdMode: "home", fetchAll: true, count: 50 }) })).toEqual(["bird", "home", "-n", "50", "--json"]);
  });

  test("converts bird output into raw items", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
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
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.provider).toBe("bird");
    expect(metadata.sourceType).toBe("x-home");
    expect(metadata.contentType).toBe("social_post");
    expect(metadata.canonicalHints?.expandedUrl).toBe("https://example.com/article");
    expect(metadata.tweetId).toBe("tweet-1");
    // author 是字符串 "alice"，所以 authorName 是 undefined
    expect(metadata.authorName).toBeUndefined();
    expect(metadata.expandedUrl).toBe("https://example.com/article");
  });

  test("converts real bird json shape without explicit url fields", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
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
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.provider).toBe("bird");
    expect(metadata.sourceType).toBe("x-home");
    expect(metadata.contentType).toBe("social_post");
    expect(metadata.engagement).toEqual({
      score: 42,
      comments: 17,
      reactions: 2,
    });
    expect(metadata.tweetId).toBe("2030994765169205673");
    expect(metadata.authorName).toBe("Jason Zhu");
  });

  test("prefers article titles and truncates long tweet text for scan output", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
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
        type: "x-home",
        configJson: JSON.stringify({
          birdMode: "home",
          authTokenEnv: "BIRD_AUTH_TOKEN_TEST",
          ct0Env: "BIRD_CT0_TEST",
          chromeProfile: "Default",
          cookieSource: ["chrome"],
        }),
      }),
    ).toEqual(["bird", "--auth-token", "auth-token-from-env", "--ct0", "ct0-from-env", "home", "--json"]);

    // 带 count 参数
    expect(
      buildBirdCommand({
        type: "x-home",
        configJson: JSON.stringify({
          birdMode: "home",
          count: 100,
          authTokenEnv: "BIRD_AUTH_TOKEN_TEST",
          ct0Env: "BIRD_CT0_TEST",
        }),
      }),
    ).toEqual(["bird", "--auth-token", "auth-token-from-env", "--ct0", "ct0-from-env", "home", "-n", "100", "--json"]);

    delete process.env.BIRD_AUTH_TOKEN_TEST;
    delete process.env.BIRD_CT0_TEST;
  });

  test("parses article with url into metadataJson", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "2031007472094461985",
            text: "Long article content here...",
            createdAt: "Mon Mar 09 14:01:30 +0000 2026",
            author: {
              username: "techwriter",
              name: "Tech Writer",
            },
            article: {
              title: "The Future of AI Agents",
              previewText: "A deep dive into autonomous systems...",
              url: "https://example.com/ai-agents",
            },
          },
        ]),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("The Future of AI Agents");
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.article).toEqual({
      title: "The Future of AI Agents",
      previewText: "A deep dive into autonomous systems...",
      url: "https://example.com/ai-agents",
    });
  });

  test("parses media array with different types into metadataJson", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "media-tweet",
            text: "Check out this content!",
            author: { username: "mediatest" },
            media: [
              {
                type: "photo",
                url: "https://pbs.twimg.com/media/photo1.jpg",
                width: 1200,
                height: 800,
                previewUrl: "https://pbs.twimg.com/media/photo1.jpg:small",
              },
              {
                type: "video",
                url: "https://video.twimg.com/video1.mp4",
                previewUrl: "https://pbs.twimg.com/video1_thumb.jpg",
              },
              {
                type: "animated_gif",
                url: "https://pbs.twimg.com/media/gif1.gif",
                previewUrl: "https://pbs.twimg.com/media/gif1_thumb.jpg",
              },
            ],
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.media).toHaveLength(3);
    expect(metadata.media[0]).toEqual({
      type: "photo",
      url: "https://pbs.twimg.com/media/photo1.jpg",
      previewUrl: "https://pbs.twimg.com/media/photo1.jpg:small",
    });
    expect(metadata.media[1].type).toBe("video");
    expect(metadata.media[2].type).toBe("animated_gif");
  });

  test("parses quote tweet into metadataJson", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "quote-tweet",
            text: "This is my commentary on the original",
            author: { username: "quoter" },
            quote: {
              id: "original-tweet-id",
              text: "Original tweet content",
              author: { username: "original_author" },
              url: "https://x.com/original_author/status/original-tweet-id",
            },
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.quote).toEqual({
      id: "original-tweet-id",
      text: "Original tweet content",
      author: "original_author",
      url: "https://x.com/original_author/status/original-tweet-id",
    });
  });

  test("parses thread into metadataJson", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "thread-root",
            text: "Starting a thread about AI",
            author: { username: "threader" },
            thread: [
              { id: "thread-1", text: "Point 1: AI is evolving", author: { username: "threader" } },
              { id: "thread-2", text: "Point 2: Agents are the future", author: { username: "threader" } },
            ],
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.thread).toHaveLength(2);
    expect(metadata.thread[0]).toEqual({
      id: "thread-1",
      text: "Point 1: AI is evolving",
      author: "threader",
    });
    expect(metadata.thread[1].text).toBe("Point 2: Agents are the future");
  });

  test("parses parent (reply) into metadataJson", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "reply-tweet",
            text: "I agree with your point!",
            author: { username: "replier" },
            parent: {
              id: "parent-tweet-id",
              text: "What do you think about this?",
              author: { username: "original_poster" },
            },
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.parent).toEqual({
      id: "parent-tweet-id",
      text: "What do you think about this?",
      author: "original_poster",
    });
  });

  test("parses conversationId into metadataJson", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "tweet-with-conv",
            text: "Part of a conversation",
            author: { username: "user" },
            conversationId: "1234567890",
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.conversationId).toBe("1234567890");
  });

  test("handles empty/undefined extended fields gracefully", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "simple-tweet",
            text: "Just a simple tweet",
            author: { username: "simple" },
            // No article, media, quote, thread, or parent
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.article).toBeUndefined();
    expect(metadata.media).toBeUndefined();
    expect(metadata.quote).toBeUndefined();
    expect(metadata.thread).toBeUndefined();
    expect(metadata.parent).toBeUndefined();
  });

  // ========== 元数据字段测试 ==========

  test("parses new metadata fields (tweetId, authorId, authorName, expandedUrl)", async () => {
    const items = await collectXBirdSource(
      {
        id: "x-home",
        type: "x-home",
        url: "https://x.com/home",
        enabled: false,
        configJson: JSON.stringify({ birdMode: "home" }),
      },
      async () =>
        JSON.stringify([
          {
            id: "tweet-123",
            text: "Test tweet",
            author: {
              username: "testuser",
              name: "Test User Name",
            },
            authorId: "author-456",
            expandedUrl: "https://example.com/expanded",
          },
        ]),
    );

    expect(items).toHaveLength(1);
    const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");
    expect(metadata.tweetId).toBe("tweet-123");
    expect(metadata.authorId).toBe("author-456");
    expect(metadata.authorName).toBe("Test User Name");
    expect(metadata.expandedUrl).toBe("https://example.com/expanded");
  });
});
