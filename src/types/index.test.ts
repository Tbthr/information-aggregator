import { describe, expect, test } from "bun:test";
import type {
  RawItem,
  RunKind,
  SourceKind,
  ContentKind,
  Topic,
  FilterContext,
  Content,
  ReportCandidate,
} from "./index";

describe("core types", () => {
  test("RunKind supports query execution semantics", () => {
    const kinds: RunKind[] = ["query"];
    expect(kinds).toHaveLength(1);
  });

  test("RawItem supports basic ingestion fields", () => {
    const item: RawItem = {
      id: "item-1",
      sourceId: "source-1",
      title: "Example",
      url: "https://example.com",
      fetchedAt: "2026-03-09T00:00:00Z",
      metadataJson: "{}",
    };
    expect(item.sourceId).toBe("source-1");
  });
});

describe("source kinds", () => {
  test("SourceKind includes all canonical kinds", () => {
    const kinds: SourceKind[] = ["rss", "json-feed", "website", "hn", "reddit", "github-trending", "x", "youtube"];
    expect(kinds).toHaveLength(8);
  });
});

describe("content kinds", () => {
  test("ContentKind includes all content types", () => {
    const kinds: ContentKind[] = ["article", "tweet", "video", "github", "reddit", "hackernews"];
    expect(kinds).toHaveLength(6);
  });
});

describe("topic types", () => {
  test("Topic has required fields", () => {
    const topic: Topic = {
      id: "topic-1",
      name: "AI News",
      description: "Latest AI developments",
      includeRules: ["AI", "LLM", "GPT"],
      excludeRules: ["crypto", "NFT"],
      scoreBoost: 1.5,
      displayOrder: 1,
      maxItems: 10,
    };
    expect(topic.name).toBe("AI News");
    expect(topic.scoreBoost).toBe(1.5);
    expect(topic.includeRules).toHaveLength(3);
  });

  test("FilterContext uses topicIds (not packId)", () => {
    const context: FilterContext = {
      topicIds: ["topic-1", "topic-2"],
      mustInclude: ["AI"],
      exclude: ["crypto"],
    };
    expect(context.topicIds).toHaveLength(2);
  });
});

describe("content types", () => {
  test("Content has unified fields", () => {
    const content: Content = {
      id: "content-1",
      kind: "article",
      sourceId: "source-1",
      title: "Article Title",
      body: "Article body text",
      url: "https://example.com/article",
      authorLabel: "John Doe",
      publishedAt: "2026-03-09T00:00:00Z",
      fetchedAt: "2026-03-09T12:00:00Z",
      engagementScore: 100,
      qualityScore: 8.5,
      topicIds: ["topic-1"],
      topicScoresJson: '{"topic-1": 0.9}',
      metadataJson: '{}',
    };
    expect(content.kind).toBe("article");
    expect(content.topicIds).toHaveLength(1);
    expect(content.topicScoresJson).toBe('{"topic-1": 0.9}');
  });

  test("Content supports tweet kind", () => {
    const tweet: Content = {
      id: "tweet-1",
      kind: "tweet",
      sourceId: "source-x",
      title: "",
      body: "This is a tweet",
      url: "https://x.com/user/status/123",
      authorLabel: "@user",
      fetchedAt: "2026-03-09T12:00:00Z",
      topicIds: ["topic-2"],
    };
    expect(tweet.kind).toBe("tweet");
  });
});

describe("report candidate types", () => {
  test("ReportCandidate uses topicId and Content fields", () => {
    const candidate: ReportCandidate = {
      id: "candidate-1",
      kind: "article",
      topicId: "topic-1",
      topicScores: { "topic-1": 0.9, "topic-2": 0.3 },
      title: "Candidate Title",
      summary: "Summary text",
      content: "Full content",
      url: "https://example.com/article",
      authorLabel: "Author",
      publishedAt: "2026-03-09T00:00:00Z",
      sourceLabel: "Example Source",
      categories: ["AI", "Tech"],
      normalizedUrl: "https://example.com/article",
      normalizedTitle: "Candidate Title",
      engagementScore: 50,
      qualityScore: 7.5,
      rawRef: {
        id: "raw-1",
        sourceId: "source-1",
      },
    };
    expect(candidate.topicId).toBe("topic-1");
    expect(candidate.topicScores).toHaveProperty("topic-1");
    expect(candidate.kind).toBe("article");
  });

  test("ReportCandidate supports tweet kind", () => {
    const candidate: ReportCandidate = {
      id: "candidate-2",
      kind: "tweet",
      topicId: "topic-2",
      title: "",
      summary: "Tweet summary",
      content: "Tweet content",
      url: "https://x.com/user/status/123",
      sourceLabel: "X/Twitter",
      normalizedUrl: "https://x.com/user/status/123",
      normalizedTitle: "",
      rawRef: {
        id: "raw-2",
        sourceId: "source-x",
      },
    };
    expect(candidate.kind).toBe("tweet");
    expect(candidate.topicId).toBe("topic-2");
  });
});
