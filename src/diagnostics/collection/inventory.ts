// Diagnostics Framework Collection Inventory

import { prisma } from "@/lib/prisma";
import { classifySourceHealth } from "./health";
import type { CollectionInventory, PersistedSummary, PersistedItemSummary, PersistedTweetSummary, SourceHealthSummary } from "./types";

/**
 * Loads collection inventory counts from the database.
 */
export async function loadCollectionInventory(): Promise<CollectionInventory> {
  const [itemCount, tweetCount, sourceCount, unhealthyRecords] = await Promise.all([
    prisma.item.count(),
    prisma.tweet.count(),
    prisma.source.count(),
    // Count unhealthy sources (consecutiveFailures > 0)
    prisma.sourceHealth.count({
      where: { consecutiveFailures: { gt: 0 } },
    }),
  ]);

  return {
    itemCount,
    tweetCount,
    sourceCount,
    unhealthySourceCount: unhealthyRecords,
  };
}

/**
 * Builds a persisted summary of top items and tweets from the database.
 *
 * @param topN - Number of top items/tweets to include (default 20)
 */
export async function buildPersistedSummary(topN: number = 20): Promise<PersistedSummary> {
  const [topItems, topTweets] = await Promise.all([
    // Get top items by recency, with source name
    prisma.item.findMany({
      orderBy: [
        { publishedAt: "desc" },
        { fetchedAt: "desc" },
      ],
      take: topN,
      select: {
        id: true,
        title: true,
        sourceName: true,
        publishedAt: true,
      },
    }),
    // Get top tweets by score (Tweet model retains score)
    prisma.tweet.findMany({
      orderBy: [
        { score: "desc" },
        { publishedAt: "desc" },
      ],
      take: topN,
      select: {
        id: true,
        authorHandle: true,
        text: true,
        score: true,
        publishedAt: true,
      },
    }),
  ]);

  const persistedItems: PersistedItemSummary[] = topItems.map((item) => ({
    id: item.id,
    title: item.title,
    sourceName: item.sourceName,
    publishedAt: item.publishedAt?.toISOString(),
  }));

  const persistedTweets: PersistedTweetSummary[] = topTweets.map((tweet) => ({
    id: tweet.id,
    authorHandle: tweet.authorHandle,
    text: tweet.text,
    score: tweet.score,
    publishedAt: tweet.publishedAt?.toISOString(),
  }));

  return {
    topItems: persistedItems,
    topTweets: persistedTweets,
  };
}
