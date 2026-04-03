import type { RawItem, Source } from "../types/index";
import { createLogger, truncateWithLength } from "../utils/logger";
import { parseDate, type ParseDateSuccess, type ParseDateFailure } from "../../lib/date-utils";
import { computeTimeCutoff } from "../../lib/utils";

const logger = createLogger("adapter:rss");

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractTag(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXml(match[1].trim()) : undefined;
}

export interface ParseRssItemsOptions {
  jobStartedAt: string;
  timeWindow: number;
  sourceType: string;
  sourceContentType: string;
  sourceName: string;
}

export function parseRssItems(
  xml: string,
  sourceId: string,
  options: ParseRssItemsOptions,
): RawItem[] {
  const { jobStartedAt, timeWindow, sourceType, sourceContentType, sourceName } = options;
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomEntries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : atomEntries;

  // Calculate the cutoff using timeWindow
  const cutoffTimestamp = computeTimeCutoff(jobStartedAt, timeWindow);

  const items: RawItem[] = [];
  let discardCount = 0;

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const atomHref = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const title = extractTag(block, "title") ?? `Untitled ${index + 1}`;
    const url = extractTag(block, "link") ?? atomHref ?? "";

    if (!url) {
      continue;
    }

    // Extract timestamp fields in order of preference
    const timestampFields = [
      { field: "pubDate", value: extractTag(block, "pubDate") },
      { field: "published", value: extractTag(block, "published") },
      { field: "updated", value: extractTag(block, "updated") },
    ];

    let parsedTimestamp: ParseDateSuccess | null = null;
    let timestampFailure: ParseDateFailure | null = null;
    let usedField = "";

    for (const tf of timestampFields) {
      if (tf.value) {
        const parsed = parseDate(tf.value, tf.field);
        if (parsed === null) {
          // No timestamp provided
          continue;
        }
        if (!parsed.valid) {
          // Invalid or relative timestamp
          timestampFailure = parsed as ParseDateFailure;
          break;
        }
        parsedTimestamp = parsed as ParseDateSuccess;
        usedField = tf.field;
        break;
      }
    }

    // If we found an invalid/relative timestamp, discard the item
    if (timestampFailure) {
      logger.warn("Discarding item with invalid timestamp", {
        sourceId,
        sourceType: "rss",
        title,
        url,
        rawTime: timestampFailure.rawPublishedAt,
        discardReason: `timestamp is ${timestampFailure.reason}: ${timestampFailure.rawPublishedAt}`,
      });
      discardCount++;
      continue;
    }

    // If no timestamp found, skip the item (publishedAt is required)
    if (!parsedTimestamp) {
      logger.warn("Skipping item without publishedAt", {
        sourceId,
        sourceType: "rss",
        title,
        url,
      });
      discardCount++;
      continue;
    }

    // Check if timestamp is within the 24h window
    if (parsedTimestamp.date.getTime() < cutoffTimestamp) {
      logger.warn("Discarding item outside 24h window", {
        sourceId,
        sourceType: "rss",
        title,
        url,
        rawTime: parsedTimestamp.rawPublishedAt,
        discardReason: `published at ${parsedTimestamp.date.toISOString()} is before cutoff ${new Date(cutoffTimestamp).toISOString()}`,
      });
      discardCount++;
      continue;
    }

    // Extract author (prefer dc:creator, then author, then managingEditor)
    const authorName =
      extractTag(block, "dc:creator") ||
      extractTag(block, "author") ||
      extractTag(block, "managingEditor");

    // Extract content
    const contentEncoded = extractTag(block, "content:encoded");
    const description = extractTag(block, "description");

    // summary: source description only
    const summary = description;

    // content: content:encoded only (the full article body)
    const content = contentEncoded;

    // Build metadataJson with only adapter-specific fields (no provider/sourceKind/contentType)
    const metadataJson = JSON.stringify({
      rawPublishedAt: parsedTimestamp.rawPublishedAt,
      timeSourceField: usedField,
      timeParseNote: parsedTimestamp.timeParseNote,
    });

    const item: RawItem = {
      id: `${sourceId}-${index + 1}-${url || title}`,
      sourceId,
      sourceType,
      contentType: sourceContentType,
      sourceName,
      title,
      url,
      author: authorName,
      content: content,
      fetchedAt: new Date().toISOString(),
      publishedAt: parsedTimestamp.date.toISOString(),
      metadataJson,
    };

    items.push(item);
  }

  // Log discard summary per source (D-04, D-05)
  logger.info("Source fetch completed", {
    sourceId,
    sourceType: "rss",
    fetched: items.length,
    discarded: discardCount,
    discardRate: items.length + discardCount > 0
      ? `${((discardCount / (items.length + discardCount)) * 100).toFixed(1)}%`
      : "0%",
  });

  return items;
}

export async function collectRssSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const url = source.url ?? "";
  const startTime = Date.now();
  const { timeWindow, fetchImpl = fetch } = options;
  const jobStartedAt = new Date().toISOString();

  logger.info("Fetching RSS feed", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url);
    const elapsed = Date.now() - startTime;
    const xml = await response.text();

    if (!response.ok) {
      logger.error("RSS fetch failed", { url, status: response.status, elapsed });
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "unknown";

    logger.info("RSS fetch completed", {
      url,
      status: response.status,
      contentType,
      size: xml.length,
      elapsed,
    });

    logger.debug("RSS response preview", {
      preview: truncateWithLength(xml, 500),
    });

    return parseRssItems(xml, source.id, { jobStartedAt, timeWindow, sourceType: source.type, sourceContentType: source.contentType, sourceName: source.name });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error("RSS fetch error", {
      url,
      error: error instanceof Error ? error.message : String(error),
      elapsed,
    });
    throw error;
  }
}
