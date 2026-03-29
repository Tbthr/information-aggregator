import { type RawItem, type RawItemMetadata, type Source } from "../types/index";
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

export type AdapterFn = (source: Source) => Promise<RawItem[]>;

export interface CollectDependencies {
  adapters: Record<string, AdapterFn>;
  onSourceEvent?: (event: CollectSourceEvent) => void;
  /**
   * 并发配置（可选）
   * 默认为 undefined 表示顺序执行（向后兼容）
   * 设置后启用并行抓取
   */
  concurrency?: number;
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
  };

  return {
    ...item,
    metadataJson: JSON.stringify(normalizedMetadata),
  };
}

export async function collectSources(sources: Source[], dependencies: CollectDependencies): Promise<RawItem[]> {
  const { concurrency } = dependencies;

  // 如果未设置并发或并发为 1，使用顺序执行（向后兼容）
  if (concurrency === undefined || concurrency === 1) {
    return collectSourcesSequential(sources, dependencies);
  }

  // 并行执行
  logger.info("Using parallel collection", { concurrency, sourceCount: sources.length });

  const results = await processWithConcurrency(
    sources,
    { batchSize: sources.length, concurrency },
    async (source) => {
      const adapter = dependencies.adapters[source.kind];
      if (!adapter) {
        dependencies.onSourceEvent?.({
          sourceId: source.id,
          status: "failure",
          itemCount: 0,
          latencyMs: 0,
          error: `Missing adapter: ${source.kind}`,
        });
        return [];
      }

      try {
        const startedAt = Date.now();
        const collected = await adapter(source);
        const latencyMs = Date.now() - startedAt;

        dependencies.onSourceEvent?.({
          sourceId: source.id,
          status: collected.length === 0 ? "zero-items" : "success",
          itemCount: collected.length,
          latencyMs,
        });

        return collected.map((item) => normalizeCollectedItem(source, item));
      } catch (error) {
        dependencies.onSourceEvent?.({
          sourceId: source.id,
          status: "failure",
          itemCount: 0,
          latencyMs: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
  );

  return results.flat();
}

/**
 * 顺序收集（向后兼容的默认行为）
 */
async function collectSourcesSequential(sources: Source[], dependencies: CollectDependencies): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const source of sources) {
    const adapter = dependencies.adapters[source.kind];
    if (!adapter) {
      dependencies.onSourceEvent?.({
        sourceId: source.id,
        status: "failure",
        itemCount: 0,
        latencyMs: 0,
        error: `Missing adapter: ${source.kind}`,
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
