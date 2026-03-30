import type { FilterContext, RawItem } from "../types/index";
import { createLogger, truncateWithLength } from "../utils/logger";

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

interface ParseDateSuccess {
  valid: true;
  date: Date;
  rawPublishedAt: string;
  timeSourceField: string;
  timeParseNote: string;
}

interface ParseDateFailure {
  valid: false;
  rawPublishedAt: string;
  reason: "relative" | "invalid";
}

type ParseDateResult = ParseDateSuccess | ParseDateFailure | null;

/**
 * Parse a date string into UTC Date.
 * Supports:
 * - RFC 2822 (RFC 822) format: "Mon, 09 Mar 2026 08:00:00 GMT"
 * - ISO 8601 with Z: "2026-03-09T08:00:00Z"
 * - ISO 8601 with offset: "2026-03-09T08:00:00+08:00"
 * - Date only: "2026-03-09" (filled to 23:59:59 UTC)
 *
 * Returns null for empty input, { valid: false } for invalid/relative timestamps.
 */
function parseDate(dateStr: string): ParseDateResult {
  if (!dateStr || dateStr.trim() === "") {
    return null;
  }

  const trimmed = dateStr.trim();

  // Check for relative timestamps (contain words like "ago", "hours", "days", etc.)
  const relativePatterns = [/\bago\b/i, /\bhours?\b/i, /\bdays?\b/i, /\bminutes?\b/i, /\byesterday\b/i, /\bjust now\b/i];
  if (relativePatterns.some((pattern) => pattern.test(trimmed))) {
    return { valid: false, rawPublishedAt: trimmed, reason: "relative" };
  }

  // Try RFC 2822 / RFC 822 format (e.g., "Mon, 09 Mar 2026 08:00:00 GMT")
  const rfc2822Match = trimmed.match(
    /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*([\+\-]\d{4}|[A-Z]{2,4})?$/i
  );

  // Try pure date format (YYYY-MM-DD)
  const dateOnlyMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);

  let date: Date;

  if (dateOnlyMatch) {
    // Date-only: treat as UTC 23:59:59 of that date
    const datePart = trimmed;
    const parsed = new Date(`${datePart}T23:59:59.000Z`);
    if (isNaN(parsed.getTime())) {
      return { valid: false, rawPublishedAt: trimmed, reason: "invalid" };
    }
    return {
      valid: true,
      date: parsed,
      rawPublishedAt: trimmed,
      timeSourceField: "pubDate",
      timeParseNote: "date-only, filled to 23:59:59 UTC",
    };
  }

  // Try standard Date.parse first for ISO 8601 formats
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    // For RFC 2822, the parsed date is already in correct UTC
    // For ISO 8601 with offset, Date constructor handles it correctly
    return {
      valid: true,
      date: new Date(parsed.toISOString()),
      rawPublishedAt: trimmed,
      timeSourceField: "pubDate",
      timeParseNote: parsed.getTimezoneOffset() === 0 ? "parsed as UTC" : "parsed with timezone conversion",
    };
  }

  // Try manual RFC 2822 parsing for formats like "Mon, 09 Mar 2026 08:00:00 GMT"
  const rfc2822Manual = trimmed.match(
    /^[A-Za-z]{3},?\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([\+\-]\d{4}|[A-Z]{2,4})?$/i
  );

  if (rfc2822Manual) {
    const [, day, monthStr, year, hour, minute, second, tz] = rfc2822Manual;
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const month = months[monthStr];
    if (month !== undefined) {
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      const s = parseInt(second, 10);
      const d = parseInt(day, 10);
      const y = parseInt(year, 10);

      if (tz) {
        // Handle timezone
        let offsetMs = 0;
        if (tz === "GMT" || tz === "UT" || tz === "UTC") {
          offsetMs = 0;
        } else if (tz.match(/^\+\d{4}$/)) {
          const offsetStr = tz.substring(1);
          const offsetH = parseInt(offsetStr.substring(0, 2), 10);
          const offsetM = parseInt(offsetStr.substring(2, 4), 10);
          offsetMs = (offsetH * 60 + offsetM) * 60 * 1000;
        } else if (tz.match(/^\-\d{4}$/)) {
          const offsetStr = tz.substring(1);
          const offsetH = parseInt(offsetStr.substring(0, 2), 10);
          const offsetM = parseInt(offsetStr.substring(2, 4), 10);
          offsetMs = -((offsetH * 60 + offsetM) * 60 * 1000);
        }
        date = new Date(Date.UTC(y, month, d, h, m, s) - offsetMs);
      } else {
        // Assume UTC if no timezone
        date = new Date(Date.UTC(y, month, d, h, m, s));
      }

      if (!isNaN(date.getTime())) {
        return {
          valid: true,
          date,
          rawPublishedAt: trimmed,
          timeSourceField: "pubDate",
          timeParseNote: tz ? `parsed as RFC 2822 with timezone ${tz}` : "parsed as RFC 2822, assumed UTC",
        };
      }
    }
  }

  // Unparseable
  return { valid: false, rawPublishedAt: trimmed, reason: "invalid" };
}

