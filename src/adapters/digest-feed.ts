import type { RawItem, Source } from "../types/index";

interface DigestFeedConfig {
  format?: string;
  itemPath?: string;
  contentField?: string;
}

function extractTag(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  return block.match(pattern)?.[1]?.trim();
}

function extractFirstLink(html: string): string | undefined {
  return html.match(/<a[^>]+href="([^"]+)"/i)?.[1];
}

function extractFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s)"'<>]+/i)?.[0];
}

function getDigestFeedConfig(source: Source): DigestFeedConfig {
  return JSON.parse(source.configJson ?? "{}") as DigestFeedConfig;
}

function getValueAtPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, payload);
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

function parseDigestFeedJson(payload: unknown, sourceId: string, config: DigestFeedConfig): RawItem[] {
  const itemPath = typeof config.itemPath === "string" ? config.itemPath : "digests";
  const contentField = typeof config.contentField === "string" ? config.contentField : "content";
  const items = getValueAtPath(payload, itemPath);
  if (!Array.isArray(items)) {
    throw new Error("digest_feed json format requires config.itemPath to resolve to an array");
  }

  return items.map((item, index) => {
    const record = item as Record<string, unknown>;
    const content = typeof record[contentField] === "string" ? record[contentField] : "";
    const linkedUrl = extractFirstUrl(content);
    const titleId = record.id ?? index + 1;

    return {
      id: `${sourceId}-${titleId}`,
      sourceId,
      title: `Digest ${String(titleId)}`,
      url: linkedUrl ?? "",
      snippet: content || undefined,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "digest_feed",
        sourceType: "digest_feed",
        contentType: "digest_entry",
        canonicalHints: linkedUrl ? { linkedUrl } : undefined,
      }),
    };
  }).filter((item) => item.url !== "");
}

export async function collectDigestFeedSource(source: Source, fetchImpl: typeof fetch = fetch): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  const config = getDigestFeedConfig(source);
  if (config.format === "json") {
    return parseDigestFeedJson(await response.json(), source.id, config);
  }

  return parseDigestFeedItems(await response.text(), source.id);
}
