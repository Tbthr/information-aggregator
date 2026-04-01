export interface RankableCandidate {
  id: string;
  sourceWeightScore: number;
  engagementScore: number;
}

export function rankCandidates<T extends RankableCandidate>(candidates: T[]): Array<T & { finalScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      // 简化评分公式：sourceWeightScore × 0.4 + engagementScore × 0.15
      finalScore:
        candidate.sourceWeightScore * 0.4 +
        candidate.engagementScore * 0.15,
    }))
    .sort((left, right) => right.finalScore - left.finalScore);
}