export interface ParseRssItemsOptions {
  jobStartedAt: string;
  filterContext?: FilterContext;
}

export function parseRssItems(
  xml: string,
  sourceId: string,
  jobStartedAt: string,
  filterContext?: FilterContext,
): RawItem[] {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomEntries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : atomEntries;

  // Calculate the 24h cutoff
  const jobStart = new Date(jobStartedAt);
  const cutoffTime = new Date(jobStart.getTime() - 24 * 60 * 60 * 1000);

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
        const parsed = parseDate(tf.value);
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

    // If no timestamp found, note it
    const timeParseNote = parsedTimestamp ? parsedTimestamp.timeParseNote : "no timestamp found";

    // Check if timestamp is within the 24h window
    if (parsedTimestamp) {
      if (parsedTimestamp.date < cutoffTime) {
        logger.warn("Discarding item outside 24h window", {
          sourceId,
          sourceType: "rss",
          title,
          url,
          rawTime: parsedTimestamp.rawPublishedAt,
          discardReason: `published at ${parsedTimestamp.date.toISOString()} is before cutoff ${cutoffTime.toISOString()}`,
        });
        discardCount++;
        continue;
      }
    }

    // Extract author (prefer dc:creator, then author, then managingEditor)
    const authorName =
      extractTag(block, "dc:creator") ||
      extractTag(block, "author") ||
      extractTag(block, "managingEditor");

    // Extract content
    const contentEncoded = extractTag(block, "content:encoded");
    const description = extractTag(block, "description");

    // summary is the source summary, fallback from content
    const summary = contentEncoded || description;

    // content is stored in metadataJson
    const content = contentEncoded || description;

    // Build metadataJson with audit and content fields
    const metadataJson = JSON.stringify({
      provider: "rss",
      sourceKind: "rss",
      contentType: "article",
      rawPublishedAt: parsedTimestamp?.rawPublishedAt,
      timeSourceField: usedField || undefined,
      timeParseNote,
      summary,
      content,
      authorName,
    });

    const item: RawItem = {
      id: `${sourceId}-${index + 1}-${url || title}`,
      sourceId,
      title,
      url,
      author: authorName,
      content: content,
      fetchedAt: new Date().toISOString(),
      metadataJson,
    };

    if (parsedTimestamp) {
      item.publishedAt = parsedTimestamp.date.toISOString();
    }

    if (filterContext) {
      item.filterContext = filterContext;
    }

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
  source: { id: string; url?: string },
  fetchImpl: typeof fetch = fetch,
  jobStartedAt?: string,
  filterContext?: FilterContext,
): Promise<RawItem[]> {
  const url = source.url ?? "";
  const startTime = Date.now();
  const effectiveJobStartedAt = jobStartedAt ?? new Date().toISOString();

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

    return parseRssItems(xml, source.id, effectiveJobStartedAt, filterContext);
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
