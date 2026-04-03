import type { RawItem, RawItemEngagement } from "../types/index";
import type { normalizedArticle } from "../types/index";
import { normalizeTitle, normalizeSummary, normalizeContent } from "./normalize-text";
import { normalizeUrlWithExpansion } from "./normalize-url";
import { createLogger } from "../utils/logger";

const logger = createLogger("normalize");

/**
 * Calculate engagement score based on content type:
 * - tweet: min(100, floor((likes * 1 + comments * 2 + reactions * 3) / 10))
 * - For other types: null (no signal)
 */
function calculateEngagementScore(engagement: RawItemEngagement, sourceType: string): number | null {
  // For tweets/X content
  if (sourceType === "x" || sourceType === "twitter") {
    const likes = engagement.likes ?? 0;
    const comments = engagement.comments ?? 0;
    const reactions = engagement.reactions ?? 0;
    return Math.min(100, Math.floor((likes * 1 + comments * 2 + reactions * 3) / 10));
  }

  // For articles, no engagement signal
  return null;
}

/**
 * Normalize a RawItem into a normalizedArticle.
 * Uses sourceType for discriminated union.
 */
export function normalizeItem(item: RawItem): normalizedArticle | null {
  const sourceType = item.sourceType;
  const contentType = item.contentType;
  const summary = item.summary ?? "";
  const sourceName = item.sourceName;

  // Calculate engagement score
  const engagementScore = item.engagement
    ? calculateEngagementScore(item.engagement, sourceType) ?? 0
    : 0;

  // Normalize title - returns null if empty
  const normalizedTitle = normalizeTitle(item.title, contentType);
  if (!normalizedTitle) {
    logger.warn("Discarding item with empty title after normalization", {
      id: item.id,
      sourceId: item.sourceId,
      originalTitle: item.title,
    });
    return null;
  }

  // Normalize content - prefer item.content, fall back to summary, then title
  const bodyContent = item.content || summary || normalizedTitle;
  const normalizedContent = normalizeContent(bodyContent, contentType, normalizedTitle);
  if (!normalizedContent) {
    logger.warn("Discarding item with empty body after normalization", {
      id: item.id,
      sourceId: item.sourceId,
      originalTitle: item.title,
    });
    return null;
  }

  // Normalize URL (with expansion for X/Twitter)
  const normalizedUrl = normalizeUrlWithExpansion(item.url, item.expandedUrl);

  // sourceWeightScore will be assigned in pipeline assembly
  const sourceWeightScore = 0;

  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceName,
    title: item.title,
    publishedAt: item.publishedAt,
    sourceType,
    contentType: "article",
    normalizedUrl,
    normalizedTitle,
    normalizedSummary: normalizeSummary(summary),
    normalizedContent,
    metadataJson: item.metadataJson,
    sourceWeightScore,
    engagementScore,
  };
}
