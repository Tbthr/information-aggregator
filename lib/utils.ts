/**
 * Winner selection fields interface.
 * Used by both exact dedupe and near dedupe.
 */
export interface WinnerSelectionFields {
  id: string;
  sourceDefaultTags?: string[];
  sourceWeightScore?: number;
  engagementScore?: number | null;
  publishedAt?: string | null;
  fetchedAt?: string | null;
}

/**
 * Winner selection criteria (in order):
 * 1. tags.length 更高者优先
 * 2. Source.priority (sourceWeightScore) 更高者优先
 * 3. engagementScore 更高者优先（null 视为 -1）
 * 4. publishedAt 更新者优先
 * 5. fetchedAt 更新者优先
 * 6. id 字典序作为最终 tiebreaker
 */
export function selectWinner<T extends WinnerSelectionFields>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot select winner from empty array");
  }
  if (items.length === 1) {
    return items[0];
  }

  let winner = items[0];
  for (let i = 1; i < items.length; i++) {
    const current = items[i];
    winner = compareForWinner(winner, current) > 0 ? current : winner;
  }
  return winner;
}

/**
 * Compare two items for winner selection.
 * Returns negative if a should win, positive if b should win, 0 if tie.
 */
export function compareForWinner<T extends WinnerSelectionFields>(a: T, b: T): number {
  // 1. tags.length 更高者优先
  const aTagCount = a.sourceDefaultTags?.length ?? 0;
  const bTagCount = b.sourceDefaultTags?.length ?? 0;
  if (aTagCount !== bTagCount) {
    return bTagCount - aTagCount;
  }

  // 2. Source.priority 更高者优先
  const aPriority = a.sourceWeightScore ?? 0;
  const bPriority = b.sourceWeightScore ?? 0;
  if (aPriority !== bPriority) {
    return bPriority - aPriority;
  }

  // 3. engagementScore 更高者优先（null 视为 -1）
  const aEngagement = a.engagementScore ?? -1;
  const bEngagement = b.engagementScore ?? -1;
  if (aEngagement !== bEngagement) {
    return bEngagement - aEngagement;
  }

  // 4. publishedAt 更新者优先
  const aPublished = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
  const bPublished = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
  if (aPublished !== bPublished) {
    return bPublished - aPublished;
  }

  // 5. fetchedAt 更新者优先
  const aFetched = a.fetchedAt ? new Date(a.fetchedAt).getTime() : 0;
  const bFetched = b.fetchedAt ? new Date(b.fetchedAt).getTime() : 0;
  if (aFetched !== bFetched) {
    return bFetched - aFetched;
  }

  // 6. id 字典序作为最终 tiebreaker
  return a.id.localeCompare(b.id);
}

/**
 * Remove punctuation for dedup comparison.
 */
export function removePunctuation(value: string): string {
  return value.replace(/[!"#$%&'*+,/:;<=>?@[\]^`{|}~]/g, "");
}

/**
 * Compute discard rate as percentage string.
 */
export function computeDiscardRate(itemCount: number, discardCount: number): string {
  if (itemCount + discardCount === 0) return "0%";
  return `${((discardCount / (itemCount + discardCount)) * 100).toFixed(1)}%`;
}

/**
 * Compute time cutoff timestamp.
 */
export function computeTimeCutoff(jobStartedAt: string, timeWindow: number): number {
  return new Date(jobStartedAt).getTime() - timeWindow;
}
