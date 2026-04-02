import type { RawItem, SourceKind } from "../types/index";
import type { normalizedArticle } from "../types/index";
import { normalizeTitle, normalizeSummary, normalizeContent, deriveDedupeText } from "./normalize-text";
import { normalizeUrlWithExpansion } from "./normalize-url";
import { createLogger } from "../utils/logger";

const logger = createLogger("normalize");

interface RawItemMetadata {
  provider?: string;
  sourceKind?: string;
  sourceType?: string; // Legacy, for migration
  contentType?: string;
  authorName?: string;
  summary?: string;
  content?: string;
  expandedUrl?: string;
  tweetId?: string;
  // Engagement fields
  engagement?: {
    score?: number;
    comments?: number;
    reactions?: number;
  };
  // Tweet-specific
  article?: {
    title?: string;
    previewText?: string;
    url?: string;
  };
  quote?: {
    text?: string;
    author?: string;
  };
  thread?: Array<{ text?: string }>;
}

function parseMetadata(metadataJson: string): RawItemMetadata {
  try {
    return JSON.parse(metadataJson);
  } catch {
    return {};
  }
}

/**
 * Calculate engagement score based on content type:
 * - tweet: min(100, floor((likeCount * 1 + replyCount * 2 + retweetCount * 3) / 10))
 * - github: min(100, floor((starCount * 1 + forkCount * 2 + commentCount * 2) / 10))
 * - reddit: min(100, floor((score * 1 + commentCount * 2) / 10))
 * - article/rss/website/json-feed: null (no signal)
 */
function calculateEngagementScore(metadata: RawItemMetadata, sourceKind: SourceKind): number | null {
  // For tweets, engagement is stored in the metadata
  if (sourceKind === "x" || metadata.provider === "bird") {
    const eng = metadata.engagement;
    if (!eng) return null;
    const score = eng.score ?? 0;
    const comments = eng.comments ?? 0;
    const reactions = eng.reactions ?? 0;
    return Math.min(100, Math.floor((score * 1 + comments * 2 + reactions * 3) / 10));
  }

  // For articles, no engagement signal
  return null;
}

/**
 * Build body content for different content types:
 * - article: metadata.summary or metadata.content
 * - tweet: tweet text + quote text + article preview text + thread text
 */
function buildBody(metadata: RawItemMetadata, sourceKind: SourceKind): string {
  if (sourceKind === "x" || metadata.provider === "bird") {
    const parts: string[] = [];

    // Main tweet text
    if (metadata.content) {
      parts.push(metadata.content);
    }

    // Quote tweet text
    if (metadata.quote?.text) {
      parts.push(`"${metadata.quote.text}"`);
    }

    // Article preview from tweet
    if (metadata.article?.previewText) {
      parts.push(metadata.article.previewText);
    }

    // Thread text
    if (metadata.thread && metadata.thread.length > 0) {
      const threadText = metadata.thread.map((t) => t.text).filter(Boolean).join(" ");
      if (threadText) {
        parts.push(threadText);
      }
    }

    return parts.join(" ");
  }

  // For articles, prefer content, then summary
  return metadata.content || metadata.summary || "";
}

/**
 * Normalize a RawItem into a normalizedArticle.
 * Uses sourceKind (not sourceType) for discriminated union.
 */
export function normalizeItem(item: RawItem): normalizedArticle | null {
  const metadata = parseMetadata(item.metadataJson);

  // Get sourceKind - prefer new field, fall back to legacy sourceType for migration
  const sourceKind = (metadata.sourceKind || metadata.sourceType || "rss") as SourceKind;

  // Get content type from metadata
  const contentType = metadata.contentType || "article";

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

  // Build body content based on source kind
  const bodyContent = buildBody(metadata, sourceKind);

  // Normalize content - falls back to title if empty
  const normalizedContent = normalizeContent(bodyContent, contentType, normalizedTitle);
  if (!normalizedContent) {
    logger.warn("Discarding item with empty body after normalization", {
      id: item.id,
      sourceId: item.sourceId,
      originalTitle: item.title,
    });
    return null;
  }

  // Get expanded URL for X/Twitter content
  const expandedUrl = metadata.expandedUrl;

  // Normalize URL (with expansion for X/Twitter)
  const normalizedUrl = normalizeUrlWithExpansion(item.url, expandedUrl);

  // Calculate engagement score (existing logic)
  const engagementScore = calculateEngagementScore(metadata, sourceKind) ?? 0;

  // Extract topicIds from filterContext
  const topicIds = item.filterContext?.topicIds ?? [];

  // sourceWeightScore will be assigned in pipeline assembly (Task 6)
  const sourceWeightScore = 0;

  return {
    id: item.id,
    sourceId: item.sourceId,
    title: item.title,
    publishedAt: item.publishedAt,
    sourceKind,
    contentType: "article",
    normalizedUrl,
    normalizedTitle,
    normalizedSummary: normalizeSummary(metadata.summary || ""),
    normalizedContent,
    metadataJson: item.metadataJson,
    sourceDefaultTopicIds: topicIds,
    sourceWeightScore,
    engagementScore,
  };
}

