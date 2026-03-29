/**
 * Shared collect job orchestrator
 *
 * Encapsulates the full collect pipeline:
 *  - pack/source sync
 *  - source collection
 *  - normalization
 *  - exact + near deduplication
 *  - archival
 *  - source health tracking
 *
 * Used by both the cron route and the diagnostics framework.
 */

import { loadAllPacksFromDb } from "../config/load-pack-prisma";
import { generateSourceId } from "../config/source-id";
import { collectSources, type CollectDependencies, type CollectSourceEvent, type AdapterFn } from "./collect";
import { normalizeItems } from "./normalize";
import { filterByPack } from "./filter-by-pack";
import { dedupeExact } from "./dedupe-exact";
import { dedupeNear } from "./dedupe-near";
import {
  archiveContentItems,
  type ContentArchiveInput,
  syncPacksToPrisma,
  upsertSourcesBatch,
  recordSourcesSuccessBatch,
  recordSourceFailure,
} from "../archive/upsert-content-prisma";
import { buildAdapters } from "../adapters/build-adapters";
import type { RawItem, NormalizedItem, SourcePack, SourceKind, ContentKind } from "../types/index";
import type { Logger } from "../utils/logger";

/**
 * Unsupported source types that should be skipped during collection.
 * These sources are intentionally not supported in the new pipeline.
 */
const UNSUPPORTED_SOURCE_KDS: SourceKind[] = ["github-trending" as SourceKind];

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
  afterPackFilter: number;
  afterExactDedup: number;
  afterNearDedup: number;
  archivedNew: number;
  archivedUpdated: number;
}

/**
 * Candidate item from the orchestrator, after near-dedup stage.
 * Used by diagnostics to build candidate summaries.
 */
export interface CandidateItem {
  id: string;
  title: string;
  sourceId: string;
  sourceName: string;
  canonicalUrl: string;
  score: number;
}

export interface RunCollectJobResult {
  sourceEvents: CollectSourceEvent[];
  counts: PipelineCounts;
  archived: ArchiveCounts;
  failures: SourceFailure[];
  /**
   * Candidate items after near-dedup, before archival.
   * Used by diagnostics to build candidate summaries.
   */
  candidates: CandidateItem[];
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
  kind: SourceKind;
  url: string;
  description?: string;
  packId: string;
  configJson?: string;
}

/**
 * Resolve enabled sources from packs, deduplicating by URL.
 * Filters out unsupported source kinds (e.g., github-trending).
 */
function resolveSourcesForCollection(packs: SourcePack[]): ResolvedSource[] {
  const seen = new Set<string>();
  const sources: ResolvedSource[] = [];
  for (const pack of packs) {
    for (const source of pack.sources) {
      // Skip unsupported source kinds
      if (UNSUPPORTED_SOURCE_KDS.includes(source.kind)) {
        continue;
      }
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

  // ── 0. Job start timestamp (shared across all stages) ───────────
  const jobStartedAt = new Date().toISOString();

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
    kind: string;
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
        kind: source.kind,
        name: source.description,
        enabled: source.enabled !== false,
        url: source.url,
        configJson: source.configJson,
        packId: pack.id,
      });
    }
  }
  await upsertSourcesBatch(allSources);

  // ── 4. Resolve sources for collection (filters unsupported types) ─
  const sources = resolveSourcesForCollection(packs);

  log("Collecting from sources", { count: sources.length });

  // Build sourceNameMap for later use
  const sourceNameMap = Object.fromEntries(sources.map((s) => [s.id, s.description ?? s.id]));

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

  // ── 7. Filter by pack (topic-based during migration) ─────────────
  // items without filterContext are kept (no filtering)
  const afterTopicFilter = normalized.filter((item) => {
    if (!item.filterContext) return true;
    return filterByPack(item, item.filterContext);
  });
  log("After topic filter", { before: normalized.length, after: afterTopicFilter.length });

  // ── 8. Exact dedup ─────────────────────────────────────────────
  const afterExact = dedupeExact(afterTopicFilter);

  // ── 9. Near dedup ──────────────────────────────────────────────
  const afterNear = dedupeNear(afterExact);

  log("After dedup", { original: rawItems.length, deduped: afterNear.length });

  // ── 10. Archive as Content ────────────────────────────────────────
  // Build Content archive input from NormalizedItem[] with proper field mapping
  const archiveInput: ContentArchiveInput[] = afterNear.map((item) => {
    // Parse author from metadataJson
    let authorLabel: string | null = null;
    try {
      const metadata = JSON.parse(item.metadataJson);
      authorLabel = metadata.authorName ?? null;
    } catch {
      authorLabel = null;
    }

    return {
      id: item.id,
      kind: item.contentType as ContentKind,
      title: item.normalizedTitle,
      body: item.normalizedContent || null,
      url: item.normalizedUrl,
      authorLabel,
      publishedAt: item.publishedAt ?? null,
      fetchedAt: jobStartedAt,
      engagementScore: item.engagementScore ?? null,
      topicIds: item.filterContext?.topicIds ?? [],
      topicScoresJson: null,
      metadataJson: item.metadataJson,
      sourceId: item.sourceId,
    };
  });

  // Build candidate items from afterNear dedup stage for diagnostics
  const candidates: CandidateItem[] = afterNear.map((item) => ({
    id: item.id,
    title: item.title ?? "",
    sourceId: item.sourceId ?? "",
    sourceName: sourceNameMap[item.sourceId ?? ""] ?? item.sourceId ?? "",
    canonicalUrl: item.normalizedUrl,
    score: 0, // engagementScore removed from NormalizedItem
  }));

  const archiveResult = await archiveContentItems(archiveInput);
  log("Archived content", { newCount: archiveResult.newCount, updateCount: archiveResult.updateCount });

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
      return { sourceId: source.id, fetchedAt: jobStartedAt, itemCount: sourceItems.length };
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
      afterPackFilter: afterTopicFilter.length,
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
    candidates,
  };
}
