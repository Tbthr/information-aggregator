import type { RawItem, Source } from "../types/index";

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
    const snippet = extractTag(block, "description") ?? extractTag(block, "summary") ?? extractTag(block, "content");

    return {
      id: `${sourceId}-${index + 1}-${url || title}`,
      sourceId,
      title,
      url,
      snippet,
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
  const response = await fetchImpl(source.url ?? "");
  const xml = await response.text();
  return parseRssItems(xml, source.id);
}
