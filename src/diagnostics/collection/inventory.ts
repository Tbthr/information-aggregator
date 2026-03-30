// Diagnostics Framework Collection Inventory

import { prisma } from "@/lib/prisma";
import { classifySourceHealth } from "./health";
import type { CollectionInventory, PersistedSummary, PersistedContentSummary, SourceHealthSummary } from "./types";

/**
 * Loads collection inventory counts from the database.
 */
export async function loadCollectionInventory(): Promise<CollectionInventory> {
  const [contentCount, sourceCount, unhealthyRecords] = await Promise.all([
    prisma.content.count(),
    prisma.source.count(),
    // Count unhealthy sources (consecutiveFailures > 0)
    prisma.sourceHealth.count({
      where: { consecutiveFailures: { gt: 0 } },
    }),
  ]);

  return {
    contentCount,
    sourceCount,
    unhealthySourceCount: unhealthyRecords,
  };
}

/**
 * Builds a persisted summary of top content from the database.
 *
 * @param topN - Number of top content items to include (default 20)
 */
export async function buildPersistedSummary(topN: number = 20): Promise<PersistedSummary> {
  const topContent = await prisma.content.findMany({
    orderBy: [
      { qualityScore: "desc" },
      { fetchedAt: "desc" },
    ],
    take: topN,
    select: {
      id: true,
      kind: true,
      title: true,
      url: true,
      authorLabel: true,
      publishedAt: true,
      qualityScore: true,
    },
  });

  const persistedContent: PersistedContentSummary[] = topContent.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    url: c.url,
    authorLabel: c.authorLabel,
    publishedAt: c.publishedAt?.toISOString() ?? null,
    qualityScore: c.qualityScore,
  }));

  return {
    topContent: persistedContent,
  };
}
