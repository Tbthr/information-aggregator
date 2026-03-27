import { describe, expect, test } from "bun:test";
import type { Item, Tweet } from "@prisma/client";
import { itemToReportCandidate, tweetToReportCandidate } from "./report-candidate";

describe("itemToReportCandidate", () => {
  test("maps basic item fields", () => {
    const item: Item = {
      id: "item-1",
      title: "Test Article",
      url: "https://example.com/article",
      sourceId: "source-1",
      sourceName: "Example Source",
      sourceType: "rss",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      author: "John Doe",
      summary: "Article summary",
      content: "Article content",
      metadataJson: '{"summary":"Article summary"}',
      packId: "pack-1",
      createdAt: new Date("2026-03-27T12:00:00Z"),
      updatedAt: new Date("2026-03-27T12:00:00Z"),
    } as Item;

    const candidate = itemToReportCandidate(item);

    expect(candidate.id).toBe("item-1");
    expect(candidate.kind).toBe("article");
    expect(candidate.packId).toBe("pack-1");
    expect(candidate.title).toBe("Test Article");
    expect(candidate.summary).toBe("Article summary");
    expect(candidate.content).toBe("Article content");
    expect(candidate.publishedAt).toBe("2026-03-27T10:00:00.000Z");
    expect(candidate.sourceLabel).toBe("Example Source");
    expect(candidate.rawRef.id).toBe("item-1");
    expect(candidate.rawRef.sourceId).toBe("source-1");
  });

  test("handles item without publishedAt", () => {
    const item: Item = {
      id: "item-2",
      title: "No Date Article",
      url: "https://example.com/no-date",
      sourceId: "source-1",
      sourceName: "Example Source",
      sourceType: "rss",
      publishedAt: null,
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      author: null,
      summary: null,
      content: null,
      metadataJson: "{}",
      packId: "pack-1",
      createdAt: new Date("2026-03-27T12:00:00Z"),
      updatedAt: new Date("2026-03-27T12:00:00Z"),
    } as Item;

    const candidate = itemToReportCandidate(item);

    expect(candidate.id).toBe("item-2");
    expect(candidate.publishedAt).toBeUndefined();
  });

  test("uses sourceName as sourceLabel", () => {
    const item: Item = {
      id: "item-3",
      title: "Test",
      url: "https://example.com/test",
      sourceId: "source-1",
      sourceName: "My Favorite Blog",
      sourceType: "rss",
      publishedAt: new Date(),
      fetchedAt: new Date(),
      author: null,
      summary: null,
      content: null,
      metadataJson: "{}",
      packId: "pack-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Item;

    const candidate = itemToReportCandidate(item);
    expect(candidate.sourceLabel).toBe("My Favorite Blog");
  });

  test("does not include categories field", () => {
    const item: Item = {
      id: "item-4",
      title: "Test",
      url: "https://example.com/test",
      sourceId: "source-1",
      sourceName: "Source",
      sourceType: "rss",
      publishedAt: new Date(),
      fetchedAt: new Date(),
      author: null,
      summary: "Summary",
      content: null,
      metadataJson: "{}",
      packId: "pack-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Item;

    const candidate = itemToReportCandidate(item);
    // categories should not be set on ReportCandidate (removed from Item model)
    expect(candidate.categories).toBeUndefined();
  });
});

describe("tweetToReportCandidate", () => {
  test("maps basic tweet fields", () => {
    const tweet: Tweet = {
      id: "tweet-1",
      tweetId: "123456789",
      tab: "home",
      text: "This is a tweet about #AI and machine learning!",
      url: "https://twitter.com/user/status/123456789",
      expandedUrl: "https://twitter.com/user/status/123456789",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      authorHandle: "ai_researcher",
      authorName: "AI Researcher",
      authorId: "999",
      conversationId: null,
      likeCount: 150,
      replyCount: 23,
      retweetCount: 45,
      summary: null,
      bullets: [],
      categories: [],
      score: 5.0,
      mediaJson: null,
      quotedTweetJson: null,
      threadJson: null,
      parentJson: null,
      articleJson: null,
      createdAt: new Date("2026-03-27T12:00:00Z"),
      updatedAt: new Date("2026-03-27T12:00:00Z"),
    };

    const candidate = tweetToReportCandidate(tweet);

    expect(candidate.id).toBe("tweet-1");
    expect(candidate.kind).toBe("tweet");
    expect(candidate.title).toBe("This is a tweet about #AI and machine learning!");
    expect(candidate.summary).toBe("This is a tweet about #AI and machine learning!");
    expect(candidate.content).toBe("");
    expect(candidate.publishedAt).toBe("2026-03-27T10:00:00.000Z");
    expect(candidate.sourceLabel).toBe("@ai_researcher");
    expect(candidate.rawRef.id).toBe("tweet-1");
  });

  test("truncates long tweet text for title", () => {
    const longText = "A".repeat(200);
    const tweet: Tweet = {
      id: "tweet-2",
      tweetId: "987654321",
      tab: "home",
      text: longText,
      url: "https://twitter.com/user/status/987654321",
      expandedUrl: null,
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      authorHandle: "test_user",
      authorName: null,
      authorId: null,
      conversationId: null,
      likeCount: 0,
      replyCount: 0,
      retweetCount: 0,
      summary: null,
      bullets: [],
      categories: [],
      score: 5.0,
      mediaJson: null,
      quotedTweetJson: null,
      threadJson: null,
      parentJson: null,
      articleJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const candidate = tweetToReportCandidate(tweet);

    // Title should be truncated to TWEET_TITLE_MAX_LENGTH + "..."
    // "A".repeat(200) truncated to 100 chars + "..." = 103 chars total
    expect(candidate.title.length).toBe(103);
    expect(candidate.title.endsWith("..."));
    // But summary keeps full text
    expect(candidate.summary).toBe(longText);
  });

  test("uses first sentence as title when tweet has multiple sentences", () => {
    const tweet: Tweet = {
      id: "tweet-3",
      tweetId: "111222333",
      tab: "home",
      text: "First sentence is the main point. Second sentence adds more detail.",
      url: "https://twitter.com/user/status/111222333",
      expandedUrl: null,
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      authorHandle: "writer",
      authorName: null,
      authorId: null,
      conversationId: null,
      likeCount: 10,
      replyCount: 5,
      retweetCount: 2,
      summary: null,
      bullets: [],
      categories: [],
      score: 5.0,
      mediaJson: null,
      quotedTweetJson: null,
      threadJson: null,
      parentJson: null,
      articleJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const candidate = tweetToReportCandidate(tweet);

    expect(candidate.title).toBe("First sentence is the main point.");
    expect(candidate.summary).toBe("First sentence is the main point. Second sentence adds more detail.");
  });
});
