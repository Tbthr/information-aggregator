import type { Source, RawItem } from "../types/index";

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
      items.push(...collected);

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
