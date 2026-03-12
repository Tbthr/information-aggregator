import type { RawItem, Source } from "../types/index";

interface DigestFeedConfig {
  format?: string;
  itemPath?: string;
  contentField?: string;
}

interface DigestItemMetadata {
  provider: string;
  sourceType: string;
  contentType: string;
  canonicalHints?: { linkedUrl?: string };
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

/**
 * 解析 XML 格式的 Digest Feed
 */
export function parseDigestFeedItems(xml: string, sourceId: string): RawItem[] {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);

  return itemBlocks
    .map((block, index) => {
      try {
        const title = extractTag(block, "title") ?? `Digest ${index + 1}`;
        const url = extractTag(block, "link") ?? "";
        const description = extractTag(block, "description") ?? "";
        const pubDateStr = extractTag(block, "pubDate");

        // 解析发布时间
        let publishedAt: string | undefined;
        if (pubDateStr) {
          const parsed = Date.parse(pubDateStr);
          if (!Number.isNaN(parsed)) {
            publishedAt = new Date(parsed).toISOString();
          }
        }

        const linkedUrl = extractFirstLink(description);
        // 规范化 snippet：移除标签并将多个空格合并为一个
        const snippet = description ? description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined;

        const metadata: DigestItemMetadata = {
          provider: "digest_feed",
          sourceType: "digest_feed",
          contentType: "digest_entry",
        };

        if (linkedUrl) {
          metadata.canonicalHints = { linkedUrl };
        }

        return {
          id: `${sourceId}-${index + 1}-${url || title}`,
          sourceId,
          title,
          url,
          snippet,
          publishedAt,
          fetchedAt: new Date().toISOString(),
          metadataJson: JSON.stringify(metadata),
        };
      } catch (error) {
        console.warn(`[digest-feed] Failed to parse XML item ${index + 1}:`, error);
        return null;
      }
    })
    .filter((item): item is RawItem => item !== null && item.url !== "");
}

/**
 * 解析 JSON 格式的 Digest Feed
 */
function parseDigestFeedJson(payload: unknown, sourceId: string, config: DigestFeedConfig): RawItem[] {
  const itemPath = typeof config.itemPath === "string" ? config.itemPath : "digests";
  const contentField = typeof config.contentField === "string" ? config.contentField : "content";
  const items = getValueAtPath(payload, itemPath);

  if (!Array.isArray(items)) {
    throw new Error("digest_feed json format requires config.itemPath to resolve to an array");
  }

  return items
    .map((item, index) => {
      try {
        const record = item as Record<string, unknown>;
        const content = typeof record[contentField] === "string" ? record[contentField] : "";
        const linkedUrl = extractFirstUrl(content);
        const titleId = record.id ?? index + 1;

        // 尝试提取发布时间字段
        let publishedAt: string | undefined;
        const dateFields = ["publishedAt", "published_at", "date", "createdAt", "created_at", "timestamp"];
        for (const field of dateFields) {
          const value = record[field];
          if (value) {
            const parsed = Date.parse(String(value));
            if (!Number.isNaN(parsed)) {
              publishedAt = new Date(parsed).toISOString();
              break;
            }
          }
        }

        const metadata: DigestItemMetadata = {
          provider: "digest_feed",
          sourceType: "digest_feed",
          contentType: "digest_entry",
        };

        if (linkedUrl) {
          metadata.canonicalHints = { linkedUrl };
        }

        return {
          id: `${sourceId}-${String(titleId)}`,
          sourceId,
          title: `Digest ${String(titleId)}`,
          url: linkedUrl ?? "",
          snippet: content || undefined,
          publishedAt,
          fetchedAt: new Date().toISOString(),
          metadataJson: JSON.stringify(metadata),
        };
      } catch (error) {
        console.warn(`[digest-feed] Failed to parse JSON item ${index + 1}:`, error);
        return null;
      }
    })
    .filter((item): item is RawItem => item !== null && item.url !== "");
}

/**
 * 收集 Digest Feed 数据源
 */
export async function collectDigestFeedSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const url = source.url ?? "";

  if (!url) {
    throw new Error("Digest Feed source requires a URL");
  }

  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(15000), // 15 秒超时
    });

    if (!response.ok) {
      throw new Error(`Digest Feed returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const config = getDigestFeedConfig(source);

    // 根据配置或内容类型决定解析方式
    const useJson = config.format === "json" || contentType.includes("application/json");

    if (useJson) {
      const payload = await response.json();
      return parseDigestFeedJson(payload, source.id, config);
    }

    const xml = await response.text();

    if (xml.length === 0) {
      throw new Error("Digest Feed returned empty response");
    }

    // 验证是否包含预期的 XML 结构
    if (!xml.includes("<item")) {
      throw new Error("Digest Feed XML structure changed: no <item> elements found");
    }

    return parseDigestFeedItems(xml, source.id);
  } catch (error) {
    // 区分不同类型的错误
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Failed to fetch Digest Feed: ${error.message}`);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Digest Feed request timed out after 15 seconds");
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse Digest Feed response: ${error.message}`);
    }
    throw error;
  }
}
