import type { Content } from "@prisma/client";
import type { ReportCandidate } from "../types/index";

const TWEET_TITLE_MAX_LENGTH = 100;

/**
 * Maps a persisted Content to a unified ReportCandidate.
 * Content is the unified content model that replaces Item and Tweet.
 */
export function contentToReportCandidate(content: Content): ReportCandidate {
  const isTweet = content.kind === "tweet";
  const bodyText = content.body ?? "";

  // For tweets, derive title from body text
  const title = isTweet ? extractTweetTitle(bodyText) : (content.title ?? "");
  // For tweets, bodyText becomes summary; for articles, content becomes content field
  const articleContent = isTweet ? "" : bodyText;
  const summary = isTweet ? bodyText : "";

  // For tweets, sourceLabel is @authorHandle; for articles, it's empty (set by caller)
  const sourceLabel = isTweet && content.authorLabel ? `@${content.authorLabel}` : "";

  return {
    id: content.id,
    kind: content.kind as ReportCandidate["kind"],
    topicId: "", // Will be set by caller if needed
    title,
    summary,
    content: articleContent,
    url: content.url,
    authorLabel: content.authorLabel ?? undefined,
    publishedAt: content.publishedAt?.toISOString(),
    sourceLabel,
    normalizedUrl: content.url,
    normalizedTitle: normalizeTitleForComparison(title),
    engagementScore: content.engagementScore ?? undefined,
    qualityScore: content.qualityScore ?? undefined,
    topicIds: content.topicIds, // Pass through topicIds for preset Topic grouping
    rawRef: {
      id: content.id,
      sourceId: content.sourceId,
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
