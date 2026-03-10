import type { RankedCandidate } from "../types/index";

export interface EnrichDependencies {
  limit?: number;
  scoreCandidate?: (candidate: RankedCandidate) => Promise<number>;
}

export async function enrichCandidates<T extends RankedCandidate>(
  candidates: T[],
  dependencies: EnrichDependencies = {},
): Promise<T[]> {
  const limit = dependencies.limit ?? 0;
  if (!dependencies.scoreCandidate || limit <= 0) {
    return candidates;
  }

  const enriched = [...candidates];
  for (const candidate of enriched.slice(0, limit)) {
    candidate.contentQualityAi = await dependencies.scoreCandidate(candidate);
  }

  return enriched;
}
