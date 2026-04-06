export interface RankableCandidate {
  id: string;
  sourceWeightScore: number;
  engagementScore: number;
}

export interface RankingOptions {
  sourceWeight: number;
  engagement: number;
}

export function rankCandidates<T extends RankableCandidate>(
  candidates: T[],
  options: RankingOptions = { sourceWeight: 0.4, engagement: 0.15 }
): Array<T & { finalScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      finalScore:
        candidate.sourceWeightScore * options.sourceWeight +
        candidate.engagementScore * options.engagement,
    }))
    .sort((left, right) => right.finalScore - left.finalScore);
}
