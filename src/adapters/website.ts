import type { FilterContext, RawItem } from "../types/index";
import { createLogger, truncateWithLength } from "../utils/logger";

const logger = createLogger("adapter:website");

/**
 * Extract text content from HTML, stripping tags and decoding entities
 */
function extractTextContent(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#[0-9]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract metadata from HTML head section
 */
function extractMetadata(html: string): {
  title?: string;
  description?: string;
  author?: string;
  publishedTime?: string;
} {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : undefined;

  const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
  const author = authorMatch ? authorMatch[1].trim() : undefined;

  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  const publishedTime = timeMatch ? timeMatch[1].trim() : undefined;

  return { title, description, author, publishedTime };
}

export interface ParseWebsiteItemsOptions {
  jobStartedAt: string;
  filterContext?: FilterContext;
}

/**
 * Parse website HTML into RawItem array.
 * Note: This is a fallback for websites without RSS/JSON Feed.
 * For production use, prefer RSS or JSON Feed when available.
 */
export function parseWebsiteItems(
  html: string,
  sourceId: string,
  url: string,
  jobStartedAt: string,
  filterContext?: FilterContext,
): RawItem[] {
  // Calculate the 24h cutoff
  const jobStart = new Date(jobStartedAt);
  const cutoffTime = new Date(jobStart.getTime() - 24 * 60 * 60 * 1000);

  let discardCount = 0;
  let itemFetched = false;

  const { title, description, author, publishedTime } = extractMetadata(html);
  const content = extractTextContent(html);

  // If no timestamp found, use current time (within window)
  let publishedAt: string | undefined;
  if (publishedTime) {
    const parsed = new Date(publishedTime);
    if (!isNaN(parsed.getTime())) {
      if (parsed >= cutoffTime) {
        publishedAt = parsed.toISOString();
      } else {
        // Item outside 24h window — log and discard
        logger.warn("Discarding item outside 24h window", {
          sourceId,
          sourceType: "website",
          title: title || "unknown",
          url,
          rawTime: publishedTime,
          discardReason: `published at ${parsed.toISOString()} is before cutoff ${cutoffTime.toISOString()}`,
        });
        discardCount++;
        return []; // Discard this item
      }
    } else {
      // Unparseable publishedTime — log and discard
      logger.warn("Discarding item with unparseable publishedTime", {
        sourceId,
        sourceType: "website",
        title: title || "unknown",
        url,
        rawTime: publishedTime,
        discardReason: "publishedTime could not be parsed as a date",
      });
      discardCount++;
      return []; // Discard this item
    }
  } else {
    // No publishedTime attribute — log and discard
    logger.warn("Discarding item without publishedTime", {
      sourceId,
      sourceType: "website",
      title: title || "unknown",
      url,
      discardReason: "no publishedTime attribute found",
    });
    discardCount++;
    return []; // Discard this item
  }

  const metadataJson = JSON.stringify({
    provider: "website",
    sourceKind: "website",
    contentType: "article",
    summary: description,
    content: content.substring(0, 5000), // Limit content in metadata
    authorName: author,
    publishedTime,
  });

  const item: RawItem = {
    id: `${sourceId}-${Date.now()}`,
    sourceId,
    title: title || extractTextContent(html).substring(0, 100),
    url,
    author: author,           // D-06: top-level author field
    content: content,         // D-07: top-level content field
    fetchedAt: new Date().toISOString(),
    metadataJson,
  };

  itemFetched = true;

  if (publishedAt) {
    item.publishedAt = publishedAt;
  }

  if (filterContext) {
    item.filterContext = filterContext;
  }

  // Log discard summary per source (D-04, D-05)
  logger.info("Source fetch completed", {
    sourceId,
    sourceType: "website",
    fetched: itemFetched ? 1 : 0,
    discarded: discardCount,
    discardRate: itemFetched || discardCount > 0
      ? `${((discardCount / (1 + discardCount)) * 100).toFixed(1)}%`
      : "0%",
  });

  return [item];
}

export async function collectWebsiteSource(
  source: { id: string; url?: string },
  fetchImpl: typeof fetch = fetch,
  jobStartedAt?: string,
  filterContext?: FilterContext,
): Promise<RawItem[]> {
  const url = source.url ?? "";
  const startTime = Date.now();
  const effectiveJobStartedAt = jobStartedAt ?? new Date().toISOString();

  logger.info("Fetching website", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url);
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("Website fetch failed", { url, status: response.status, elapsed });
      throw new Error(`Website fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const contentType = response.headers.get("content-type") ?? "unknown";

    logger.info("Website fetch completed", {
      url,
      status: response.status,
      contentType,
      size: html.length,
      elapsed,
    });

    logger.debug("Website response preview", {
      preview: truncateWithLength(html, 500),
    });

    return parseWebsiteItems(html, source.id, url, effectiveJobStartedAt, filterContext);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error("Website fetch error", {
      url,
      error: error instanceof Error ? error.message : String(error),
      elapsed,
    });
    throw error;
  }
}
