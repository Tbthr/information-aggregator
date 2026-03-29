#!/usr/bin/env bun

/**
 * Migration Script: Legacy data to unified Content model
 *
 * This script migrates legacy data (Item, Tweet) to the unified Content model
 * and updates all references.
 *
 * Migration steps:
 * 1. Create Content records from Items (by URL)
 * 2. Create Content records from Tweets (by URL)
 * 3. Migrate DigestTopic.itemIds/tweetIds → contentIds
 * 4. Migrate WeeklyPick.itemId → contentId
 * 5. Migrate Bookmark.itemId → Bookmark.contentId
 * 6. Migrate TweetBookmark → Bookmark with contentId
 *
 * Usage:
 *   bun scripts/migrate-to-content.ts [--dry-run] [--cleanup]
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --cleanup    Remove legacy data after successful migration (DANGEROUS)
 *   --step <n>   Run only step n (1-6)
 */

import { parseArgs } from "util";
import { prisma } from "../lib/prisma";

const args = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    cleanup: { type: "boolean", default: false },
    step: { type: "string", default: "all" },
    help: { type: "boolean", default: false },
  },
});

if (args.values.help) {
  console.log(`
Migration Script: Legacy data to unified Content model

Usage:
  bun scripts/migrate-to-content.ts [options]

Options:
  --dry-run    Show what would be migrated without making changes
  --cleanup    Remove legacy data after successful migration (DANGEROUS)
  --step <n>   Run only step n (1-6)
  --help       Show this help message

Steps:
  1. Create Content records from Items (by URL)
  2. Create Content records from Tweets (by URL)
  3. Migrate DigestTopic.itemIds/tweetIds → contentIds
  4. Migrate WeeklyPick.itemId → contentId
  5. Migrate Bookmark.itemId → Bookmark.contentId
  6. Migrate TweetBookmark → Bookmark with contentId
`);
  process.exit(0);
}

const dryRun = args.values["dry-run"] as boolean;
const cleanup = args.values.cleanup as boolean;
const step = args.values.step as string;

async function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function migrateItemToContent(): Promise<{ created: number; existing: number }> {
  log("Step 1: Migrating Items to Content...");

  const items = await prisma.item.findMany();
  log(`  Found ${items.length} Items`);

  let created = 0;
  let existing = 0;

  for (const item of items) {
    // Check if Content with same URL already exists
    const existingContent = await prisma.content.findUnique({
      where: { url: item.url },
    });

    if (existingContent) {
      existing++;
      log(`  Content already exists for URL: ${item.url}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would create Content from Item: ${item.title} (${item.url})`);
      created++;
      continue;
    }

    await prisma.content.create({
      data: {
        id: item.id, // Use same ID for easy mapping
        kind: "article",
        sourceId: item.sourceId,
        title: item.title,
        body: item.content,
        url: item.url,
        authorLabel: item.author,
        publishedAt: item.publishedAt,
        fetchedAt: item.fetchedAt,
        engagementScore: null,
        qualityScore: null,
        topicIds: item.packId ? [item.packId] : [],
        topicScoresJson: null,
        metadataJson: item.metadataJson,
      },
    });
    created++;
  }

  log(`  Step 1 complete: ${created} created, ${existing} existing`);
  return { created, existing };
}

async function migrateTweetToContent(): Promise<{ created: number; existing: number }> {
  log("Step 2: Migrating Tweets to Content...");

  const tweets = await prisma.tweet.findMany();
  log(`  Found ${tweets.length} Tweets`);

  let created = 0;
  let existing = 0;

  for (const tweet of tweets) {
    // Use expandedUrl or url as the unique key
    const url = tweet.expandedUrl || tweet.url;

    const existingContent = await prisma.content.findUnique({
      where: { url },
    });

    if (existingContent) {
      existing++;
      log(`  Content already exists for URL: ${url}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would create Content from Tweet: ${tweet.text.slice(0, 50)}... (${url})`);
      created++;
      continue;
    }

    await prisma.content.create({
      data: {
        id: tweet.id, // Use same ID for easy mapping
        kind: "tweet",
        sourceId: "twitter", // Twitter source
        title: null,
        body: tweet.text,
        url: url,
        authorLabel: tweet.authorHandle,
        publishedAt: tweet.publishedAt,
        fetchedAt: tweet.fetchedAt,
        engagementScore: tweet.likeCount + tweet.replyCount + tweet.retweetCount,
        qualityScore: tweet.score,
        topicIds: [],
        topicScoresJson: null,
        metadataJson: JSON.stringify({
          tweetId: tweet.tweetId,
          tab: tweet.tab,
          likeCount: tweet.likeCount,
          replyCount: tweet.replyCount,
          retweetCount: tweet.retweetCount,
        }),
      },
    });
    created++;
  }

  log(`  Step 2 complete: ${created} created, ${existing} existing`);
  return { created, existing };
}

