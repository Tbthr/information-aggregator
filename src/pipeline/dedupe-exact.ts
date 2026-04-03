import { selectWinner } from "../../lib/utils";

/**
 * Exact deduplication item interface with all fields needed for winner selection.
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
 * Exact deduplication by normalizedUrl.
 * Groups items by normalizedUrl and selects a single winner using the shared winner selection algorithm.
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
