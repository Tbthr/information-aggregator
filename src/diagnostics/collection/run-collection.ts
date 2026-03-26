// Diagnostics Framework Collection Run

import { runCollectJob } from "../../pipeline/run-collect-job";
import type { RunCollectJobResult } from "../../pipeline/run-collect-job";
import type { RunCounts, SourceEvent } from "./types";

export interface RunCollectionResult {
  triggered: boolean;
  sourceEvents: SourceEvent[];
  counts: RunCounts;
}

/**
 * Triggers a real collection run using the shared orchestrator.
 *
 * This is only called when --run-collection flag is passed.
 * It runs the full collect pipeline (fetch, normalize, dedup, archive) and
 * returns structured results for diagnostics reporting.
 */
export async function runCollection(): Promise<RunCollectionResult> {
  const result: RunCollectJobResult = await runCollectJob();

  const sourceEvents: SourceEvent[] = result.sourceEvents.map((event: RunCollectJobResult["sourceEvents"][number]) => ({
    sourceId: event.sourceId,
    status: event.status,
    itemCount: event.itemCount,
    latencyMs: event.latencyMs,
    error: event.error,
  }));

  const counts: RunCounts = {
    raw: result.counts.raw,
    normalized: result.counts.normalized,
    afterExactDedup: result.counts.afterExactDedup,
    afterNearDedup: result.counts.afterNearDedup,
    archivedNew: result.counts.archivedNew,
    archivedUpdated: result.counts.archivedUpdated,
  };

  return {
    triggered: true,
    sourceEvents,
    counts,
  };
}