async function migrateDigestTopic(): Promise<{ migrated: number }> {
  log("Step 3: Migrating DigestTopic.itemIds/tweetIds → contentIds...");

  const digestTopics = await prisma.digestTopic.findMany({
    where: {
      OR: [
        { itemIds: { isEmpty: false } },
        { tweetIds: { isEmpty: false } },
      ],
    },
  });

  log(`  Found ${digestTopics.length} DigestTopics with legacy IDs`);

  let migrated = 0;

  for (const topic of digestTopics) {
    // Map itemIds to contentIds via URL lookup
    const contentIds: string[] = [];

    // Get content IDs for itemIds
    if (topic.itemIds.length > 0) {
      const items = await prisma.item.findMany({
        where: { id: { in: topic.itemIds } },
        select: { id: true, url: true },
      });

      // Find Content records by URL
      const urls = items.map((i) => i.url);
      const contents = await prisma.content.findMany({
        where: { url: { in: urls } },
        select: { id: true, url: true },
      });
      contentIds.push(...contents.map((c) => c.id));
    }

    // Get content IDs for tweetIds
    if (topic.tweetIds.length > 0) {
      const tweets = await prisma.tweet.findMany({
        where: { id: { in: topic.tweetIds } },
        select: { id: true, expandedUrl: true, url: true },
      });

      const urls = tweets.map((t) => t.expandedUrl || t.url);
      const contents = await prisma.content.findMany({
        where: { url: { in: urls } },
        select: { id: true, url: true },
      });
      contentIds.push(...contents.map((c) => c.id));
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate DigestTopic ${topic.id}: ${topic.itemIds.length} items + ${topic.tweetIds.length} tweets → ${contentIds.length} contentIds`);
      migrated++;
      continue;
    }

    await prisma.digestTopic.update({
      where: { id: topic.id },
      data: { contentIds },
    });
    migrated++;
  }

  log(`  Step 3 complete: ${migrated} DigestTopics migrated`);
  return { migrated };
}

async function migrateWeeklyPick(): Promise<{ migrated: number }> {
  log("Step 4: Migrating WeeklyPick.itemId → contentId...");

  const picks = await prisma.weeklyPick.findMany({
    where: { itemId: { not: null } },
    include: { weekly: true },
  });

  log(`  Found ${picks.length} WeeklyPicks with legacy itemId`);

  let migrated = 0;

  for (const pick of picks) {
    if (!pick.itemId) continue;

    // Find the Item and its URL
    const item = await prisma.item.findUnique({
      where: { id: pick.itemId },
      select: { url: true },
    });

    if (!item) {
      log(`  Warning: Item ${pick.itemId} not found for WeeklyPick ${pick.id}`);
      continue;
    }

    // Find Content by URL
    const content = await prisma.content.findUnique({
      where: { url: item.url },
      select: { id: true },
    });

    if (!content) {
      log(`  Warning: Content not found for URL ${item.url}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate WeeklyPick ${pick.id}: ${pick.itemId} → ${content.id}`);
      migrated++;
      continue;
    }

    await prisma.weeklyPick.update({
      where: { id: pick.id },
      data: { contentId: content.id },
    });
    migrated++;
  }

  log(`  Step 4 complete: ${migrated} WeeklyPicks migrated`);
  return { migrated };
}

async function migrateBookmark(): Promise<{ migrated: number }> {
  log("Step 5: Migrating Bookmark.itemId → Bookmark.contentId...");

  const bookmarks = await prisma.bookmark.findMany({
    where: { itemId: { not: null } },
    include: { item: true },
  });

  log(`  Found ${bookmarks.length} Bookmarks with legacy itemId`);

  let migrated = 0;

  for (const bookmark of bookmarks) {
    if (!bookmark.itemId) continue;

    // Find Content by URL (item.url)
    const content = await prisma.content.findUnique({
      where: { url: bookmark.item.url },
      select: { id: true },
    });

    if (!content) {
      log(`  Warning: Content not found for URL ${bookmark.item.url}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate Bookmark ${bookmark.id}: ${bookmark.itemId} → ${content.id}`);
      migrated++;
      continue;
    }

    await prisma.bookmark.update({
      where: { id: bookmark.id },
      data: { contentId: content.id },
    });
    migrated++;
  }

  log(`  Step 5 complete: ${migrated} Bookmarks migrated`);
  return { migrated };
}

async function migrateTweetBookmark(): Promise<{ migrated: number; deleted: number }> {
  log("Step 6: Migrating TweetBookmark → Bookmark with contentId...");

  const tweetBookmarks = await prisma.tweetBookmark.findMany({
    include: { tweet: true },
  });

  log(`  Found ${tweetBookmarks.length} TweetBookmarks`);

  let migrated = 0;
  let deleted = 0;

  for (const tb of tweetBookmarks) {
    // Find Content by URL
    const url = tb.tweet.expandedUrl || tb.tweet.url;
    const content = await prisma.content.findUnique({
      where: { url },
      select: { id: true },
    });

    if (!content) {
      log(`  Warning: Content not found for Tweet URL ${url}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate TweetBookmark ${tb.id} → Bookmark with contentId ${content.id}`);
      migrated++;
      continue;
    }

    // Create a new Bookmark entry
    await prisma.bookmark.create({
      data: {
        itemId: "", // Will be null after migration
        contentId: content.id,
        bookmarkedAt: tb.bookmarkedAt,
      },
    });

    // Delete the TweetBookmark
    await prisma.tweetBookmark.delete({
      where: { id: tb.id },
    });

    migrated++;
    deleted++;
  }

  log(`  Step 6 complete: ${migrated} TweetBookmarks migrated, ${deleted} deleted`);
  return { migrated, deleted };
}

// Run migrations
async function main() {
  log("Starting migration to unified Content model...");
  log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  try {
    if (step === "all" || step === "1") {
      await migrateItemToContent();
    }

    if (step === "all" || step === "2") {
      await migrateTweetToContent();
    }

    if (step === "all" || step === "3") {
      await migrateDigestTopic();
    }

    if (step === "all" || step === "4") {
      await migrateWeeklyPick();
    }

    if (step === "all" || step === "5") {
      await migrateBookmark();
    }

    if (step === "all" || step === "6") {
      await migrateTweetBookmark();
    }

    log("Migration completed successfully!");

    if (cleanup && !dryRun) {
      log("WARNING: --cleanup specified. Legacy data will be removed.");
      log("This is a destructive operation. Manually review and execute cleanup.");
    }
  } catch (error) {
    log(`ERROR: Migration failed: ${error}`);
    process.exit(1);
  }
}

main();