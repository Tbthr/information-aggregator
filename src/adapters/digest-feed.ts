import type { RawItem, Source } from "../types/index";

function extractTag(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  return block.match(pattern)?.[1]?.trim();
}

function extractFirstLink(html: string): string | undefined {
  return html.match(/<a[^>]+href="([^"]+)"/i)?.[1];
}

export function parseDigestFeedItems(xml: string, sourceId: string): RawItem[] {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);

  return itemBlocks.map((block, index) => {
    const title = extractTag(block, "title") ?? `Digest ${index + 1}`;
    const url = extractTag(block, "link") ?? "";
    const linkedUrl = extractFirstLink(extractTag(block, "description") ?? "");

    return {
      id: `${sourceId}-${index + 1}-${url || title}`,
      sourceId,
      title,
      url,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "digest_feed",
        sourceType: "digest_feed",
        contentType: "digest_entry",
        canonicalHints: linkedUrl ? { linkedUrl } : undefined,
      }),
    };
  }).filter((item) => item.url);
}

export async function collectDigestFeedSource(source: Source, fetchImpl: typeof fetch = fetch): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  return parseDigestFeedItems(await response.text(), source.id);
}
