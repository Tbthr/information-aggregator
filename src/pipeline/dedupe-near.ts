interface NearDedupItem {
  id: string;
  normalizedTitle: string;
  normalizedUrl: string;
  publishedAt?: string;
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
function isWithinDay(left?: string, right?: string): boolean {
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
 * Near deduplication by normalizedTitle.
 *
 * Algorithm:
 * 1. Tokenize titles into significant tokens
 * 2. For each item, find candidates in the kept list that:
 *    - Share at least one token (bucket pre-filter)
 *    - Are within the same day
 * 3. Compare title similarity using SequenceMatcher-style ratio
 * 4. If similarity >= 0.75, mark as duplicate
 * 5. When duplicates found, keep the item with newest publishedAt
 *
 * Summary and content do NOT affect near dedupe decisions - only title matters.
 */
export function dedupeNear<T extends NearDedupItem>(items: T[], threshold = 0.75): T[] {
  const kept: T[] = [];

  for (const item of items) {
    const itemTokens = tokenize(item.normalizedTitle);

    // Find a duplicate among kept items
    let duplicateIdx: number | null = null;

    for (let i = 0; i < kept.length; i++) {
      const candidate = kept[i];
      const candidateTokens = tokenize(candidate.normalizedTitle);

      // Pre-filter: must share at least one token
      if (!hasSharedToken(itemTokens, candidateTokens)) {
        continue;
      }

      // Must be within the same day
      if (!isWithinDay(candidate.publishedAt, item.publishedAt)) {
        continue;
      }

      // Compute SequenceMatcher-style similarity
      const sim = similarityRatio(itemTokens, candidateTokens);

      if (sim >= threshold) {
        duplicateIdx = i;
        break; // Found a duplicate, stop searching
      }
    }

    if (duplicateIdx === null) {
      // No duplicate found, add to kept list
      kept.push(item);
    } else {
      // Duplicate found - keep the one with newest publishedAt
      const duplicate = kept[duplicateIdx];
      const duplicateTime = duplicate.publishedAt ? new Date(duplicate.publishedAt).getTime() : 0;
      const itemTime = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;

      if (itemTime >= duplicateTime) {
        // Item is newer or same age, replace duplicate
        kept[duplicateIdx] = item;
      }
      // Otherwise keep the existing (newer) duplicate
    }
  }

  return kept;
}
