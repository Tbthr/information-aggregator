import type { RawItem, Source } from "../types/index";
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

export function parseRssItems(xml: string, sourceId: string): RawItem[] {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomEntries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length > 0 ? itemBlocks : atomEntries;

  return blocks.map((block, index) => {
    const atomHref = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const title = extractTag(block, "title") ?? `Untitled ${index + 1}`;
    const url = extractTag(block, "link") ?? atomHref ?? "";
    const publishedAt = extractTag(block, "pubDate") ?? extractTag(block, "published") ?? extractTag(block, "updated");

    return {
      id: `${sourceId}-${index + 1}-${url || title}`,
      sourceId,
      title,
      url,
      publishedAt,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "rss",
        sourceType: "rss",
        contentType: "article",
      }),
    };
  }).filter((item) => item.url);
}

export async function collectRssSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const url = source.url ?? "";
  const startTime = Date.now();

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

    return parseRssItems(xml, source.id);
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
