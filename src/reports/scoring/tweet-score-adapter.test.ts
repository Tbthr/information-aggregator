import { describe, expect, test } from "bun:test";
import type { ReportCandidate } from "../../types/index";
import { applyTweetSignalScoring } from "./tweet-score-adapter";

describe("applyTweetSignalScoring", () => {
  const createTweetCandidate = (overrides?: Partial<ReportCandidate>): ReportCandidate => ({
    id: "tweet-1",
    kind: "tweet",
    packId: "pack-1",
    title: "Test tweet",
    summary: "Test tweet summary",
    content: "",
    publishedAt: "2026-03-27T10:00:00Z",
    sourceLabel: "@test_user",
    normalizedUrl: "https://twitter.com/user/status/123",
    normalizedTitle: "test tweet",
    rawRef: { id: "tweet-1", sourceId: "twitter" },
    ...overrides,
  });

  test("returns zero signals for non-tweet candidate", () => {
    const articleCandidate: ReportCandidate = {
      id: "article-1",
      kind: "article",
      packId: "pack-1",
      title: "Test article",
      summary: "Summary",
      content: "",
      publishedAt: "2026-03-27T10:00:00Z",
      sourceLabel: "Source",
      normalizedUrl: "https://example.com/article",
      normalizedTitle: "test article",
      rawRef: { id: "article-1", sourceId: "source-1" },
    };

    const result = applyTweetSignalScoring({ candidate: articleCandidate });
    expect(result.signalScores.engagement).toBe(0);
    expect(result.signalScores.freshness).toBe(0);
  });

  test("returns zero signals when no engagement data provided", () => {
    const candidateWithoutSignals: ReportCandidate = {
      ...createTweetCandidate(),
      rawRef: { id: "tweet-no-signals", sourceId: "twitter" },
    };

    const result = applyTweetSignalScoring({ candidate: candidateWithoutSignals });
    expect(result.signalScores.engagement).toBe(0);
    expect(result.signalScores.freshness).toBe(0);
  });

  test("calculates engagement score from actual engagement data", () => {
    const candidate = createTweetCandidate();
    const result = applyTweetSignalScoring({
      candidate,
      engagement: {
        likeCount: 100,
        replyCount: 50,
        retweetCount: 25,
      },
    });

    // Engagement = 100*1 + 50*2 + 25*1.5 = 100 + 100 + 37.5 = 237.5
    expect(result.signalScores.engagement).toBe(237.5);
    expect(result.signalScores.freshness).toBe(0);
  });

  test("handles partial engagement data (missing retweets)", () => {
    const candidate = createTweetCandidate();
    const result = applyTweetSignalScoring({
      candidate,
      engagement: {
        likeCount: 200,
        replyCount: 10,
      },
    });

    // Engagement = 200*1 + 10*2 + 0*1.5 = 200 + 20 = 220
    expect(result.signalScores.engagement).toBe(220);
  });

  test("handles all-zero engagement counts", () => {
    const candidate = createTweetCandidate();
    const result = applyTweetSignalScoring({
      candidate,
      engagement: {
        likeCount: 0,
        replyCount: 0,
        retweetCount: 0,
      },
    });

    expect(result.signalScores.engagement).toBe(0);
  });

  test("engagement data is ignored for non-tweet candidate", () => {
    const articleCandidate: ReportCandidate = {
      id: "article-1",
      kind: "article",
      packId: "pack-1",
      title: "Test article",
      summary: "Summary",
      content: "",
      publishedAt: "2026-03-27T10:00:00Z",
      sourceLabel: "Source",
      normalizedUrl: "https://example.com/article",
      normalizedTitle: "test article",
      rawRef: { id: "article-1", sourceId: "source-1" },
    };

    const result = applyTweetSignalScoring({
      candidate: articleCandidate,
      engagement: {
        likeCount: 1000,
        replyCount: 500,
        retweetCount: 250,
      },
    });

    // Non-tweet candidates always get zero signals regardless of engagement data
    expect(result.signalScores.engagement).toBe(0);
    expect(result.signalScores.freshness).toBe(0);
  });
});