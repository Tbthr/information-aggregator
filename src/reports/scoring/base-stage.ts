import type { BaseStageInput, BaseStageOutput, KindPreferences } from "./types";

/**
 * Kind-specific default base scores when no kindPreferences are configured.
 * Key matches candidate.kind; value matches kindPreferences key via KIND_PREFERENCE_KEY.
 */
const DEFAULT_BASE_SCORES: Record<string, number> = {
  article: 5,
  tweet: 10,
};

/**
 * Maps candidate.kind to the corresponding key on KindPreferences.
 */
const KIND_PREFERENCE_KEY: Record<string, keyof KindPreferences> = {
  article: "articles",
  tweet: "tweets",
};

/**
 * Applies base scoring based on candidate kind and daily config preferences.
 *
 * Input:
 * - candidate: ReportCandidate
 * - kindPreferences: { articles?: number, tweets?: number } from daily config
 *
 * Output:
 * - baseScore: number
 *
 * Rules:
 * - Each kind has a configurable base score from daily config
 * - Default base scores when no preference is configured: articles=5, tweets=10
 */
export function applyBaseStage(input: BaseStageInput): BaseStageOutput {
  const { candidate, kindPreferences } = input;

  const kind = candidate.kind;
  const prefKey = KIND_PREFERENCE_KEY[kind];
  const preference = kindPreferences?.[prefKey];
  const baseScore = preference ?? DEFAULT_BASE_SCORES[kind];

  return { baseScore };
}
