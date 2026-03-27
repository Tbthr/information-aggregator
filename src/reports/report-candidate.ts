import type { Item, Tweet } from "@prisma/client";
import type { ReportCandidate } from "../types/index";

const TWEET_TITLE_MAX_LENGTH = 100;

/**
 * Maps a persisted Item to a unified ReportCandidate.
 */
export function itemToReportCandidate(item: Item): ReportCandidate {
  return {
    id: item.id,
    kind: "article",
    packId: item.packId ?? "",
    title: item.title,
    summary: item.summary ?? "",
    content: item.content ?? "",
    publishedAt: item.publishedAt?.toISOString(),
    sourceLabel: item.sourceName,
    categories: item.categories.length > 0 ? item.categories : undefined,
    normalizedUrl: item.url, // Item.url is already normalized per spec
    normalizedTitle: normalizeTitleForComparison(item.title),
    rawRef: {
      id: item.id,
      sourceId: item.sourceId,
    },
  };
}

/**
 * Maps a persisted Tweet to a unified ReportCandidate.
 *
 * TODO: 需要优化
 * - title extraction from tweet text (currently uses first sentence or truncation)
 * - summary could include more context
 * - content field is left empty; will be enhanced when thread/quoted/article support is added
 */
export function tweetToReportCandidate(tweet: Tweet): ReportCandidate {
  const mainText = tweet.text ?? "";
  const title = extractTweetTitle(mainText);
  const summary = mainText; // Full text as summary

  return {
    id: tweet.id,
    kind: "tweet",
    packId: "", // TODO: tweets don't have packId mapping yet; using reserved value
    title,
    summary,
    content: "", // TODO: 需要优化 - will expand when thread/quoted/article support is added
    publishedAt: tweet.publishedAt?.toISOString(),
    sourceLabel: `@${tweet.authorHandle}`,
    normalizedUrl: tweet.expandedUrl ?? tweet.url,
    normalizedTitle: normalizeTitleForComparison(title),
    rawRef: {
      id: tweet.id,
      sourceId: "twitter", // tweets don't have sourceId in the same sense
    },
  };
}

/**
 * Extracts a title from tweet text.
 * Uses first sentence if available, otherwise truncates to TWEET_TITLE_MAX_LENGTH.
 */
function extractTweetTitle(text: string): string {
  // Try to find first sentence
  const sentenceEnd = text.search(/[.!?。！？]\s/);
  if (sentenceEnd > 0 && sentenceEnd <= TWEET_TITLE_MAX_LENGTH) {
    return text.slice(0, sentenceEnd + 1);
  }
  // Fall back to truncation
  if (text.length > TWEET_TITLE_MAX_LENGTH) {
    return text.slice(0, TWEET_TITLE_MAX_LENGTH) + "...";
  }
  return text;
}

/**
 * Normalizes a title for comparison in history penalty stage.
 * Uses the same strong normalization as specified in the design doc:
 * - lowercase
 * - remove punctuation
 * - compress whitespace
 */
function normalizeTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ")    // compress whitespace
    .trim();
}
