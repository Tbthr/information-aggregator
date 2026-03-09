import type { RawItem } from "../types/index";

interface JsonFeedItem {
  id?: string;
  title?: string;
  url?: string;
  external_url?: string;
  content_text?: string;
  content_html?: string;
  date_published?: string;
}

interface JsonFeedPayload {
  version?: string;
  items?: JsonFeedItem[];
}

export function parseJsonFeedItems(payload: JsonFeedPayload, sourceId: string): RawItem[] {
  if (!Array.isArray(payload.items)) {
    throw new Error("Invalid JSON Feed payload");
  }

  return payload.items
    .map((item, index) => ({
      id: item.id ?? `${sourceId}-${index + 1}`,
      sourceId,
      title: item.title ?? `Untitled ${index + 1}`,
      url: item.url ?? item.external_url ?? "",
      snippet: item.content_text ?? item.content_html ?? "",
      publishedAt: item.date_published,
      fetchedAt: new Date().toISOString(),
      metadataJson: "{}",
    }))
    .filter((item) => item.url);
}
