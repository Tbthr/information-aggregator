import { type AdapterFn, type RawItem, type RawItemMetadata, type Source } from "../types/index";
import { parseRawItemMetadata } from "../utils/metadata";
import { processWithConcurrency } from "../ai/concurrency";
import { createLogger } from "../utils/logger";

const logger = createLogger("pipeline:collect");

export interface CollectSourceEvent {
  sourceId: string;
  status: "success" | "failure" | "zero-items";
  itemCount: number;
  latencyMs?: number;
  error?: string;
}

// Re-export AdapterFn from types for external use
export type { AdapterFn } from "../types/index";

export interface CollectDependencies {
  adapters: Record<string, AdapterFn>;
  onSourceEvent?: (event: CollectSourceEvent) => void;
  /** adapter 维度并发数（不同 kind 间） */
  adapterConcurrency: number;
  /** source 维度并发数（同 kind 内） */
  sourceConcurrency: number;
  /** 时间窗口（毫秒） */
  timeWindow: number;
}

function defaultProviderForSourceType(sourceType: Source["kind"]): string {
  return sourceType;
}

function defaultContentTypeForSourceType(sourceType: Source["kind"]): string {
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

  if (source.kind === "hn") {
    const hnId = item.id.replace(/^hn-/, "");
    return {
      externalUrl: item.url,
      discussionUrl: `https://news.ycombinator.com/item?id=${hnId}`,
    };
  }

  if (source.kind === "reddit") {
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
    provider: metadata?.provider ?? defaultProviderForSourceType(source.kind),
    sourceKind: metadata?.sourceKind ?? source.kind,
    contentType: metadata?.contentType ?? defaultContentTypeForSourceType(source.kind),
    engagement: metadata?.engagement,
    canonicalHints: buildCanonicalHints(source, item, metadata),
    subreddit: metadata?.subreddit,
    discoveredFrom: metadata?.discoveredFrom,
    sourceName: source.name,
  };

  return {
    ...item,
    metadataJson: JSON.stringify(normalizedMetadata),
    // 透传 source 的 topicIds
    filterContext: { topicIds: source.topicIds },
  };
}

export async function collectSources(sources: Source[], dependencies: CollectDependencies): Promise<RawItem[]> {
  return collectWithTwoLevelConcurrency(sources, dependencies);
}

/**
 * 两级并发收集:
 * 1. 按 source kind 分组
 * 2. Adapter 维度：最多同时运行 adapterConcurrency 个不同 kind 的 adapter
 * 3. Source 维度：同 kind 内最多同时抓取 sourceConcurrency 个 source
 */
export async function collectWithTwoLevelConcurrency(
  sources: Source[],
  dependencies: CollectDependencies,
): Promise<RawItem[]> {
  const { adapters, adapterConcurrency, sourceConcurrency, onSourceEvent, timeWindow } = dependencies;

  // 按 kind 分组
  const byKind = new Map<string, Source[]>();
  for (const source of sources) {
    const list = byKind.get(source.kind) ?? [];
    list.push(source);
    byKind.set(source.kind, list);
  }

  const kinds = Array.from(byKind.keys());

  // Adapter 维度并发：最多同时运行 adapterConcurrency 个不同 kind
  const allResults: RawItem[][] = await processWithConcurrency(
    kinds,
    { batchSize: adapterConcurrency, concurrency: adapterConcurrency },
    async (kind) => {
      const kindSources = byKind.get(kind)!;
      const adapter = adapters[kind];
      if (!adapter) {
        for (const s of kindSources) {
          onSourceEvent?.({ sourceId: s.id, status: "failure", itemCount: 0, error: `Missing adapter: ${kind}` });
        }
        return [];
      }

      // Source 维度并发：同 kind 内最多同时抓取 sourceConcurrency 个 source
      const results = await processWithConcurrency(
        kindSources,
        { batchSize: sourceConcurrency, concurrency: sourceConcurrency },
        async (source) => {
          const startedAt = Date.now();
          try {
            const collected = await adapter(source, { timeWindow });
            const latencyMs = Date.now() - startedAt;
            onSourceEvent?.({
              sourceId: source.id,
              status: collected.length === 0 ? "zero-items" : "success",
              itemCount: collected.length,
              latencyMs,
            });
            return collected.map((item) => normalizeCollectedItem(source, item));
          } catch (error) {
            const latencyMs = Date.now() - startedAt;
            onSourceEvent?.({
              sourceId: source.id,
              status: "failure",
              itemCount: 0,
              latencyMs,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          }
        },
      );
      return results.flat();
    },
  );

  return allResults.flat();
}
