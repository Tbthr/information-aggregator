import { type NormalizedItem, type RawItem } from "../types/index";
import { normalizeTitle, normalizeSummary, normalizeContent } from "./normalize-text";
import { normalizeUrl } from "./normalize-url";

interface RawItemMetadata {
  provider?: string;
  sourceType?: string;
  contentType?: string;
  authorName?: string;
  summary?: string;
  content?: string;
}

function parseMetadata(metadataJson: string): RawItemMetadata {
  try {
    return JSON.parse(metadataJson);
  } catch {
    return {};
  }
}

export function normalizeItem(item: RawItem): NormalizedItem {
  const metadata = parseMetadata(item.metadataJson);

  return {
    id: item.id,
    sourceId: item.sourceId,
    title: item.title,
    publishedAt: item.publishedAt,
    sourceType: metadata.sourceType as NormalizedItem["sourceType"],
    contentType: "article", // fixed to article per spec
    normalizedUrl: normalizeUrl(item.url),
    normalizedTitle: normalizeTitle(item.title),
    normalizedSummary: normalizeSummary(metadata.summary ?? ""),
    normalizedContent: normalizeContent(metadata.content ?? ""),
    metadataJson: item.metadataJson,
    filterContext: item.filterContext,
  };
}

/**
 * @deprecated Use normalizeItem for new code. This produces article-only items.
 */
export function normalizeItems(items: RawItem[]): NormalizedItem[] {
  return items.map(normalizeItem);
}
