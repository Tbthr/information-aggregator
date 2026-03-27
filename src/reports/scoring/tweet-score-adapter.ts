import type { KindSignalStageInput, KindSignalStageOutput, SignalScores } from "./types";

/**
 * Tweet engagement signal data.
 * Passed alongside the candidate when tweet engagement metrics are available.
 */
export interface TweetEngagementSignals {
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
}

/**
 * Extended input for tweet signal scoring that optionally carries engagement data.
 */
export interface TweetSignalStageInput extends KindSignalStageInput {
  engagement?: TweetEngagementSignals;
}

// Signal weights for tweet engagement scoring
const LIKE_WEIGHT = 1;
const REPLY_WEIGHT = 2;
const RETWEET_WEIGHT = 1.5;

/**
 * Applies tweet-specific signal scoring based on engagement metrics.
 *
 * Tweet adapter: score from like, bookmark, view, reply, repost/retweet signals.
 * Currently supported: likeCount, replyCount, retweetCount (available in Tweet model).
 *
 * TODO: 需要优化
 * - Add viewCount scoring when available (requires Tweet model extension)
 * - Add bookmarkCount scoring when available (requires Tweet model extension)
 * - Consider recency-weighted scoring
 * - Tune signal weights based on empirical data
 *
 * @param input - candidate with optional engagement data
 * @returns signal scores with engagement and freshness components
 */
export function applyTweetSignalScoring(input: TweetSignalStageInput): KindSignalStageOutput {
  const { candidate, engagement } = input;

  // Non-tweet candidates get zero signals
  if (candidate.kind !== "tweet") {
    return {
      signalScores: {
        engagement: 0,
        freshness: 0,
      },
    };
  }

  // No engagement data available - return zero signals
  if (!engagement) {
    return {
      signalScores: {
        engagement: 0,
        freshness: 0,
      },
    };
  }

  // Calculate engagement score from tweet metrics
  // Formula: likes * 1 + replies * 2 + retweets * 1.5
  const engagementScore =
    (engagement.likeCount ?? 0) * LIKE_WEIGHT +
    (engagement.replyCount ?? 0) * REPLY_WEIGHT +
    (engagement.retweetCount ?? 0) * RETWEET_WEIGHT;

  // TODO: 需要优化 - implement actual freshness scoring based on publishedAt
  const freshnessScore = 0;

  const signalScores: SignalScores = {
    engagement: engagementScore,
    freshness: freshnessScore,
  };

  return { signalScores };
}
