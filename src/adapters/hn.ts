import type { RawItem, Source } from "../types/index";

interface HnItem {
  id?: number | string;
  objectID?: string;
  title?: string;
  url?: string;
  by?: string;
  author?: string;
  time?: number;
  created_at_i?: number;
  score?: number;
  points?: number;
}

export function parseHnItems(payload: HnItem[], sourceId: string): RawItem[] {
  return payload
    .filter((item) => typeof item.title === "string" && typeof item.url === "string")
    .map((item) => ({
      id: `hn-${item.id ?? item.objectID ?? item.url}`,
      sourceId,
      title: String(item.title),
      url: String(item.url),
      author: typeof item.by === "string" ? item.by : typeof item.author === "string" ? item.author : undefined,
      publishedAt: typeof item.time === "number"
        ? new Date(item.time * 1000).toISOString()
        : typeof item.created_at_i === "number"
          ? new Date(item.created_at_i * 1000).toISOString()
          : undefined,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "hn",
        sourceType: "hn",
        contentType: "community_post",
        engagement: item.score === undefined && item.points === undefined ? undefined : { score: item.score ?? item.points },
        canonicalHints: {
          externalUrl: item.url,
          discussionUrl: item.id === undefined && item.objectID === undefined
            ? undefined
            : `https://news.ycombinator.com/item?id=${item.id ?? item.objectID}`,
        },
      }),
    }));
}

function getHnItems(payload: unknown): HnItem[] {
  if (Array.isArray(payload)) {
    return payload as HnItem[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { hits?: unknown[] }).hits)) {
    return (payload as { hits: HnItem[] }).hits;
  }

  throw new Error(`Invalid Hacker News payload: expected array or { hits: [] }, received ${typeof payload}`);
}

export async function collectHnSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  const payload = await response.json();

  return parseHnItems(getHnItems(payload), source.id);
}
