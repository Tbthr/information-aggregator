import type { NormalizedItem, RawItem } from "../types/index";
import { normalizeSnippet, normalizeTitle } from "./normalize-text";
import { normalizeUrl } from "./normalize-url";

export function normalizeItems(items: RawItem[]): NormalizedItem[] {
  return items.map((item) => {
    const canonicalUrl = normalizeUrl(item.url);
    const normalizedTitle = normalizeTitle(item.title);
    const normalizedSnippet = normalizeSnippet(item.snippet);

    return {
      id: item.id,
      rawItemId: item.id,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url,
      canonicalUrl,
      normalizedTitle,
      normalizedSnippet,
      normalizedText: [normalizedTitle, normalizedSnippet].filter(Boolean).join(" "),
      // The exact dedup key intentionally favors stable identity over downstream ranking hints.
      exactDedupKey: `${canonicalUrl}::${normalizedTitle}`,
      // Raw items stay immutable; normalization is stored separately so dedup rules can evolve safely.
      processedAt: item.fetchedAt,
    };
  });
}
