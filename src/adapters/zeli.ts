/**
 * Zeli.app 适配器
 *
 * 发现方法: Next.js SPA，但存在隐藏 API:
 *   GET https://zeli.app/api/hacker-news?type=hot24h
 *   返回 Hacker News 24h 最热帖子
 */

import type { RawItem, Source } from "../types/index";
import { createLogger } from "../utils/logger";

const logger = createLogger("adapter:zeli");

function parseUnixTimestamp(ts: number | string | undefined): Date | null {
  if (ts === undefined || ts === null) return null;
  const n = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (isNaN(n)) return null;
  return new Date(n * 1000);
}

export async function collectZeliSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const url = "https://zeli.app/api/hacker-news?type=hot24h";
  const startTime = Date.now();
  const { timeWindow, fetchImpl = fetch } = options;
  const jobStartedAt = new Date().toISOString();
  const cutoffMs = new Date(jobStartedAt).getTime() - timeWindow;

  logger.info("Fetching zeli API", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("Zeli API failed", { status: response.status, elapsed });
      throw new Error(`Zeli API failed: ${response.status}`);
    }

    const body = await response.json() as { posts?: Array<{
      title?: string;
      url?: string;
      time?: number | string;
      id?: number | string;
    }> };

    const posts = body.posts ?? [];
    logger.info("Zeli API response", { count: posts.length, elapsed });

    const out: RawItem[] = [];

    for (const p of posts) {
      const title = (p.title ?? "").trim();
      const link = (p.url ?? "").trim();
      if (!title || !link) continue;

      const published = parseUnixTimestamp(p.time);
      if (!published) {
        logger.warn("Skipping item without publishedAt", {
          sourceId: source.id,
          url: link,
        });
        continue;
      }
      if (published.getTime() < cutoffMs) continue;

      const id = `zeli-${String(p.id ?? Date.now())}`;
      out.push({
        id,
        sourceId: source.id,
        sourceType: source.type,
        contentType: source.contentType,
        sourceName: source.name,
        title,
        url: link,
        fetchedAt: new Date().toISOString(),
        publishedAt: published.toISOString(),
        metadataJson: JSON.stringify({
          hnId: p.id,
        }),
      });
    }

    logger.info("Zeli collect completed", { sourceId: source.id, count: out.length });
    return out;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error("Zeli collect error", {
      url,
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });
    throw err;
  }
}
