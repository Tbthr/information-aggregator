import { selectWinner, removePunctuation } from "../../lib/utils";

/**
 * Near deduplication item interface with all fields needed for winner selection.
 */
export interface NearDedupItem {
  id: string;
  normalizedTitle: string;
  normalizedContent: string;
  normalizedUrl: string;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  sourceDefaultTags?: string[];
  sourceWeightScore?: number;
  engagementScore?: number | null;
}

/**
 * Tokenize dedupe text: lowercase -> strip punctuation -> collapse whitespace -> split.
 * The input should be the combined title + body text.
 */
function tokenize(value: string): string[] {
  const lowered = value.toLowerCase();
  const depunctuated = removePunctuation(lowered);
  return depunctuated.split(/\s+/).filter(Boolean);
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

  // Tokenize all items using combined title + body for dedupe comparison
  const tokenized = items.map((item) => tokenize(`${item.normalizedTitle} ${item.normalizedContent}`));

  // Build similarity graph and union connected items
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Pre-filter: must share at least one token
      if (!hasSharedToken(tokenized[i], tokenized[j])) {
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
 * Near deduplication by combined title + body text using connected components.
 *
 * Algorithm (input-order independent):
 * 1. Tokenize all items using combined title + body (lowercased, punctuation-stripped)
 * 2. Build similarity graph using token bucket pre-filtering
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
