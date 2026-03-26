// Diagnostics Framework Collection Candidate Summary

import type { RunCollectJobResult, CandidateItem } from "../../pipeline/run-collect-job";
import type { RunCandidateSummary, RunCandidateItem } from "./types";

const DEFAULT_TOP_N = 20;

/**
 * Builds a run candidate summary from the orchestrator result.
 *
 * Uses the afterNearDedup candidates (the default level).
 * Selects top N by a reasonable ordering and maps to the diagnostic output format.
 */
export function buildRunCandidateSummary(
  orchestratorResult: RunCollectJobResult,
  level: "normalized" | "afterExactDedup" | "afterNearDedup" = "afterNearDedup",
  topN: number = DEFAULT_TOP_N
): RunCandidateSummary {
  // Currently all levels map to afterNear since we only expose candidates at that stage.
  // The level field indicates the intended dedup stage.
  const candidates = orchestratorResult.candidates;

  if (topN <= 0 || candidates.length === 0) {
    return {
      level,
      topItems: [],
    };
  }

  // Select top N candidates sorted by score descending
  const topItems: RunCandidateItem[] = candidates
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topN)
    .map((c: CandidateItem) => ({
      title: c.title,
      sourceId: c.sourceId,
      sourceName: c.sourceName,
      canonicalUrl: c.canonicalUrl,
    }));

  return {
    level,
    topItems,
  };
}
