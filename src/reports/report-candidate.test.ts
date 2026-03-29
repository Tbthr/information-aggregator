import { describe, expect, test } from "bun:test";
import type { Content } from "@prisma/client";
import { contentToReportCandidate, itemToReportCandidate, tweetToReportCandidate } from "./report-candidate";

describe("contentToReportCandidate", () => {
  test("maps article content fields", () => {
    const content: Content = {
      id: "content-1",
      kind: "article",
      sourceId: "source-1",
      title: "Test Article",
      body: "Article body content",
      url: "https://example.com/article",
      authorLabel: "John Doe",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      engagementScore: 100,
      qualityScore: 0.8,
      topicIds: ["topic-1", "topic-2"],
      topicScoresJson: null,
      metadataJson: null,
      createdAt: new Date("2026-03-27T12:00:00Z"),
      updatedAt: new Date("2026-03-27T12:00:00Z"),
    } as Content;

    const candidate = contentToReportCandidate(content);

    expect(candidate.id).toBe("content-1");
    expect(candidate.kind).toBe("article");
    expect(candidate.topicId).toBe("");
    expect(candidate.title).toBe("Test Article");
    expect(candidate.summary).toBe("");
    expect(candidate.content).toBe("Article body content");
    expect(candidate.url).toBe("https://example.com/article");
    expect(candidate.authorLabel).toBe("John Doe");
    expect(candidate.publishedAt).toBe("2026-03-27T10:00:00.000Z");
    expect(candidate.sourceLabel).toBe("");
    expect(candidate.normalizedUrl).toBe("https://example.com/article");
    expect(candidate.engagementScore).toBe(100);
    expect(candidate.qualityScore).toBe(0.8);
    expect(candidate.rawRef.id).toBe("content-1");
    expect(candidate.rawRef.sourceId).toBe("source-1");
  });

  test("maps tweet content fields", () => {
    const content: Content = {
      id: "content-tweet-1",
      kind: "tweet",
      sourceId: "twitter",
      title: null,
      body: "This is a tweet about #AI and machine learning!",
      url: "https://twitter.com/user/status/123456789",
      authorLabel: "ai_researcher",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      engagementScore: 215,
      qualityScore: null,
      topicIds: [],
      topicScoresJson: null,
      metadataJson: null,
      createdAt: new Date("2026-03-27T12:00:00Z"),
      updatedAt: new Date("2026-03-27T12:00:00Z"),
    } as Content;

    const candidate = contentToReportCandidate(content);

    expect(candidate.id).toBe("content-tweet-1");
    expect(candidate.kind).toBe("tweet");
    expect(candidate.title).toBe("This is a tweet about #AI and machine learning!");
    expect(candidate.summary).toBe("This is a tweet about #AI and machine learning!");
    expect(candidate.content).toBe("");
    expect(candidate.url).toBe("https://twitter.com/user/status/123456789");
    expect(candidate.authorLabel).toBe("ai_researcher");
    expect(candidate.publishedAt).toBe("2026-03-27T10:00:00.000Z");
    expect(candidate.sourceLabel).toBe("@ai_researcher");
    expect(candidate.rawRef.id).toBe("content-tweet-1");
    expect(candidate.rawRef.sourceId).toBe("twitter");
  });

  test("handles content without publishedAt", () => {
    const content: Content = {
      id: "content-2",
      kind: "article",
      sourceId: "source-1",
      title: "No Date Article",
      body: null,
      url: "https://example.com/no-date",
      authorLabel: null,
      publishedAt: null,
      fetchedAt: new Date("2026-03-27T12:00:00Z"),
      engagementScore: null,
      qualityScore: null,
      topicIds: [],
      topicScoresJson: null,
      metadataJson: null,
      createdAt: new Date("2026-03-27T12:00:00Z"),
      updatedAt: new Date("2026-03-27T12:00:00Z"),
    } as Content;

    const candidate = contentToReportCandidate(content);

    expect(candidate.id).toBe("content-2");
    expect(candidate.publishedAt).toBeUndefined();
    expect(candidate.title).toBe("No Date Article");
  });

  test("normalizes title for comparison", () => {
    const content: Content = {
      id: "content-3",
      kind: "article",
      sourceId: "source-1",
      title: "  Test   Article!  With? Punctuation.  ",
      body: "Body",
      url: "https://example.com/test",
      authorLabel: null,
      publishedAt: new Date(),
      fetchedAt: new Date(),
      engagementScore: null,
      qualityScore: null,
      topicIds: [],
      topicScoresJson: null,
      metadataJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Content;

    const candidate = contentToReportCandidate(content);

    // Normalized: lowercase, no punctuation, compressed whitespace
    expect(candidate.normalizedTitle).toBe("test article with punctuation");
  });
});

describe("itemToReportCandidate (deprecated)", () => {
  test("maps basic item fields", () => {
    const item = {
      id: "item-1",
      title: "Test Article",
      url: "https://example.com/article",
      sourceId: "source-1",
      sourceName: "Example Source",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      summary: "Article summary",
      content: "Article content",
      packId: "pack-1",
    };

    const candidate = itemToReportCandidate(item);

    expect(candidate.id).toBe("item-1");
    expect(candidate.kind).toBe("article");
    // packId is deprecated, use topicId instead
    expect(candidate.topicId).toBe("pack-1");
    expect(candidate.title).toBe("Test Article");
    expect(candidate.summary).toBe("Article summary");
    expect(candidate.content).toBe("Article content");
    expect(candidate.publishedAt).toBe("2026-03-27T10:00:00.000Z");
    expect(candidate.sourceLabel).toBe("Example Source");
    expect(candidate.rawRef.id).toBe("item-1");
    expect(candidate.rawRef.sourceId).toBe("source-1");
  });

  test("handles item without publishedAt", () => {
    const item = {
      id: "item-2",
      title: "No Date Article",
      url: "https://example.com/no-date",
      sourceId: "source-1",
      sourceName: "Example Source",
      publishedAt: null,
      summary: null,
      content: null,
      packId: "pack-1",
    };

    const candidate = itemToReportCandidate(item);

    expect(candidate.id).toBe("item-2");
    expect(candidate.publishedAt).toBeUndefined();
  });
});

describe("tweetToReportCandidate (deprecated)", () => {
  test("maps basic tweet fields", () => {
    const tweet = {
      id: "tweet-1",
      text: "This is a tweet about #AI and machine learning!",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      authorHandle: "ai_researcher",
      expandedUrl: "https://twitter.com/user/status/123456789",
      url: "https://twitter.com/user/status/123456789",
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
    const tweet = {
      id: "tweet-2",
      text: longText,
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      authorHandle: "test_user",
      expandedUrl: null,
      url: "https://twitter.com/user/status/987654321",
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
    const tweet = {
      id: "tweet-3",
      text: "First sentence is the main point. Second sentence adds more detail.",
      publishedAt: new Date("2026-03-27T10:00:00Z"),
      authorHandle: "writer",
      expandedUrl: null,
      url: "https://twitter.com/user/status/111222333",
    };

    const candidate = tweetToReportCandidate(tweet);

    expect(candidate.title).toBe("First sentence is the main point.");
    expect(candidate.summary).toBe("First sentence is the main point. Second sentence adds more detail.");
  });
});