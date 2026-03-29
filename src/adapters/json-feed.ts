import type { FilterContext, RawItem } from "../types/index";
import { createLogger, truncateWithLength } from "../utils/logger";

const logger = createLogger("adapter:json-feed");

interface JsonFeedItem {
  id?: string;
  title?: string;
  url?: string;
  external_url?: string;
  content_text?: string;
  content_html?: string;
  date_published?: string;
  date_modified?: string;
  author?: { name?: string };
}

interface JsonFeedPayload {
  version?: string;
  items?: JsonFeedItem[];
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
 * - ISO 8601 with Z: "2026-03-09T08:00:00Z"
 * - ISO 8601 with offset: "2026-03-09T08:00:00+08:00"
 * - ISO 8601 with negative offset: "2026-03-09T08:00:00-05:00"
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

  // Try pure date format (YYYY-MM-DD)
  const dateOnlyMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);

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
      timeSourceField: "date_published",
      timeParseNote: "date-only, filled to 23:59:59 UTC",
    };
  }

  // Try standard Date.parse for ISO 8601 formats
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    // The Date constructor handles timezone offsets correctly
    return {
      valid: true,
      date: new Date(parsed.toISOString()),
      rawPublishedAt: trimmed,
      timeSourceField: "date_published",
      timeParseNote: parsed.getTimezoneOffset() === 0 ? "parsed as UTC" : "parsed with timezone conversion",
    };
  }

  // Unparseable
  return { valid: false, rawPublishedAt: trimmed, reason: "invalid" };
}

export interface ParseJsonFeedItemsOptions {
  jobStartedAt: string;
  filterContext?: FilterContext;
}

export function parseJsonFeedItems(
  payload: JsonFeedPayload,
  sourceId: string,
  jobStartedAt: string,
  filterContext?: FilterContext,
): RawItem[] {
  if (!Array.isArray(payload.items)) {
    throw new Error("Invalid JSON Feed payload");
  }

  // Calculate the 24h cutoff
  const jobStart = new Date(jobStartedAt);
  const cutoffTime = new Date(jobStart.getTime() - 24 * 60 * 60 * 1000);

  const items: RawItem[] = [];

  for (let index = 0; index < payload.items.length; index++) {
    const item = payload.items[index];

    if (!item.url && !item.external_url) {
      continue;
    }

    const url = item.url ?? item.external_url ?? "";

    // Parse timestamp
    let parsedTimestamp: ParseDateSuccess | null = null;
    let timestampFailure: ParseDateFailure | null = null;
    let usedField = "";

    if (item.date_published) {
      const parsed = parseDate(item.date_published);
      if (parsed === null) {
        // No timestamp provided
      } else if (!parsed.valid) {
        timestampFailure = parsed as ParseDateFailure;
      } else {
        parsedTimestamp = parsed as ParseDateSuccess;
        usedField = "date_published";
      }
    }

    // If no date_published, try date_modified
    if (!parsedTimestamp && !timestampFailure && item.date_modified) {
      const parsed = parseDate(item.date_modified);
      if (parsed !== null && parsed.valid) {
        parsedTimestamp = { ...parsed, timeSourceField: "date_modified" };
        usedField = "date_modified";
      } else if (parsed !== null && !parsed.valid) {
        timestampFailure = parsed as ParseDateFailure;
      }
    }

    // If we found an invalid/relative timestamp, discard the item
    if (timestampFailure) {
      logger.warn("Discarding item with invalid timestamp", {
        sourceId,
        sourceType: "json-feed",
        title: item.title,
        url,
        rawTime: timestampFailure.rawPublishedAt,
        discardReason: `timestamp is ${timestampFailure.reason}: ${timestampFailure.rawPublishedAt}`,
      });
      continue;
    }

    // If no timestamp found, note it
    const timeParseNote = parsedTimestamp ? parsedTimestamp.timeParseNote : "no timestamp found";

    // Check if timestamp is within the 24h window
    if (parsedTimestamp) {
      if (parsedTimestamp.date < cutoffTime) {
        logger.warn("Discarding item outside 24h window", {
          sourceId,
          sourceType: "json-feed",
          title: item.title,
          url,
          rawTime: parsedTimestamp.rawPublishedAt,
          discardReason: `published at ${parsedTimestamp.date.toISOString()} is before cutoff ${cutoffTime.toISOString()}`,
        });
        continue;
      }
    }

    // Extract authorName
    const authorName = item.author?.name;

    // summary: prefer content_html, then content_text
    const summary = item.content_html || item.content_text;

    // content: stored in metadataJson
    const content = item.content_html || item.content_text;

    // Build metadataJson with audit and content fields
    const metadataJson = JSON.stringify({
      provider: "json-feed",
      sourceKind: "json-feed",
      contentType: "article",
      rawPublishedAt: parsedTimestamp?.rawPublishedAt,
      timeSourceField: usedField || undefined,
      timeParseNote,
      summary,
      content,
      authorName,
    });

    const rawItem: RawItem = {
      id: item.id ?? `${sourceId}-${index + 1}`,
      sourceId,
      title: item.title ?? `Untitled ${index + 1}`,
      url,
      fetchedAt: new Date().toISOString(),
      metadataJson,
    };

    if (parsedTimestamp) {
      rawItem.publishedAt = parsedTimestamp.date.toISOString();
    }

    if (filterContext) {
      rawItem.filterContext = filterContext;
    }

    items.push(rawItem);
  }

  return items;
}

export async function collectJsonFeedSource(
  source: { id: string; url?: string },
  fetchImpl: typeof fetch = fetch,
  jobStartedAt?: string,
  filterContext?: FilterContext,
): Promise<RawItem[]> {
  const url = source.url ?? "";
  const startTime = Date.now();
  const effectiveJobStartedAt = jobStartedAt ?? new Date().toISOString();

  logger.info("Fetching JSON Feed", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url);
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("JSON Feed fetch failed", { url, status: response.status, elapsed });
      throw new Error(`JSON Feed fetch failed: ${response.status}`);
    }

    const payload = await response.json();
    const contentType = response.headers.get("content-type") ?? "unknown";
    const responseStr = JSON.stringify(payload);

    logger.info("JSON Feed fetch completed", {
      url,
      status: response.status,
      contentType,
      size: responseStr.length,
      elapsed,
    });

    logger.debug("JSON Feed response preview", {
      preview: truncateWithLength(responseStr, 500),
    });

    return parseJsonFeedItems(payload, source.id, effectiveJobStartedAt, filterContext);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error("JSON Feed fetch error", {
      url,
      error: error instanceof Error ? error.message : String(error),
      elapsed,
    });
    throw error;
  }
}
