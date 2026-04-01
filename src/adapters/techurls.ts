/**
 * TechURLs.com 适配器
 *
 * 发现方法: 静态 HTML，无 RSS
 * 页面结构:
 *   <div class="publisher-block">
 *     <div class="publisher-text">
 *       <span class="primary">SourceName</span>
 *       <span class="secondary">Category</span>
 *     </div>
 *     <div class="publisher-link">
 *       <a class="article-link" href="...">Title</a>
 *       <div class="aside"><span class="text" title="...">2h ago</span></div>
 *     </div>
 *   </div>
 */

import { DOMParser as LinkedomDOMParser } from "linkedom";
import type { FilterContext, RawItem, Source } from "../types/index";
import { createLogger } from "../utils/logger";

const logger = createLogger("adapter:techurls");

function getText(el: Element | null, selector: string): string {
  if (!el) return "";
  const found = el.querySelector(selector);
  return found ? found.textContent?.trim() ?? "" : "";
}

function parseRelativeTime(timeHint: string, now: Date): Date | null {
  // e.g. "2h ago", "1d ago", "30m ago"
  const match = timeHint.match(/^(\d+)\s*(h|m|d|min)?\s*ago$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = (match[2] ?? "h").toLowerCase();
  const msMap: Record<string, number> = { h: 3600000, m: 60000, d: 86400000, min: 60000 };
  return new Date(now.getTime() - value * (msMap[unit] ?? 3600000));
}

function extractItems(html: string, sourceId: string, jobStartedAt: string, timeWindow: number): RawItem[] {
  // @ts-ignore - linkedom global
  const parser = new LinkedomDOMParser();
  const document = parser.parseFromString(html, "text/html");

  const out: RawItem[] = [];
  const cutoffMs = new Date(jobStartedAt).getTime() - timeWindow;

  for (const block of document.querySelectorAll("div.publisher-block")) {
    const primary = getText(block, ".publisher-text .primary");
    const secondary = getText(block, ".publisher-text .secondary");
    const source = (secondary && secondary !== primary) ? `${primary} · ${secondary}` : primary;

    for (const linkRow of block.querySelectorAll("div.publisher-link")) {
      const anchor = linkRow.querySelector("a.article-link");
      if (!anchor) continue;
      const title = anchor.textContent?.trim() ?? "";
      const url = anchor.getAttribute("href")?.trim() ?? "";
      if (!title || !url) continue;

      const asideEl = linkRow.querySelector(".aside .text");
      const timeHint = asideEl?.getAttribute("title") ?? asideEl?.textContent?.trim() ?? "";
      const published = timeHint ? parseRelativeTime(timeHint, new Date()) : null;
      if (published && published.getTime() < cutoffMs) continue;

      out.push({
        id: `${sourceId}-${Date.now()}-${out.length}`,
        sourceId,
        title,
        url,
        fetchedAt: new Date().toISOString(),
        publishedAt: published?.toISOString(),
        metadataJson: JSON.stringify({
          provider: "techurls",
          sourceKind: "techurls",
          contentType: "article",
          source,
          timeHint,
        }),
      });
    }
  }

  return out;
}

export async function collectTechurlsSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
  filterContext?: FilterContext,
): Promise<RawItem[]> {
  const url = source.url || "https://techurls.com/";
  const startTime = Date.now();
  const { timeWindow, fetchImpl = fetch } = options;
  const jobStartedAt = new Date().toISOString();

  logger.info("Fetching techurls", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("Techurls fetch failed", { status: response.status, elapsed });
      throw new Error(`Techurls fetch failed: ${response.status}`);
    }

    const html = await response.text();
    logger.info("Techurls fetch completed", { size: html.length, elapsed });

    const items = extractItems(html, source.id, jobStartedAt, timeWindow);
    logger.info("Techurls collect completed", { sourceId: source.id, count: items.length });

    if (filterContext) {
      for (const item of items) {
        item.filterContext = filterContext;
      }
    }

    return items;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    logger.error("Techurls collect error", {
      url,
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });
    throw err;
  }
}
