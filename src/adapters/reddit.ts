import type { RawItem, Source } from "../types/index";

interface RedditListingItem {
  id?: string;
  title?: string;
  url?: string;
  url_overridden_by_dest?: string;
  permalink?: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  num_comments?: number;
}

interface RedditListing {
  data?: {
    children?: Array<{
      data?: RedditListingItem;
    }>;
  };
}

function isRedditLinkPost(item: RedditListingItem | undefined): item is RedditListingItem & { title: string; url: string } {
  return item !== undefined && typeof item.title === "string" && typeof item.url === "string";
}

export function parseRedditListing(payload: RedditListing, sourceId: string): RawItem[] {
  return (payload.data?.children ?? [])
    .map((child) => child.data)
    .filter(isRedditLinkPost)
    .map((item) => ({
      id: `reddit-${item.id ?? item.url}`,
      sourceId,
      title: item.title,
      url: item.url_overridden_by_dest ?? item.url,
      author: typeof item.author === "string" ? item.author : undefined,
      publishedAt: typeof item.created_utc === "number" ? new Date(item.created_utc * 1000).toISOString() : undefined,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "reddit",
        sourceType: "reddit",
        contentType: "community_post",
        engagement: {
          score: item.score,
          comments: item.num_comments,
        },
        canonicalHints: {
          externalUrl: item.url_overridden_by_dest ?? item.url,
          discussionUrl: typeof item.permalink === "string" ? new URL(item.permalink, "https://www.reddit.com").toString() : item.url,
        },
        subreddit: item.subreddit ?? undefined,
      }),
    }));
}

export async function collectRedditSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const response = await fetchImpl(new Request(source.url ?? "", {
    headers: {
      accept: "application/json",
      "user-agent": "information-aggregator/0.1 (+https://local.dev)",
    },
  }));
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Reddit request failed with ${response.status}: ${rawText.slice(0, 160)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error(`Failed to parse Reddit JSON: ${rawText.slice(0, 160)}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Reddit payload");
  }

  return parseRedditListing(payload as RedditListing, source.id);
}
