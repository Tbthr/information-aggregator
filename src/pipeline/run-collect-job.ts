/**
 * Shared collect job orchestrator
 *
 * Encapsulates the full collect pipeline:
 *  - pack/source sync
 *  - source collection
 *  - normalization
 *  - exact + near deduplication
 *  - archival
 *  - AI enrichment
 *  - source health tracking
 *
 * Used by both the cron route and the diagnostics framework.
 */

import { loadAllPacksFromDb } from "../config/load-pack-prisma";
import { generateSourceId } from "../config/source-id";
import { collectSources, type CollectDependencies, type CollectSourceEvent, type AdapterFn } from "./collect";
import { normalizeItems } from "./normalize";
import { dedupeExact } from "./dedupe-exact";
import { dedupeNear } from "./dedupe-near";
import {
  archiveRawItems,
  syncPacksToPrisma,
  upsertSourcesBatch,
  recordSourcesSuccessBatch,
  recordSourceFailure,
} from "../archive/upsert-prisma";
import { getItemsToEnrich, enrichItems } from "../archive/enrich-prisma";
import { createAiClient } from "../ai/providers";
import { buildAdapters } from "../adapters/build-adapters";
import type { RawItem, NormalizedItem, SourcePack, SourceType } from "../types/index";
import type { Logger } from "../utils/logger";

export interface SourceFailure {
  sourceId: string;
  error: string;
}

export interface ArchiveCounts {
  newCount: number;
  updateCount: number;
}

export interface PipelineCounts {
  raw: number;
  normalized: number;
  afterExactDedup: number;
  afterNearDedup: number;
  archivedNew: number;
  archivedUpdated: number;
}

export interface RunCollectJobResult {
  sourceEvents: CollectSourceEvent[];
  counts: PipelineCounts;
  archived: ArchiveCounts;
  failures: SourceFailure[];
}

export interface RunCollectJobOptions {
  logger?: Logger;
  /**
   * Optional callback invoked for each source event during collection.
   */
  onSourceEvent?: (event: CollectSourceEvent) => void;
  /**
   * Optional packs to use instead of loading from DB (for testing).
   */
  packs?: SourcePack[];
  /**
   * Optional adapters to use instead of building default adapters (for testing).
   */
  adapters?: Record<string, AdapterFn>;
}

/**
 * Resolved source for collection (internal helper)
 */
interface ResolvedSource {
  id: string;
  type: SourceType;
  url: string;
  description?: string;
  packId: string;
  configJson?: string;
}

/**
 * Resolve enabled sources from packs, deduplicating by URL.
 */
function resolveSourcesForCollection(packs: SourcePack[]): ResolvedSource[] {
  const seen = new Set<string>();
  const sources: ResolvedSource[] = [];
  for (const pack of packs) {
    for (const source of pack.sources) {
      if (!source.enabled && source.enabled !== undefined) continue;
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      sources.push({
        ...source,
        id: generateSourceId(source.url),
        packId: pack.id,
      });
    }
  }
  return sources;
}

/**
 * Run the full collect job pipeline.
 *
 * Returns structured results so callers (cron, diagnostics) can
 * inspect counts, events, and failures without re-running anything.
 */
