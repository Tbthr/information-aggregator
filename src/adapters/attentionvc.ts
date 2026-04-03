/**
 * AttentionVC 适配器
 *
 * 发现方法: 公共 API
 *   GET https://reply-vc-90459984647.us-central1.run.app/v1/articles/leaderboard?window=1d&category=ai&sortBy=views&limit=20
 *   返回 24 小时内 AI 领域热门文章排行榜
 */

import type { RawItem, Source } from "../types/index";
import { createLogger } from "../utils/logger";

const logger = createLogger("adapter:attentionvc");

const API_BASE = "https://reply-vc-90459984647.us-central1.run.app/v1/articles";

interface AttentionvcAuthor {
  handle: string;
  isBlueVerified: boolean;
  followers: number;
  name: string;
  profileImage: string;
  accountBasedIn: string;
}

interface AttentionvcEntry {
  rank: number;
  tweetId: string;
  title: string;
  tweetCreatedAt: string;
  author: AttentionvcAuthor;
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  previewText: string;
  coverImageUrl: string | null;
  wordCount: number;
  readingTimeMinutes: number;
  category: string;
  tags: string[];
  langsDetected: string[];
  trendingTopics: string[];
  lastMetricsUpdate: string;
}

interface AttentionvcResponse {
  entries: AttentionvcEntry[];
  updatedAt: string;
  totalCount: number;
}

export async function collectAttentionvcSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const { timeWindow, fetchImpl = fetch } = options;
  const url = `${API_BASE}/leaderboard?window=1d&category=ai&sortBy=views&limit=20`;
  const startTime = Date.now();
  const jobStartedAt = new Date().toISOString();
  const cutoffMs = new Date(jobStartedAt).getTime() - timeWindow;

  logger.info("Fetching AttentionVC", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("AttentionVC request failed", { status: response.status, elapsed });
      throw new Error(`AttentionVC request failed: ${response.status}`);
    }

    const body = await response.json() as AttentionvcResponse;
    const entries = body.entries ?? [];

    logger.info("AttentionVC response", { count: entries.length, elapsed, total: body.totalCount });

    const out: RawItem[] = [];

    for (const entry of entries) {
      // Filter by timeWindow using tweetCreatedAt
      const publishedAt = new Date(entry.tweetCreatedAt);
      if (publishedAt.getTime() < cutoffMs) {
        logger.warn("Discarding item outside time window", {
          sourceId: source.id,
          sourceType: "attentionvc",
          title: entry.title,
          url: `https://x.com/${entry.author.handle}/status/${entry.tweetId}`,
          rawTime: entry.tweetCreatedAt,
          discardReason: `tweetCreatedAt ${publishedAt.toISOString()} is before cutoff ${new Date(cutoffMs).toISOString()}`,
        });
        continue;
      }

      // Construct Twitter URL from tweetId and author handle
      const tweetUrl = `https://x.com/${entry.author.handle}/status/${entry.tweetId}`;

      out.push({
        id: `attentionvc-${entry.tweetId}`,
        sourceId: source.id,
        sourceType: source.type,
        contentType: source.contentType,
        sourceName: source.name,
        title: entry.title,
        url: tweetUrl,
        fetchedAt: new Date().toISOString(),
        publishedAt: entry.tweetCreatedAt,
        content: entry.previewText,
        metadataJson: JSON.stringify({
          tweetId: entry.tweetId,
          authorId: entry.author.handle,
          coverImageUrl: entry.coverImageUrl,
          rank: entry.rank,
          category: entry.category,
          tags: entry.tags,
          langsDetected: entry.langsDetected,
          trendingTopics: entry.trendingTopics,
          lastMetricsUpdate: entry.lastMetricsUpdate,
          isBlueVerified: entry.author.isBlueVerified,
          followerCount: entry.author.followers,
          accountBasedIn: entry.author.accountBasedIn,
          readingTimeMinutes: entry.readingTimeMinutes,
          wordCount: entry.wordCount,
        }),
      });
    }

    logger.info("AttentionVC collect completed", { sourceId: source.id, count: out.length });
    return out;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error("AttentionVC collect error", {
      url,
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });
    throw err;
  }
}
