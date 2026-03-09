import type { RawItem, Source } from "../types/index";

interface HnItem {
  id?: number;
  title?: string;
  url?: string;
  by?: string;
  time?: number;
  score?: number;
}

export function parseHnItems(payload: HnItem[], sourceId: string): RawItem[] {
  return payload
    .filter((item) => typeof item.title === "string" && typeof item.url === "string")
    .map((item) => ({
      id: `hn-${item.id ?? item.url}`,
      sourceId,
      title: String(item.title),
      url: String(item.url),
      author: typeof item.by === "string" ? item.by : undefined,
      publishedAt: typeof item.time === "number" ? new Date(item.time * 1000).toISOString() : undefined,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({ provider: "hn", score: item.score ?? null }),
    }));
}

export async function collectHnSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Invalid Hacker News payload");
  }

  return parseHnItems(payload, source.id);
}
