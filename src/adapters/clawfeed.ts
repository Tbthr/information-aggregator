/**
 * ClawFeed 适配器
 *
 * 发现方法: 自定义 JSON API
 *   GET https://clawfeed.kevinhe.io/feed/kevin
 *   返回用户自定义 RSS 摘要，每4小时一份
 */

import type { FilterContext, RawItem, Source } from "../types/index";
import { createLogger } from "../utils/logger";

const logger = createLogger("adapter:clawfeed");

interface ClawfeedDigest {
  id: number;
  type: string;
  content: string;
  created_at: string;
}

interface ClawfeedResponse {
  user: { name: string; slug: string };
  digests: ClawfeedDigest[];
  total: number;
}

export async function collectClawfeedSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
  jobStartedAt?: string,
  filterContext?: FilterContext,
): Promise<RawItem[]> {
  const url = "https://clawfeed.kevinhe.io/feed/kevin";
  const startTime = Date.now();

  logger.info("Fetching ClawFeed", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("ClawFeed request failed", { status: response.status, elapsed });
      throw new Error(`ClawFeed request failed: ${response.status}`);
    }

    const body = await response.json() as ClawfeedResponse;
    const digests = body.digests ?? [];

    logger.info("ClawFeed response", { count: digests.length, elapsed, total: body.total });

    // Use cutoff from jobStartedAt or 48h default
    const cutoffMs = jobStartedAt
      ? new Date(jobStartedAt).getTime() - 48 * 60 * 60 * 1000
      : Date.now() - 48 * 60 * 60 * 1000;

    const out: RawItem[] = [];

    for (const d of digests) {
      const createdAt = new Date(d.created_at);
      if (createdAt.getTime() < cutoffMs) continue;

      // Extract title from first line of content (e.g., "☀️ ClawFeed | 2026-04-01 20:41 SGT")
      const lines = d.content.split("\n");
      let title = lines[0]?.replace(/^[☀️🔥📰\s]+/, "").trim() || `ClawFeed Digest ${d.id}`;
      if (title.includes("ClawFeed")) {
        // e.g. "ClawFeed | 2026-04-01 20:41 SGT" -> "ClawFeed Digest 2026-04-01 20:41"
        const parts = title.split("|");
        if (parts.length >= 2) {
          title = `ClawFeed Digest ${parts[1]?.trim() ?? d.id}`;
        }
      }

      out.push({
        id: `clawfeed-${d.id}`,
        sourceId: source.id,
        title,
        url: url, // ClawFeed digests don't have individual URLs
        fetchedAt: new Date().toISOString(),
        publishedAt: createdAt.toISOString(),
        content: d.content,
        metadataJson: JSON.stringify({
          provider: "clawfeed",
          sourceKind: "clawfeed",
          contentType: "digest",
          userName: body.user.name,
          userSlug: body.user.slug,
          digestId: d.id,
          digestType: d.type,
        }),
        filterContext,
      });
    }

    logger.info("ClawFeed collect completed", { sourceId: source.id, count: out.length });
    return out;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error("ClawFeed collect error", {
      url,
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });
    throw err;
  }
}
