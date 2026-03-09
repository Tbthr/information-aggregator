import type { Cluster } from "../types/index";

function similarity(left: string, right: string): number {
  const normalizeToken = (token: string): string => token.replace(/(?:ed|es|s)$/i, "");
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean).map(normalizeToken));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean).map(normalizeToken));
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size, 1);
}

export function buildClusters(
  items: Array<{ id: string; normalizedTitle: string; finalScore: number; url?: string; summary?: string }>,
  runId: string,
): Cluster[] {
  const sorted = [...items].sort((left, right) => right.finalScore - left.finalScore);
  const clusters: Cluster[] = [];

  for (const item of sorted) {
    const cluster = clusters.find((candidate) => similarity(candidate.title ?? "", item.normalizedTitle) >= 0.74);
    if (cluster) {
      cluster.memberItemIds.push(item.id);
      continue;
    }

    clusters.push({
      id: `${runId}-${clusters.length + 1}`,
      runId,
      canonicalItemId: item.id,
      memberItemIds: [item.id],
      dedupeMethod: "near",
      title: item.normalizedTitle,
      summary: item.summary,
      url: item.url,
    });
  }

  return clusters;
}
