import type { RankedCandidate } from "../types/index";

function relationshipPenalty(candidate: RankedCandidate): number {
  switch (candidate.relationshipToCanonical) {
    case "discussion":
      return 0.08;
    case "share":
      return 0.04;
    default:
      return 0;
  }
}

export function rankCandidates<T extends RankedCandidate>(candidates: T[]): Array<T & { finalScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      // 评分公式：sourceWeight 40% + freshness 35% + engagement 15% + contentQuality 10%
      finalScore:
        candidate.sourceWeightScore * 0.4 +
        candidate.freshnessScore * 0.35 +
        Math.min(1, candidate.engagementScore) * 0.15 +
        candidate.contentQualityAi * 0.1 -
        (candidate.contentType === "community_post" ? 0.12 : 0) -
        relationshipPenalty(candidate),
    }))
    .sort((left, right) => right.finalScore - left.finalScore);
}
