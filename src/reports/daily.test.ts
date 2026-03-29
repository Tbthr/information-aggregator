import { describe, expect, test } from "bun:test";
import type { Content, DailyReportConfig } from "@prisma/client";
import type { ReportCandidate, ScoreBreakdown } from "../types/index";
import {
  collectCandidates,
  scoreCandidates,
  trimTopN,
  candidatesToTopicClusterItems,
  candidatesToTopicContents,
  parseKindPreferences,
  type ScoredCandidate,
} from "./daily";

// ============================================================
// Test helpers
// ============================================================

function makeContent(overrides: Partial<Content> & { id: string; kind: "article" | "tweet" }): Content {
  return {
    id: overrides.id,
    kind: overrides.kind,
    sourceId: "source-1",
    title: overrides.title ?? "Test Content",
    body: overrides.body ?? "Content body",
    url: overrides.url ?? `https://example.com/${overrides.id}`,
    authorLabel: overrides.authorLabel ?? null,
    publishedAt: overrides.publishedAt ?? new Date("2026-03-27T10:00:00Z"),
    fetchedAt: new Date("2026-03-27T12:00:00Z"),
    engagementScore: overrides.engagementScore ?? null,
    qualityScore: overrides.qualityScore ?? null,
    topicIds: overrides.topicIds ?? [],
    topicScoresJson: null,
    metadataJson: null,
    summary: null,
    createdAt: new Date("2026-03-27T12:00:00Z"),
    updatedAt: new Date("2026-03-27T12:00:00Z"),
  } as Content;
}

// ============================================================
// collectCandidates
// ============================================================

describe("collectCandidates", () => {
  test("maps articles to ReportCandidate with kind=article", () => {
    const contents = [
      makeContent({ id: "content-1", kind: "article", title: "Article A" }),
    ];

    const candidates = collectCandidates(contents);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind).toBe("article");
    expect(candidates[0].id).toBe("content-1");
    expect(candidates[0].title).toBe("Article A");
  });

  test("maps tweets to ReportCandidate with kind=tweet", () => {
    const contents = [
      makeContent({ id: "tweet-1", kind: "tweet", title: "Hello world" }),
    ];

    const candidates = collectCandidates(contents);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind).toBe("tweet");
    expect(candidates[0].id).toBe("tweet-1");
  });

  test("maps mixed content kinds", () => {
    const contents = [
      makeContent({ id: "content-1", kind: "article" }),
      makeContent({ id: "tweet-1", kind: "tweet" }),
      makeContent({ id: "content-2", kind: "article" }),
    ];

    const candidates = collectCandidates(contents);

    expect(candidates).toHaveLength(3);
    expect(candidates.filter((c) => c.kind === "article")).toHaveLength(2);
    expect(candidates.filter((c) => c.kind === "tweet")).toHaveLength(1);
  });

  test("returns empty array when no contents", () => {
    const candidates = collectCandidates([]);
    expect(candidates).toHaveLength(0);
  });
});

// ============================================================
// parseKindPreferences
// ============================================================

describe("parseKindPreferences", () => {
  test("parses valid JSON with both preferences", () => {
    const result = parseKindPreferences('{"articles": 10, "tweets": 20}');
    expect(result).toEqual({ articles: 10, tweets: 20 });
  });

  test("parses valid JSON with only articles", () => {
    const result = parseKindPreferences('{"articles": 15}');
    expect(result).toEqual({ articles: 15 });
  });

  test("returns empty object for null", () => {
    const result = parseKindPreferences(null);
    expect(result).toEqual({});
  });

  test("returns empty object for empty string", () => {
    const result = parseKindPreferences("");
    expect(result).toEqual({});
  });

  test("returns empty object for invalid JSON", () => {
    const result = parseKindPreferences("not json");
    expect(result).toEqual({});
  });
});

// ============================================================
// scoreCandidates
// ============================================================