export async function runCollectJob(options: RunCollectJobOptions = {}): Promise<RunCollectJobResult> {
  const { logger, onSourceEvent } = options;

  const log = (msg: string, data?: Record<string, unknown>) => {
    logger?.info(msg, data);
  };

  // ── 1. Load packs ────────────────────────────────────────────────
  log("Starting collect job");

  const packs = options.packs ?? await loadAllPacksFromDb();

  // ── 2. Sync packs to DB ────────────────────────────────────────
  const packRecords = packs.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
  await syncPacksToPrisma(packRecords);

  // ── 3. Sync sources to DB ─────────────────────────────────────
  const allSources: Array<{
    id: string;
    type: string;
    name?: string;
    enabled: boolean;
    url?: string;
    configJson?: string;
    packId?: string;
  }> = [];

  for (const pack of packs) {
    for (const source of pack.sources) {
      allSources.push({
        id: generateSourceId(source.url),
        type: source.type,
        name: source.description,
        enabled: source.enabled !== false,
        url: source.url,
        configJson: source.configJson,
        packId: pack.id,
      });
    }
  }
  await upsertSourcesBatch(allSources);

  // ── 4. Resolve sources for collection ─────────────────────────
  const sources = resolveSourcesForCollection(packs);

  log("Collecting from sources", { count: sources.length });

  // ── 5. Collect from sources ────────────────────────────────────
  const failedSources: SourceFailure[] = [];
  const sourceEvents: CollectSourceEvent[] = [];

  const dependencies: CollectDependencies = {
    adapters: options.adapters ?? buildAdapters(),
    concurrency: 3,
    onSourceEvent: (event) => {
      logger?.info("Source event", {
        sourceId: event.sourceId,
        status: event.status,
        itemCount: event.itemCount,
      });
      sourceEvents.push(event);
      onSourceEvent?.(event);
      if (event.status === "failure") {
        failedSources.push({
          sourceId: event.sourceId,
          error: event.error || "Unknown error",
        });
      }
    },
  };

  const rawItems = await collectSources(sources, dependencies);
  log("Collected items", { count: rawItems.length });

  // ── 6. Normalize ───────────────────────────────────────────────
  const normalized = normalizeItems(rawItems);
  log("Normalized items", { count: normalized.length });

  // ── 7. Exact dedup ─────────────────────────────────────────────
  const noExactKey = normalized.filter((i) => !i.exactDedupKey);
  if (noExactKey.length > 0) {
    log("Items dropped: missing exactDedupKey", { count: noExactKey.length });
  }
  const afterExact = dedupeExact(
    normalized.filter((i): i is NormalizedItem & { exactDedupKey: string } => !!i.exactDedupKey)
  );

  // ── 8. Near dedup ──────────────────────────────────────────────
  const noProcessedAt = afterExact.filter((i) => !i.processedAt);
  if (noProcessedAt.length > 0) {
    log("Items dropped: missing processedAt", { count: noProcessedAt.length });
  }
  const afterNear = dedupeNear(
    afterExact.filter(
      (i): i is NormalizedItem & { exactDedupKey: string; processedAt: string } => !!i.processedAt
    )
  );

  // Convert NormalizedItem[] back to RawItem[] for archival
  const dedupedRawItems: RawItem[] = afterNear.map((item): RawItem => ({
    id: item.id,
    sourceId: item.sourceId ?? "",
    title: item.title ?? "",
    url: item.canonicalUrl ?? item.url ?? "",
    fetchedAt: item.processedAt ?? new Date().toISOString(),
    metadataJson: item.metadataJson ?? "{}",
    publishedAt: item.publishedAt,
    author: undefined,
    content: item.content,
  }));

  log("After dedup", { original: rawItems.length, deduped: dedupedRawItems.length });

  // ── 9. Archive ─────────────────────────────────────────────────
  const now = new Date().toISOString();
  const sourceNameMap = Object.fromEntries(sources.map((s) => [s.id, s.description ?? s.id]));
  const archiveResult = await archiveRawItems(dedupedRawItems, now, sourceNameMap);
  log("Archived items", { newCount: archiveResult.newCount, updateCount: archiveResult.updateCount });

  // ── 10. AI enrichment ─────────────────────────────────────────
  if (archiveResult.newCount > 0) {
    const aiClient = createAiClient();
    if (aiClient) {
      const newItemIds = archiveResult.newItemIds;
      const enrichItemIds = await getItemsToEnrich("new", newItemIds);
      if (enrichItemIds.length > 0) {
        log("Enriching items", { count: enrichItemIds.length });
        const enrichResult = await enrichItems(enrichItemIds, aiClient);
        log("Enriched items", {
          success: enrichResult.successCount,
          failed: enrichResult.failCount,
        });
      }
    }
  }

  // ── 11. Record source failures ─────────────────────────────────
  const failedSourceIds = new Set(failedSources.map((s) => s.sourceId));
  if (failedSources.length > 0) {
    await Promise.allSettled(failedSources.map((s) => recordSourceFailure(s.sourceId, s.error)));
  }

  // ── 12. Record source successes ────────────────────────────────
  const healthRecords = sources
    .filter((source) => !failedSourceIds.has(source.id))
    .map((source) => {
      const sourceItems = rawItems.filter((i) => i.sourceId === source.id);
      return { sourceId: source.id, fetchedAt: now, itemCount: sourceItems.length };
    })
    .filter((r) => r.itemCount > 0);
  await recordSourcesSuccessBatch(healthRecords);

  log("Collect job completed");

  // ── Build result ───────────────────────────────────────────────
  return {
    sourceEvents,
    counts: {
      raw: rawItems.length,
      normalized: normalized.length,
      afterExactDedup: afterExact.length,
      afterNearDedup: afterNear.length,
      archivedNew: archiveResult.newCount,
      archivedUpdated: archiveResult.updateCount,
    },
    archived: {
      newCount: archiveResult.newCount,
      updateCount: archiveResult.updateCount,
    },
    failures: failedSources,
  };
}
