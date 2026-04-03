import { type AdapterFn, type RawItem, type Source } from "../types/index";
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

function normalizeCollectedItem(source: Source, item: RawItem): RawItem {
  return {
    ...item,
    sourceType: source.type,
    contentType: source.contentType,
    sourceName: source.name,
    tagFilter: source.tagIds,
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

  // 按 type 分组
  const byType = new Map<string, Source[]>();
  for (const source of sources) {
    const list = byType.get(source.type) ?? [];
    list.push(source);
    byType.set(source.type, list);
  }

  const types = Array.from(byType.keys());

  // Adapter 维度并发：最多同时运行 adapterConcurrency 个不同 type
  const allResults: RawItem[][] = await processWithConcurrency(
    types,
    { batchSize: adapterConcurrency, concurrency: adapterConcurrency },
    async (type) => {
      const typeSources = byType.get(type)!;
      const adapter = adapters[type];
      if (!adapter) {
        for (const s of typeSources) {
          onSourceEvent?.({ sourceId: s.id, status: "failure", itemCount: 0, error: `Missing adapter: ${type}` });
        }
        return [];
      }

      // Source 维度并发：同 type 内最多同时抓取 sourceConcurrency 个 source
      const results = await processWithConcurrency(
        typeSources,
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
