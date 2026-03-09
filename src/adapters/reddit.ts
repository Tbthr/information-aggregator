import type { RawItem, Source } from "../types/index";

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        url?: string;
        author?: string;
        subreddit?: string;
        created_utc?: number;
      };
    }>;
  };
}

export function parseRedditListing(payload: RedditListing, sourceId: string): RawItem[] {
  return (payload.data?.children ?? [])
    .map((child) => child.data)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => typeof item.title === "string" && typeof item.url === "string")
    .map((item) => ({
      id: `reddit-${item.id ?? item.url}`,
      sourceId,
      title: item.title,
      url: item.url,
      author: typeof item.author === "string" ? item.author : undefined,
      publishedAt: typeof item.created_utc === "number" ? new Date(item.created_utc * 1000).toISOString() : undefined,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({ provider: "reddit", subreddit: item.subreddit ?? null }),
    }));
}

export async function collectRedditSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  const payload = await response.json();

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Reddit payload");
  }

  return parseRedditListing(payload as RedditListing, source.id);
}
