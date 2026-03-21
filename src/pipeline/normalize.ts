import { type CanonicalRelationship, type NormalizedItem, type RawItem } from "../types/index";
import { parseRawItemMetadata } from "../utils/metadata";
import { normalizeTitle, normalizeWhitespace } from "./normalize-text";
import { normalizeUrl, resolveCanonicalUrl } from "./normalize-url";

function toBoundedEngagementScore(metadataJson: string): number {
  const metadata = parseRawItemMetadata(metadataJson);
  const score = metadata?.engagement?.score ?? 0;
  const comments = metadata?.engagement?.comments ?? 0;
  const total = Math.max(0, score) + Math.max(0, comments * 0.5);
  return Math.min(1, Math.log10(total + 1) / 2);
}

function resolveRelationship(
  item: Pick<RawItem, "url">,
  canonicalUrl: string,
  contentType: string | undefined,
): {
  linkedCanonicalUrl?: string;
  relationshipToCanonical: CanonicalRelationship;
  isDiscussionSource: boolean;
} {
  const normalizedUrl = normalizeUrl(item.url);
  const linksToCanonical = canonicalUrl !== normalizedUrl;

  if (!linksToCanonical) {
    return {
      relationshipToCanonical: "original",
      isDiscussionSource: false,
    };
  }

  if (contentType === "community_post") {
    return {
      linkedCanonicalUrl: canonicalUrl,
      relationshipToCanonical: "discussion",
      isDiscussionSource: true,
    };
  }

  return {
    linkedCanonicalUrl: canonicalUrl,
    relationshipToCanonical: "share",
    isDiscussionSource: false,
  };
}

export function normalizeItems(items: RawItem[]): NormalizedItem[] {
  return items.map((item) => {
    const metadata = parseRawItemMetadata(item.metadataJson);
    const canonicalUrl = resolveCanonicalUrl(item.url, metadata);
    const relation = resolveRelationship(item, canonicalUrl, metadata?.contentType);
    const normalizedTitle = normalizeTitle(item.title);

    return {
      id: item.id,
      rawItemId: item.id,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url,
      canonicalUrl,
      linkedCanonicalUrl: relation.linkedCanonicalUrl,
      relationshipToCanonical: relation.relationshipToCanonical,
      isDiscussionSource: relation.isDiscussionSource,
      normalizedTitle,
      normalizedText: [normalizedTitle, normalizeWhitespace(item.content ?? "")].filter(Boolean).join(" "),
      metadataJson: item.metadataJson,
      sourceType: metadata?.sourceType,
      contentType: metadata?.contentType,
      engagementScore: toBoundedEngagementScore(item.metadataJson),
      exactDedupKey: canonicalUrl,
      // Raw items stay immutable; normalization is stored separately so dedup rules can evolve safely.
      processedAt: item.fetchedAt,
      content: item.content,
    };
  });
}
