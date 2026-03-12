import { type RawItem, type RawItemMetadata, type Source } from "../types/index";
import { parseRawItemMetadata } from "../utils/metadata";

export interface CollectSourceEvent {
  sourceId: string;
  status: "success" | "failure" | "zero-items";
  itemCount: number;
  latencyMs?: number;
  error?: string;
}

export type AdapterFn = (source: Source) => Promise<RawItem[]>;

export interface CollectDependencies {
  adapters: Record<string, AdapterFn>;
  onSourceEvent?: (event: CollectSourceEvent) => void;
}

function defaultProviderForSourceType(sourceType: Source["type"]): string {
  return sourceType;
}

function defaultContentTypeForSourceType(sourceType: Source["type"]): string {
  switch (sourceType) {
    case "hn":
    case "reddit":
      return "community_post";
    case "website":
      return "page";
    default:
      return "article";
  }
}

function buildCanonicalHints(source: Source, item: RawItem, metadata: RawItemMetadata | null): RawItemMetadata["canonicalHints"] {
  if (metadata?.canonicalHints) {
    return metadata.canonicalHints;
  }

  if (source.type === "hn") {
    const hnId = item.id.replace(/^hn-/, "");
    return {
      externalUrl: item.url,
      discussionUrl: `https://news.ycombinator.com/item?id=${hnId}`,
    };
  }

  if (source.type === "reddit") {
    return {
      externalUrl: item.url,
      discussionUrl: `https://www.reddit.com/r/artificial/comments/${item.id.replace(/^reddit-/, "")}`,
    };
  }

  return undefined;
}

function normalizeCollectedItem(source: Source, item: RawItem): RawItem {
  const metadata = parseRawItemMetadata(item.metadataJson);
  const normalizedMetadata: RawItemMetadata = {
    provider: metadata?.provider ?? defaultProviderForSourceType(source.type),
    sourceType: metadata?.sourceType ?? source.type,
    contentType: metadata?.contentType ?? defaultContentTypeForSourceType(source.type),
    engagement: metadata?.engagement,
    canonicalHints: buildCanonicalHints(source, item, metadata),
    subreddit: metadata?.subreddit,
    discoveredFrom: metadata?.discoveredFrom,
  };

  return {
    ...item,
    metadataJson: JSON.stringify(normalizedMetadata),
  };
}

export async function collectSources(sources: Source[], dependencies: CollectDependencies): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const source of sources) {
    const adapter = dependencies.adapters[source.type];
    if (!adapter) {
      dependencies.onSourceEvent?.({
        sourceId: source.id,
        status: "failure",
        itemCount: 0,
        latencyMs: 0,
        error: `Missing adapter: ${source.type}`,
      });
      continue;
    }

    try {
      const startedAt = Date.now();
      const collected = await adapter(source);
      const latencyMs = Date.now() - startedAt;
      items.push(...collected.map((item) => normalizeCollectedItem(source, item)));

      dependencies.onSourceEvent?.({
        sourceId: source.id,
        status: collected.length === 0 ? "zero-items" : "success",
        itemCount: collected.length,
        latencyMs,
      });
    } catch (error) {
      const latencyMs = 0;
      dependencies.onSourceEvent?.({
        sourceId: source.id,
        status: "failure",
        itemCount: 0,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return items;
}