describe("scoreCandidates", () => {
  test("produces ScoredCandidate with breakdown for each candidate", () => {
    const candidates: ReportCandidate[] = [
      {
        id: "content-1",
        kind: "article",
        topicId: "topic-1",
        title: "Article A",
        summary: "Summary A",
        content: "",
        publishedAt: "2026-03-27T10:00:00Z",
        sourceLabel: "Source",
        normalizedUrl: "https://example.com/a",
        normalizedTitle: "article a",
        rawRef: { id: "content-1", sourceId: "source-1" },
      },
      {
        id: "tweet-1",
        kind: "tweet",
        topicId: "",
        title: "Tweet Title",
        summary: "Tweet text",
        content: "",
        publishedAt: "2026-03-27T10:00:00Z",
        sourceLabel: "@user",
        normalizedUrl: "https://twitter.com/user/1",
        normalizedTitle: "tweet title",
        rawRef: { id: "tweet-1", sourceId: "twitter" },
      },
    ];

    const scored = scoreCandidates(candidates, { kindPreferences: {} });

    expect(scored).toHaveLength(2);
    // Each should have a breakdown with all scoring stages
    for (const s of scored) {
      expect(s.breakdown).toBeDefined();
      expect(typeof s.breakdown.baseScore).toBe("number");
      expect(typeof s.breakdown.runtimeScore).toBe("number");
      expect(typeof s.breakdown.historyPenalty).toBe("number");
      expect(typeof s.breakdown.finalScore).toBe("number");
      expect(s.breakdown.finalScore).toBeGreaterThan(0);
    }
  });

  test("applies kind preferences - higher tweet preference boosts tweets", () => {
    const candidates: ReportCandidate[] = [
      {
        id: "content-1",
        kind: "article",
        topicId: "topic-1",
        title: "Article",
        summary: "Summary",
        content: "",
        publishedAt: "2026-03-27T10:00:00Z",
        sourceLabel: "Source",
        normalizedUrl: "https://example.com/a",
        normalizedTitle: "article",
        rawRef: { id: "content-1", sourceId: "source-1" },
      },
      {
        id: "tweet-1",
        kind: "tweet",
        topicId: "",
        title: "Tweet",
        summary: "Tweet text",
        content: "",
        publishedAt: "2026-03-27T10:00:00Z",
        sourceLabel: "@user",
        normalizedUrl: "https://twitter.com/user/1",
        normalizedTitle: "tweet",
        rawRef: { id: "tweet-1", sourceId: "twitter" },
      },
    ];

    const scoredDefault = scoreCandidates(candidates, { kindPreferences: {} });
    const scoredHighTweets = scoreCandidates(candidates, {
      kindPreferences: { tweets: 100 },
    });

    const tweetDefault = scoredDefault.find((s) => s.kind === "tweet")!;
    const tweetHigh = scoredHighTweets.find((s) => s.kind === "tweet")!;

    // Higher tweet preference should give tweet a higher baseScore and thus higher runtimeScore
    expect(tweetHigh.breakdown.baseScore).toBeGreaterThan(tweetDefault.breakdown.baseScore);
  });

  test("applies history penalty for duplicate URLs", () => {
    const candidates: ReportCandidate[] = [
      {
        id: "content-1",
        kind: "article",
        topicId: "topic-1",
        title: "Article A",
        summary: "Summary",
        content: "",
        publishedAt: "2026-03-27T10:00:00Z",
        sourceLabel: "Source",
        normalizedUrl: "https://example.com/duplicate",
        normalizedTitle: "duplicate article",
        rawRef: { id: "content-1", sourceId: "source-1" },
      },
    ];

    const recentCandidates: ReportCandidate[] = [
      {
        id: "old-content",
        kind: "article",
        topicId: "topic-1",
        title: "Old Article",
        summary: "Old summary",
        content: "",
        publishedAt: "2026-03-20T10:00:00Z",
        sourceLabel: "Source",
        normalizedUrl: "https://example.com/duplicate",
        normalizedTitle: "old duplicate article",
        rawRef: { id: "old-content", sourceId: "source-1" },
      },
    ];

    const scored = scoreCandidates(candidates, {
      kindPreferences: {},
      recentCandidates,
    });

    expect(scored).toHaveLength(1);
    expect(scored[0].breakdown.historyPenalty).toBeGreaterThan(0);
    expect(scored[0].breakdown.finalScore).toBeLessThan(scored[0].breakdown.runtimeScore);
  });

  test("zero history penalty with no recent candidates", () => {
    const candidates: ReportCandidate[] = [
      {
        id: "content-1",
        kind: "article",
        topicId: "topic-1",
        title: "Article",
        summary: "Summary",
        content: "",
        publishedAt: "2026-03-27T10:00:00Z",
        sourceLabel: "Source",
        normalizedUrl: "https://example.com/a",
        normalizedTitle: "article",
        rawRef: { id: "content-1", sourceId: "source-1" },
      },
    ];

    const scored = scoreCandidates(candidates, { kindPreferences: {} });
    expect(scored[0].breakdown.historyPenalty).toBe(0);
    expect(scored[0].breakdown.finalScore).toBe(scored[0].breakdown.runtimeScore);
  });
});

// ============================================================
// trimTopN
// ============================================================

