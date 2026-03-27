import type { MergeStageInput, MergeStageOutput } from "./types";

/**
 * Merges base score and signal scores into a single runtime score.
 *
 * Input:
 * - baseScore: number (from base stage)
 * - signalScores: SignalScores (from kind-specific signal adapters)
 *
 * Output:
 * - runtimeScore: number (base + sum of all signal components)
 *
 * Logic:
 * - Sums all signal score components (engagement, freshness, quality, sourceWeight)
 * - Adds to base score to produce a comparable runtime score
 */
export function applyMergeStage(input: MergeStageInput): MergeStageOutput {
  const { baseScore, signalScores } = input;

  const signalTotal =
    (signalScores.engagement ?? 0) +
    (signalScores.freshness ?? 0) +
    (signalScores.quality ?? 0) +
    (signalScores.sourceWeight ?? 0);

  const runtimeScore = baseScore + signalTotal;

  return { runtimeScore };
}
