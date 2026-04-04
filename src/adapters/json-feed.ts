import type { RawItem, Source } from "../types/index";
import { createLogger, truncateWithLength } from "../utils/logger";
import { parseDate, type ParseDateSuccess, type ParseDateFailure } from "../../lib/date-utils";
import { computeTimeCutoff } from "../../lib/utils";

const logger = createLogger("adapter:json-feed");

interface JsonFeedItem {
  id?: string;
  title?: string;
  url?: string;
  external_url?: string;
  content_text?: string;
  content_html?: string;
  summary?: string;
  date_published?: string;
  date_modified?: string;
  author?: { name?: string };
}

interface JsonFeedPayload {
  version?: string;
  items?: JsonFeedItem[];
}

export interface ParseJsonFeedItemsOptions {
  jobStartedAt: string;
  timeWindow: number;
}

export function parseJsonFeedItems(
  payload: JsonFeedPayload,
  sourceId: string,
  sourceType: string,
  sourceContentType: string,
  sourceName: string,
  options: ParseJsonFeedItemsOptions,
): RawItem[] {
  const { jobStartedAt, timeWindow } = options;
  if (!Array.isArray(payload.items)) {
    throw new Error("Invalid JSON Feed payload");
  }

  // Calculate the cutoff using timeWindow
  const cutoffTimestamp = computeTimeCutoff(jobStartedAt, timeWindow);

  const items: RawItem[] = [];
  let discardCount = 0;

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
      const parsed = parseDate(item.date_published, "date_published");
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
      const parsed = parseDate(item.date_modified, "date_modified");
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
      discardCount++;
      continue;
    }

    // If no timestamp found, skip the item
    if (!parsedTimestamp) {
      logger.warn("Skipping item without publishedAt", {
        sourceId,
        sourceType: "json-feed",
        title: item.title,
        url,
      });
      discardCount++;
      continue;
    }

    // Check if timestamp is within the 24h window
    if (parsedTimestamp.date.getTime() < cutoffTimestamp) {
      discardCount++;
      continue;
    }

    // Extract authorName
    const authorName = item.author?.name;

    // summary: dedicated summary field if present
    const summary = item.summary;

    // content: prefer plain text, then HTML
    const content = item.content_text || item.content_html;

    // Build metadataJson with only adapter-specific fields (no provider/sourceKind/contentType)
    const metadataJson = JSON.stringify({});

    const rawItem: RawItem = {
      id: item.id ?? `${sourceId}-${index + 1}`,
      sourceId,
      sourceType,
      contentType: sourceContentType,
      sourceName,
      title: item.title ?? `Untitled ${index + 1}`,
      url,
      author: authorName,
      content: content,
      fetchedAt: new Date().toISOString(),
      publishedAt: parsedTimestamp.date.toISOString(),
      metadataJson,
    };

    items.push(rawItem);
  }

  // Log discard summary per source (D-04, D-05)
  logger.info("Source fetch completed", {
    sourceId,
    sourceType: "json-feed",
    fetched: items.length,
    discarded: discardCount,
    discardRate: items.length + discardCount > 0
      ? `${((discardCount / (items.length + discardCount)) * 100).toFixed(1)}%`
      : "0%",
  });

  return items;
}

export async function collectJsonFeedSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const url = source.url ?? "";
  const startTime = Date.now();
  const { timeWindow, fetchImpl = fetch } = options;
  const jobStartedAt = new Date().toISOString();

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

    return parseJsonFeedItems(payload, source.id, source.type, source.contentType, source.name, { jobStartedAt, timeWindow });
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