describe("trimTopN", () => {
  function makeScored(
    id: string,
    finalScore: number,
    kind: "article" | "tweet" = "article"
  ): ScoredCandidate {
    return {
      id,
      kind,
      topicId: "topic-1",
      title: `Title ${id}`,
      summary: `Summary ${id}`,
      content: "",
      publishedAt: "2026-03-27T10:00:00Z",
      sourceLabel: "Source",
      normalizedUrl: `https://example.com/${id}`,
      normalizedTitle: `title ${id}`,
      rawRef: { id, sourceId: "source-1" },
      breakdown: {
        baseScore: finalScore,
        signalScores: {},
        runtimeScore: finalScore,
        historyPenalty: 0,
        finalScore,
      },
    };
  }

  test("trims to top N by finalScore descending", () => {
    const scored: ScoredCandidate[] = [
      makeScored("a", 3),
      makeScored("b", 10),
      makeScored("c", 7),
      makeScored("d", 1),
      makeScored("e", 5),
    ];

    const trimmed = trimTopN(scored, 3);

    expect(trimmed).toHaveLength(3);
    expect(trimmed[0].id).toBe("b"); // score 10
    expect(trimmed[1].id).toBe("c"); // score 7
    expect(trimmed[2].id).toBe("e"); // score 5
  });

  test("returns all when N is larger than array length", () => {
    const scored: ScoredCandidate[] = [
      makeScored("a", 3),
      makeScored("b", 10),
    ];

    const trimmed = trimTopN(scored, 10);
    expect(trimmed).toHaveLength(2);
  });

  test("handles empty array", () => {
    const trimmed = trimTopN([], 5);
    expect(trimmed).toHaveLength(0);
  });

  test("preserves article/tweet kind distribution when trimming", () => {
    const scored: ScoredCandidate[] = [
      makeScored("article-1", 8, "article"),
      makeScored("tweet-1", 7, "tweet"),
      makeScored("article-2", 6, "article"),
      makeScored("tweet-2", 5, "tweet"),
      makeScored("article-3", 4, "article"),
    ];

    const trimmed = trimTopN(scored, 3);

    expect(trimmed).toHaveLength(3);
    // Top 3 by score: article-1(8), tweet-1(7), article-2(6)
    expect(trimmed.map((c) => c.id)).toEqual(["article-1", "tweet-1", "article-2"]);
  });

  test("N=0 returns empty array", () => {
    const scored: ScoredCandidate[] = [makeScored("a", 5)];
    const trimmed = trimTopN(scored, 0);
    expect(trimmed).toHaveLength(0);
  });
});

// ============================================================
// candidatesToTopicClusterItems
// ============================================================

describe("candidatesToTopicClusterItems", () => {
  test("maps candidates to TopicClusterItem format for AI", () => {
    const candidates: ReportCandidate[] = [
      {
        id: "content-1",
        kind: "article",
        topicId: "topic-1",
        title: "Article Title",
        summary: "Article summary",
        content: "",
        sourceLabel: "Source",
        normalizedUrl: "https://example.com/a",
        normalizedTitle: "article title",
        rawRef: { id: "content-1", sourceId: "source-1" },
      },
      {
        id: "tweet-1",
        kind: "tweet",
        topicId: "",
        title: "Tweet Title",
        summary: "Tweet text here",
        content: "",
        sourceLabel: "@user",
        normalizedUrl: "https://twitter.com/user/1",
        normalizedTitle: "tweet title",
        rawRef: { id: "tweet-1", sourceId: "twitter" },
      },
    ];

    const clusterItems = candidatesToTopicClusterItems(candidates);

    expect(clusterItems).toHaveLength(2);
    expect(clusterItems[0].type).toBe("item");
    expect(clusterItems[0].title).toBe("Article Title");
    expect(clusterItems[0].index).toBe(0);

    expect(clusterItems[1].type).toBe("tweet");
    expect(clusterItems[1].title).toBe("@user");
    expect(clusterItems[1].index).toBe(1);
  });

  test("separates article and tweet indexes for AI clustering", () => {
    const candidates: ReportCandidate[] = [
      { id: "content-1", kind: "article", topicId: "t1", title: "A", summary: "S", content: "", sourceLabel: "Src", normalizedUrl: "https://a.com/1", normalizedTitle: "a", rawRef: { id: "content-1", sourceId: "s1" } },
      { id: "content-2", kind: "article", topicId: "t1", title: "B", summary: "S", content: "", sourceLabel: "Src", normalizedUrl: "https://a.com/2", normalizedTitle: "b", rawRef: { id: "content-2", sourceId: "s1" } },
      { id: "tweet-1", kind: "tweet", topicId: "", title: "T", summary: "S", content: "", sourceLabel: "@u", normalizedUrl: "https://t.com/1", normalizedTitle: "t", rawRef: { id: "tweet-1", sourceId: "twitter" } },
    ];

    const clusterItems = candidatesToTopicClusterItems(candidates);

    expect(clusterItems).toHaveLength(3);
    // Articles have type "item", tweets have type "tweet"
    const itemClusterItems = clusterItems.filter((c) => c.type === "item");
    const tweetClusterItems = clusterItems.filter((c) => c.type === "tweet");
    expect(itemClusterItems).toHaveLength(2);
    expect(tweetClusterItems).toHaveLength(1);
  });
});

