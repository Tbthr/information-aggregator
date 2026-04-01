/**
 * NewsNow.busiyi.world 适配器
 *
 * 发现方法:
 * 1. 抓取首页，从 <script src="/assets/index-XXX.js"> 提取 JS bundle URL
 * 2. 从 JS bundle 正则提取 source_ids: ["hackernews","producthunt",...]
 * 3. 调用 POST https://newsnow.busiyi.world/api/s/entire 获取所有源数据
 * 4. fallback: 逐个调用 GET https://newsnow.busiyi.world/api/s?id={sourceId}
 */

import type { FilterContext, RawItem, Source } from "../types/index";
import { createLogger } from "../utils/logger";

const logger = createLogger("adapter:newsnow");

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function parseUnixTimestamp(ts: number | string | undefined): Date | null {
  if (ts === undefined || ts === null) return null;
  const n = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (isNaN(n)) return null;
  return new Date(n * 1000);
}

function parseDateAny(dateStr: string | undefined, fallback: Date): Date | null {
  if (!dateStr) return null;
  const parsed = parseUnixTimestamp(dateStr);
  if (parsed) return parsed;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function extractNewsnowSourceIds(js: string): string[] {
  // Match: sourceIds=["hackernews","producthunt",...]
  const match = js.match(/sourceIds\s*=\s*(\[[\s\S]*?\]);?/);
  if (!match) return [];
  try {
    // Use Function to avoid JSON.parse requiring double quotes
    const ids = new Function(`return ${match[1]}`)() as string[];
    if (Array.isArray(ids)) return ids.filter((id) => typeof id === "string");
  } catch {
    // fallthrough
  }
  return [];
}

function extractItemsFromBlocks(
  blocks: AnyRecord[],
  sourceId: string,
  cutoffMs: number,
): RawItem[] {
  const out: RawItem[] = [];

  for (const block of blocks) {
    const sid = String(block["id"] ?? "unknown");
    const sourceTitle = String(block["title"] ?? block["name"] ?? block["desc"] ?? sid);
    const sourceLabel = sourceTitle !== sid ? `${sourceTitle} (${sid})` : sid;
    const updated = parseUnixTimestamp(block["updatedTime"] as number | string | undefined) ?? new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: AnyRecord[] = block["items"] ?? [];

    for (const it of items) {
      const title = String(it["title"] ?? "").trim();
      const url = String(it["url"] ?? "").trim();
      if (!title || !url) continue;

      let published = parseDateAny(it["pubDate"] as string | undefined, updated);
      if (!published) {
        const extra = it["extra"];
        if (extra && typeof extra === "object") {
          published = parseDateAny((extra as AnyRecord)["date"] as string | undefined, updated);
        }
      }
      published = published ?? updated;

      if (published.getTime() < cutoffMs) continue;

      out.push({
        id: `${sourceId}-${sid}-${Date.now()}-${out.length}`,
        sourceId,
        title,
        url,
        fetchedAt: new Date().toISOString(),
        publishedAt: published.toISOString(),
        metadataJson: JSON.stringify({
          provider: "newsnow",
          sourceKind: "newsnow",
          contentType: "article",
          source: sourceLabel,
        }),
      });
    }
  }

  return out;
}

export async function collectNewsnowSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
  jobStartedAt?: string,
  filterContext?: FilterContext,
): Promise<RawItem[]> {
  const baseUrl = "https://newsnow.busiyi.world";
  const startTime = Date.now();
  const cutoffMs = jobStartedAt
    ? new Date(jobStartedAt).getTime() - 24 * 60 * 60 * 1000
    : Date.now() - 24 * 60 * 60 * 1000;

  logger.info("Fetching newsnow", { sourceId: source.id });

  try {
    // Step 1: fetch homepage to find JS bundle
    const homeResponse = await fetchImpl(baseUrl, { signal: AbortSignal.timeout(30_000) });
    if (!homeResponse.ok) throw new Error(`Homepage failed: ${homeResponse.status}`);

    const homeHtml = await homeResponse.text();
    let bundleUrl: string | null = null;

    // Find <script src="/assets/index-XXX.js">
    const bundleMatch = homeHtml.match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/);
    if (bundleMatch) {
      bundleUrl = new URL(bundleMatch[1], baseUrl).href;
    }

    // Step 2: extract source IDs from JS bundle (or use defaults)
    let sourceIds = ["hackernews", "producthunt", "github", "sspai", "juejin", "36kr"];
    if (bundleUrl) {
      try {
        const jsResponse = await fetchImpl(bundleUrl, { signal: AbortSignal.timeout(30_000) });
        if (jsResponse.ok) {
          const js = await jsResponse.text();
          const extracted = extractNewsnowSourceIds(js);
          if (extracted.length > 0) sourceIds = extracted;
        }
      } catch {
        logger.warn("Failed to fetch JS bundle, using defaults", { bundleUrl });
      }
    }

    logger.info("Newsnow source IDs", { count: sourceIds.length, sourceIds: sourceIds.slice(0, 5) });

    // Step 3: call batch API
    const headers: Record<string, string> = {
      "User-Agent": BROWSER_UA,
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Origin": baseUrl,
      "Referer": `${baseUrl}/`,
    };

    let sourceBlocks: AnyRecord[] = [];
    try {
      const batchResponse = await fetchImpl(`${baseUrl}/api/s/entire`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sources: sourceIds }),
        signal: AbortSignal.timeout(45_000),
      });

      if (batchResponse.ok) {
        const body = await batchResponse.json() as AnyRecord;
        const data = body["data"];
        if (Array.isArray(data)) sourceBlocks = data;
      }
    } catch {
      logger.warn("Batch API failed, falling back to per-source API");
    }

    // Step 4: fallback to per-source API if batch failed
    if (sourceBlocks.length === 0) {
      for (const sid of sourceIds) {
        try {
          const r = await fetchImpl(`${baseUrl}/api/s?id=${sid}`, { headers, signal: AbortSignal.timeout(20_000) });
          if (r.ok) {
            const block = await r.json() as AnyRecord;
            sourceBlocks.push(block);
          }
        } catch {
          // skip individual failures
        }
      }
    }

    const items = extractItemsFromBlocks(sourceBlocks, source.id, cutoffMs);
    logger.info("Newsnow collect completed", { sourceId: source.id, count: items.length });

    if (filterContext) {
      for (const item of items) {
        item.filterContext = filterContext;
      }
    }

    return items;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error("Newsnow collect error", {
      sourceId: source.id,
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });
    throw err;
  }
}
