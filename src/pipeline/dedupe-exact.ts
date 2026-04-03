/**
 * Exact deduplication item interface with all fields needed for winner selection.
 * Extended from the basic interface to support the full winner selection algorithm.
 */
export interface DedupItem {
  id: string;
  normalizedUrl: string;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  sourceDefaultTags?: string[];
  sourceWeightScore?: number;
  engagementScore?: number | null;
}

/**
 * Winner selection for exact dedupe (applies to both exact and near dedupe).
 * Selection criteria (in order):
 * 1. tags.length 更高者优先
 * 2. Source.priority 更高者优先
 * 3. engagementScore 更高者优先（null 视为 -1）
 * 4. publishedAt 更新者优先
 * 5. fetchedAt 更新者优先
 * 6. id 字典序作为最终 tiebreaker
 */
function selectWinner<T extends DedupItem>(items: T[]): T {
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
function compareForWinner<T extends DedupItem>(a: T, b: T): number {
  // 1. tags.length 更高者优先
  const aTagCount = a.sourceDefaultTags?.length ?? 0;
  const bTagCount = b.sourceDefaultTags?.length ?? 0;
  if (aTagCount !== bTagCount) {
    return bTagCount - aTagCount; // Higher tag count wins
  }

  // 2. Source.priority 更高者优先
  const aPriority = a.sourceWeightScore ?? 0;
  const bPriority = b.sourceWeightScore ?? 0;
  if (aPriority !== bPriority) {
    return bPriority - aPriority; // Higher priority wins
  }

  // 3. engagementScore 更高者优先（null 视为 -1）
  const aEngagement = a.engagementScore ?? -1;
  const bEngagement = b.engagementScore ?? -1;
  if (aEngagement !== bEngagement) {
    return bEngagement - aEngagement; // Higher engagement wins
  }

  // 4. publishedAt 更新者优先
  const aPublished = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
  const bPublished = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
  if (aPublished !== bPublished) {
    return bPublished - aPublished; // Newer publishedAt wins
  }

  // 5. fetchedAt 更新者优先
  const aFetched = a.fetchedAt ? new Date(a.fetchedAt).getTime() : 0;
  const bFetched = b.fetchedAt ? new Date(b.fetchedAt).getTime() : 0;
  if (aFetched !== bFetched) {
    return bFetched - aFetched; // Newer fetchedAt wins
  }

  // 6. id 字典序作为最终 tiebreaker
  return a.id.localeCompare(b.id);
}

/**
 * Exact deduplication by normalizedUrl.
 * Groups items by normalizedUrl and selects a single winner using the winner selection algorithm.
 */
export function dedupeExact<T extends DedupItem>(items: T[]): T[] {
  const groups = new Map<string, T[]>();

  // Group items by normalizedUrl
  for (const item of items) {
    const key = item.normalizedUrl;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  // For each group, select a single winner
  const winners: T[] = [];
  for (const [, group] of groups) {
    winners.push(selectWinner(group));
  }

  return winners;
}