// ============================================================
// candidatesToTopicContents
// ============================================================

describe("candidatesToTopicContents", () => {
  test("maps candidate subset to topic summary contents", () => {
    const candidates: ReportCandidate[] = [
      { id: "content-1", kind: "article", topicId: "t1", title: "Article A", summary: "Summary A", content: "", sourceLabel: "Source", normalizedUrl: "https://a.com/1", normalizedTitle: "article a", rawRef: { id: "content-1", sourceId: "s1" } },
      { id: "tweet-1", kind: "tweet", topicId: "", title: "Tweet Title", summary: "Tweet text", content: "", sourceLabel: "@user", normalizedUrl: "https://t.com/1", normalizedTitle: "tweet", rawRef: { id: "tweet-1", sourceId: "twitter" } },
    ];

    // Simulate AI clustering result: item index 0 and tweet index 1 (absolute index)
    const contents = candidatesToTopicContents(candidates, [0], [1]);

    expect(contents).toHaveLength(2);
    expect(contents[0].type).toBe("item");
    expect(contents[0].title).toBe("Article A");
    expect(contents[1].type).toBe("tweet");
    expect(contents[1].title).toBe("@user");
  });

  test("returns empty when no indexes match", () => {
    const candidates: ReportCandidate[] = [
      { id: "content-1", kind: "article", topicId: "t1", title: "A", summary: "S", content: "", sourceLabel: "Src", normalizedUrl: "https://a.com/1", normalizedTitle: "a", rawRef: { id: "content-1", sourceId: "s1" } },
    ];

    const contents = candidatesToTopicContents(candidates, [], []);
    expect(contents).toHaveLength(0);
  });
});

// ============================================================
// Integration: full pipeline ordering (collect -> score -> trim)
// ============================================================

describe("daily pipeline ordering", () => {
  test("content goes through scoring before trimming", () => {
    const contents = [
      makeContent({ id: "low-score", kind: "article", title: "Low quality", engagementScore: 1 }),
      makeContent({ id: "high-score", kind: "article", title: "High quality article", engagementScore: 100 }),
      makeContent({ id: "tweet-popular", kind: "tweet", title: "Popular tweet", engagementScore: 1000 }),
      makeContent({ id: "tweet-unpopular", kind: "tweet", title: "Unpopular tweet", engagementScore: 0 }),
    ];

    // Step 1: Collect candidates
    const candidates = collectCandidates(contents);
    expect(candidates).toHaveLength(4);

    // Step 2: Score candidates
    const scored = scoreCandidates(candidates, { kindPreferences: {} });
    expect(scored).toHaveLength(4);

    // All should have positive finalScore
    for (const s of scored) {
      expect(s.breakdown.finalScore).toBeGreaterThan(0);
    }

    // Step 3: Trim to top N
    const trimmed = trimTopN(scored, 2);
    expect(trimmed).toHaveLength(2);

    // Trimmed should be the top 2 by finalScore
    const sorted = [...scored].sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);
    expect(trimmed[0].id).toBe(sorted[0].id);
    expect(trimmed[1].id).toBe(sorted[1].id);
  });

  test("output shape retains content kind information", () => {
    const contents = [
      makeContent({ id: "content-1", kind: "article" }),
      makeContent({ id: "tweet-1", kind: "tweet" }),
    ];

    const candidates = collectCandidates(contents);
    const scored = scoreCandidates(candidates, { kindPreferences: {} });

    // After trimming, we can still separate by kind
    const trimmed = trimTopN(scored, 10);
    const articleIds = trimmed.filter((c) => c.kind === "article").map((c) => c.id);
    const tweetIds = trimmed.filter((c) => c.kind === "tweet").map((c) => c.id);

    expect(articleIds).toContain("content-1");
    expect(tweetIds).toContain("tweet-1");
  });
});