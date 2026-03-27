import type { HistoryPenaltyStageInput, HistoryPenaltyStageOutput } from "./types";

const DEFAULT_WINDOW_DAYS = 14;
const TITLE_SIMILARITY_THRESHOLD = 0.75;
const EXACT_URL_PENALTY = 0.5;   // 50% reduction for exact URL match
const NEAR_TITLE_PENALTY = 0.2;  // 20% reduction for near title match
const MAX_PENALTY = 0.9;        // Cap penalty at 90% reduction

/**
 * Applies history penalty based on recent report candidates.
 *
 * Input:
 * - runtimeScore: number (from merge stage)
 * - candidate: ReportCandidate to score
 * - recentCandidates: ReportCandidate[] from last N days
 * - windowDays: number (default 14)
 *
 * Output:
 * - historyPenalty: number (0 to 1, where 1 = full penalty)
 * - finalScore: number (runtimeScore * (1 - historyPenalty))
 *
 * Logic:
 * - Check normalizedUrl exact match against recent history
 * - Check normalizedTitle near match (threshold 0.75) against recent history
 * - Penalty reduces weight but does not filter (finalScore always > 0)
 * - 14-day window default
 */
export function applyHistoryPenaltyStage(input: HistoryPenaltyStageInput): HistoryPenaltyStageOutput {
  const { runtimeScore, candidate, recentCandidates, windowDays = DEFAULT_WINDOW_DAYS } = input;

  if (recentCandidates.length === 0) {
    return { historyPenalty: 0, finalScore: runtimeScore };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  let totalPenalty = 0;

  for (const recent of recentCandidates) {
    // Check if the recent candidate is within the window
    if (recent.publishedAt) {
      const recentDate = new Date(recent.publishedAt);
      if (recentDate < windowStart) {
        continue; // Outside the window, skip
      }
    }

    // Skip self-comparison
    if (recent.id === candidate.id) {
      continue;
    }

    // Check exact URL match
    if (candidate.normalizedUrl && recent.normalizedUrl &&
        candidate.normalizedUrl === recent.normalizedUrl) {
      totalPenalty += EXACT_URL_PENALTY;
      continue;
    }

    // Check near title match
    if (candidate.normalizedTitle && recent.normalizedTitle) {
      const similarity = computeStringSimilarity(candidate.normalizedTitle, recent.normalizedTitle);
      if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
        totalPenalty += NEAR_TITLE_PENALTY * similarity;
      }
    }
  }

  // Cap the total penalty
  const historyPenalty = Math.min(totalPenalty, MAX_PENALTY);

  // Apply penalty but ensure finalScore is always positive (never filter)
  const finalScore = runtimeScore * (1 - historyPenalty);
  const safeFinalScore = Math.max(finalScore, 0.1); // Minimum score to avoid filtering

  return { historyPenalty, finalScore: safeFinalScore };
}

/**
 * Computes similarity between two strings using trigram-based Jaccard similarity.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
function computeStringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const trigramsA = buildTrigrams(a);
  const trigramsB = buildTrigrams(b);

  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;

  // Jaccard similarity: |intersection| / |union|
  let intersection = 0;
  for (const trigram of trigramsA) {
    if (trigramsB.has(trigram)) {
      intersection++;
    }
  }

  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Builds a set of character trigrams from a string.
 */
function buildTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();

  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }

  return trigrams;
}
