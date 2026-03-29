/**
 * Near deduplication item interface with all fields needed for winner selection.
 */
export interface NearDedupItem {
  id: string;
  normalizedTitle: string;
  normalizedUrl: string;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  topicIds?: string[];
  sourcePriority?: number;
  engagementScore?: number | null;
}

/**
 * Winner selection for near dedupe.
 * Selection criteria (in order):
 * 1. topicIds.length 更高者优先
 * 2. Source.priority 更高者优先
 * 3. engagementScore 更高者优先（null 视为 -1）
 * 4. publishedAt 更新者优先
 * 5. fetchedAt 更新者优先
 * 6. id 字典序作为最终 tiebreaker
 */
function selectWinner<T extends NearDedupItem>(items: T[]): T {
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
function compareForWinner<T extends NearDedupItem>(a: T, b: T): number {
  // 1. topicIds.length 更高者优先
  const aTopicCount = a.topicIds?.length ?? 0;
  const bTopicCount = b.topicIds?.length ?? 0;
  if (aTopicCount !== bTopicCount) {
    return bTopicCount - aTopicCount;
  }

  // 2. Source.priority 更高者优先
  const aPriority = a.sourcePriority ?? 0;
  const bPriority = b.sourcePriority ?? 0;
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
 * Tokenize a title into a set of lowercase tokens.
 */
function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Compute LCS (Longest Common Subsequence) length between two token arrays.
 * This is the core of SequenceMatcher-style similarity.
 */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;

  // Use a single row DP for space efficiency
  // dp[j] = LCS length for a[0..i-1] and b[0..j-1]
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    // Swap prev and curr
    [prev, curr] = [curr, prev];
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
  }

  return curr[n];
}

/**
 * SequenceMatcher-style similarity ratio: 2 * LCS / (len(a) + len(b))
 * This is the same formula used by Python's difflib.SequenceMatcher.ratio()
 */
function similarityRatio(a: string[], b: string[]): number {
  const lcs = lcsLength(a, b);
  const lenSum = a.length + b.length;
  if (lenSum === 0) return 0;
  return (2 * lcs) / lenSum;
}

/**
 * Check if two items are within the same day (used for pre-filtering).
 * Items must have publishedAt within 24 hours of each other to be considered duplicates.
 */
function isWithinDay(left?: string | null, right?: string | null): boolean {
  if (!left || !right) {
    return true; // If either is missing, allow comparison
  }
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 24 * 60 * 60 * 1000;
}

/**
 * Check if two items share at least one significant token.
 * Used for bucket pre-filtering: items with no shared tokens cannot be near-duplicates.
 */
function hasSharedToken(aTokens: string[], bTokens: string[]): boolean {
  const bSet = new Set(bTokens);
  for (const token of aTokens) {
    if (bSet.has(token)) {
      return true;
    }
  }
  return false;
}

/**
 * Find connected components (clusters) of near-duplicate items using Union-Find.
 * Items are connected if they are near-duplicates (similarity >= threshold).
 */
function findClusters<T extends NearDedupItem>(items: T[], threshold = 0.75): Map<number, T[]> {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]); // Path compression
    }
    return parent[x];
  }

  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px === py) return;

    // Union by rank
    if (rank[px] < rank[py]) {
      parent[px] = py;
    } else if (rank[px] > rank[py]) {
      parent[py] = px;
    } else {
      parent[py] = px;
      rank[px]++;
    }
  }

  // Tokenize all items first
  const tokenized = items.map((item) => tokenize(item.normalizedTitle));

  // Build similarity graph and union connected items
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Pre-filter: must share at least one token
      if (!hasSharedToken(tokenized[i], tokenized[j])) {
        continue;
      }

      // Must be within the same day
      if (!isWithinDay(items[i].publishedAt, items[j].publishedAt)) {
        continue;
      }

      // Compute SequenceMatcher-style similarity
      const sim = similarityRatio(tokenized[i], tokenized[j]);

      if (sim >= threshold) {
        union(i, j);
      }
    }
  }

  // Group items by their root
  const clusters = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const cluster = clusters.get(root) ?? [];
    cluster.push(items[i]);
    clusters.set(root, cluster);
  }

  return clusters;
}

/**
 * Near deduplication by normalizedTitle using connected components.
 *
 * Algorithm (input-order independent):
 * 1. Tokenize all titles
 * 2. Build similarity graph using bucket pre-filtering and 24h time window
 * 3. Find connected components (clusters) using Union-Find
 * 4. For each cluster, select a single winner using the winner selection algorithm
 *
 * This ensures A≈B, B≈C → single cluster (transitive closure via connected components).
 */
export function dedupeNear<T extends NearDedupItem>(items: T[], threshold = 0.75): T[] {
  if (items.length === 0) {
    return [];
  }

  // Find clusters of near-duplicate items
  const clusters = findClusters(items, threshold);

  // For each cluster, select a single winner
  const winners: T[] = [];
  clusters.forEach((cluster) => {
    winners.push(selectWinner(cluster));
  });

  return winners;
}
