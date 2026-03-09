import type { RankedCandidate } from "../types/index";

export function rankCandidates<T extends RankedCandidate>(candidates: T[]): Array<T & { finalScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      // The ranker stays mixed-score so deterministic source/freshness signals can bound optional AI noise.
      finalScore:
        candidate.sourceWeightScore * 0.3 +
        candidate.freshnessScore * 0.25 +
        candidate.engagementScore * 0.1 +
        candidate.topicMatchScore * 0.25 +
        candidate.contentQualityAi * 0.1,
    }))
    .sort((left, right) => right.finalScore - left.finalScore);
}
