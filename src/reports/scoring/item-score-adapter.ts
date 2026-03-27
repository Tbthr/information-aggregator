import type { KindSignalStageInput, KindSignalStageOutput, SignalScores } from "./types";

/**
 * Item score adapter - placeholder boundary for article signals.
 *
 * TODO: 需要优化
 * - Define specific signals for articles (e.g., source authority, content length, etc.)
 * - Implement actual signal extraction logic
 * - Tune signal weights
 *
 * This placeholder returns zero signals for all article candidates.
 */
export function applyItemSignalScoring(input: KindSignalStageInput): KindSignalStageOutput {
  const { candidate } = input;

  // Placeholder: return zero signals until item signals are defined
  const signalScores: SignalScores = {
    freshness: 0,
    engagement: 0,
    quality: 0,
    sourceWeight: 0,
  };

  return { signalScores };
}
