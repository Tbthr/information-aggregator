#!/usr/bin/env bun

/**
 * Migration Script: Legacy data to unified Content model
 *
 * Detailed migration steps:
 * 1. Item → Content(kind="article"):
 *    - Item.title → Content.title
 *    - Item.content → Content.body
 *    - Item.url → Content.url
 *    - Item.author → Content.authorLabel
 *    - Item.metadataJson → Content.metadataJson (with legacyId added)
 *    - Content.metadataJson.legacyId = { type: "item", id: oldId }
 *
 * 2. Tweet → Content(kind="tweet"):
 *    - Tweet.text → Content.body
 *    - Tweet.url → Content.url
 *    - Tweet.authorHandle → Content.authorLabel
 *    - Tweet.likeCount/replyCount/retweetCount → engagementScore + metadataJson
 *    - Tweet.*Json → Content.metadataJson
 *    - Content.metadataJson.legacyId = { type: "tweet", id: oldId }
 *
 * 3. XPageConfig → Source.configJson merge
 *
 * 4. DigestTopic.itemIds/tweetIds → contentIds (via legacyId lookup)
 *
 * 5. WeeklyPick.itemId → contentId (via legacyId lookup)
 *
 * 6. Pack → Topic rename
 *
 * 7. Source.packId → Source.defaultTopicIds: [packId]
 *
 * 8. Bookmark + TweetBookmark → unified Bookmark.contentId
 *
 * Usage:
 *   bun scripts/migrate-content.ts [--dry-run] [--cleanup]
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --cleanup    Remove legacy data after successful migration (DANGEROUS)
 *   --step <n>   Run only step n (1-8)
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
  bun scripts/migrate-content.ts [options]

Options:
  --dry-run    Show what would be migrated without making changes
  --cleanup    Remove legacy data after successful migration (DANGEROUS)
  --step <n>   Run only step n (1-8)
  --help       Show this help message

Steps:
  1. Item → Content(kind="article")
  2. Tweet → Content(kind="tweet")
  3. XPageConfig → Source.configJson
  4. DigestTopic.itemIds/tweetIds → contentIds
  5. WeeklyPick.itemId → contentId
  6. Pack → Topic (rename Pack.name → Topic.name, Pack.mustInclude → Topic.includeRules)
  7. Source.packId → Source.defaultTopicIds
  8. Bookmark + TweetBookmark → unified Bookmark.contentId
`);
  process.exit(0);
}

const dryRun = args.values["dry-run"] as boolean;
const cleanup = args.values.cleanup as boolean;
const step = args.values.step as string;

async function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Helper to build metadataJson with legacyId
function buildMetadataJson(legacyType: "item" | "tweet", legacyId: string, existingJson?: string | null): string {
  const meta: Record<string, unknown> = {
    legacyId: { type: legacyType, id: legacyId },
  };
  if (existingJson) {
    try {
      const parsed = JSON.parse(existingJson);
      Object.assign(meta, parsed);
    } catch {
      // If existing JSON is invalid, just keep legacyId
    }
  }
  return JSON.stringify(meta);
}

async function migrateItemToContent(): Promise<{ created: number; skipped: number }> {
  log("Step 1: Migrating Items to Content...");

  const items = await prisma.item.findMany();
  log(`  Found ${items.length} Items`);

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    // Check if Content with same URL already exists
    const existingContent = await prisma.content.findUnique({
      where: { url: item.url },
    });

    if (existingContent) {
      skipped++;
      log(`  Skipped (exists): ${item.title} (${item.url})`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would create Content from Item: ${item.title} (${item.url})`);
      created++;
      continue;
    }

    await prisma.content.create({
      data: {
        id: item.id,
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
        topicIds: [], // Will be recalculated via topic classification
        topicScoresJson: null,
        metadataJson: buildMetadataJson("item", item.id, item.metadataJson),
      },
    });
    created++;
  }

  log(`  Step 1 complete: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function migrateTweetToContent(): Promise<{ created: number; skipped: number }> {
  log("Step 2: Migrating Tweets to Content...");

  const tweets = await prisma.tweet.findMany();
  log(`  Found ${tweets.length} Tweets`);

  let created = 0;
  let skipped = 0;

  for (const tweet of tweets) {
    // Use expandedUrl or url as the unique key
    const url = tweet.expandedUrl || tweet.url;

    const existingContent = await prisma.content.findUnique({
      where: { url },
    });

    if (existingContent) {
      skipped++;
      log(`  Skipped (exists): ${tweet.text.slice(0, 30)}... (${url})`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would create Content from Tweet: ${tweet.text.slice(0, 30)}... (${url})`);
      created++;
      continue;
    }

    // Build metadataJson with legacyId and tweet-specific fields
    const metadata = {
      legacyId: { type: "tweet", id: tweet.id },
      tweetId: tweet.tweetId,
      tab: tweet.tab,
      likeCount: tweet.likeCount,
      replyCount: tweet.replyCount,
      retweetCount: tweet.retweetCount,
      bullets: tweet.bullets,
      categories: tweet.categories,
    };

    await prisma.content.create({
      data: {
        id: tweet.id,
        kind: "tweet",
        sourceId: "twitter",
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
        metadataJson: JSON.stringify(metadata),
      },
    });
    created++;
  }

  log(`  Step 2 complete: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function migrateXPageConfigToSource(): Promise<{ migrated: number }> {
  log("Step 3: Migrating XPageConfig → Source.configJson...");

  const xPageConfigs = await prisma.xPageConfig.findMany();
  log(`  Found ${xPageConfigs.length} XPageConfigs`);

  let migrated = 0;

  for (const config of xPageConfigs) {
    // Find sources associated with this X config via tab
    // Merge XPageConfig fields into Source.configJson
    const configData = {
      tab: config.tab,
      enabled: true,
      birdMode: config.birdMode,
      count: config.count,
      fetchAll: config.fetchAll,
      maxPages: config.maxPages,
      listsJson: config.listsJson,
      filterPrompt: config.filterPrompt,
      enrichEnabled: config.enrichEnabled,
      enrichScoring: config.enrichScoring,
      enrichKeyPoints: config.enrichKeyPoints,
      enrichTagging: config.enrichTagging,
      timeWindow: config.timeWindow,
      sortOrder: config.sortOrder,
    };

    if (dryRun) {
      log(`  [DRY RUN] Would merge XPageConfig ${config.tab} into Source configJson`);
      migrated++;
      continue;
    }

    // Update X sources that have matching tab info
    // Only update sources where kind indicates X/Twitter (kind contains "x" or "twitter")
    // If no matching source exists, skip silently (X config may not have a corresponding source yet)
    const xSourceMatch = await prisma.source.findFirst({
      where: {
        OR: [
          { kind: { contains: "x" } },
          { kind: { contains: "twitter" } },
          { url: { contains: "twitter" } },
          { url: { contains: "x.com" } },
        ],
      },
    });

    if (!xSourceMatch) {
      log(`  Skipping XPageConfig ${config.tab} - no matching X source found`);
      migrated++;
      continue;
    }

    await prisma.source.updateMany({
      where: {
        OR: [
          { kind: { contains: "x" } },
          { kind: { contains: "twitter" } },
          { url: { contains: "twitter" } },
          { url: { contains: "x.com" } },
        ],
      },
      data: {
        configJson: JSON.stringify(configData),
      },
    });
    migrated++;
  }

  log(`  Step 3 complete: ${migrated} XPageConfigs processed`);
  return { migrated };
}

async function migrateDigestTopic(): Promise<{ migrated: number }> {
  log("Step 4: Migrating DigestTopic.itemIds/tweetIds → contentIds...");

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
    const contentIds: string[] = [];

    // Map itemIds to contentIds via legacyId lookup in metadataJson
    if (topic.itemIds.length > 0) {
      // Find Contents whose metadataJson.legacyId.type === "item" and legacyId.id in itemIds
      // Since we store legacyId in metadataJson, we need to query all and filter
      const allContents = await prisma.content.findMany({
        where: { kind: "article" },
        select: { id: true, metadataJson: true },
      });

      const itemIdSet = new Set(topic.itemIds);
      for (const content of allContents) {
        if (!content.metadataJson) continue;
        try {
          const meta = JSON.parse(content.metadataJson);
          if (meta.legacyId?.type === "item" && itemIdSet.has(meta.legacyId.id)) {
            contentIds.push(content.id);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Map tweetIds to contentIds via legacyId lookup
    if (topic.tweetIds.length > 0) {
      const allContents = await prisma.content.findMany({
        where: { kind: "tweet" },
        select: { id: true, metadataJson: true },
      });

      const tweetIdSet = new Set(topic.tweetIds);
      for (const content of allContents) {
        if (!content.metadataJson) continue;
        try {
          const meta = JSON.parse(content.metadataJson);
          if (meta.legacyId?.type === "tweet" && tweetIdSet.has(meta.legacyId.id)) {
            contentIds.push(content.id);
          }
        } catch {
          // Skip invalid JSON
        }
      }
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

  log(`  Step 4 complete: ${migrated} DigestTopics migrated`);
  return { migrated };
}

async function migrateWeeklyPick(): Promise<{ migrated: number }> {
  log("Step 5: Migrating WeeklyPick.itemId → contentId...");

  const picks = await prisma.weeklyPick.findMany({
    where: { itemId: { not: "" } },
    include: { weekly: true },
  });

  log(`  Found ${picks.length} WeeklyPicks with legacy itemId`);

  let migrated = 0;

  for (const pick of picks) {
    if (!pick.itemId) continue;

    // Find Content via legacyId lookup
    const allContents = await prisma.content.findMany({
      where: { kind: "article" },
      select: { id: true, metadataJson: true },
    });

    let contentId: string | null = null;
    for (const content of allContents) {
      if (!content.metadataJson) continue;
      try {
        const meta = JSON.parse(content.metadataJson);
        if (meta.legacyId?.type === "item" && meta.legacyId.id === pick.itemId) {
          contentId = content.id;
          break;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    if (!contentId) {
      log(`  Warning: No Content found for legacy itemId ${pick.itemId}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate WeeklyPick ${pick.id}: ${pick.itemId} → ${contentId}`);
      migrated++;
      continue;
    }

    await prisma.weeklyPick.update({
      where: { id: pick.id },
      data: { contentId },
    });
    migrated++;
  }

  log(`  Step 5 complete: ${migrated} WeeklyPicks migrated`);
  return { migrated };
}

async function migratePackToTopic(): Promise<{ migrated: number }> {
  log("Step 6: Pack → Topic field mapping...");

  // Pack is already stored as Topic in the new model
  // Just verify the mapping: Pack.mustInclude → Topic.includeRules
  const packs = await prisma.pack.findMany();
  log(`  Found ${packs.length} Packs`);

  let migrated = 0;

  for (const pack of packs) {
    if (dryRun) {
      log(`  [DRY RUN] Would verify Pack ${pack.id} → Topic mapping`);
      migrated++;
      continue;
    }

    // The Topic model uses the same table as Pack (via Prisma)
    // No data migration needed - just a schema rename
    migrated++;
  }

  log(`  Step 6 complete: ${migrated} Packs processed (data unchanged - schema rename only)`);
  return { migrated };
}

async function migrateSourcePackId(): Promise<{ migrated: number }> {
  log("Step 7: Migrating Source.packId → Source.defaultTopicIds...");

  const sources = await prisma.source.findMany({
    where: { packId: { not: null } },
  });

  log(`  Found ${sources.length} Sources with packId`);

  let migrated = 0;

  for (const source of sources) {
    if (!source.packId) continue;

    if (dryRun) {
      log(`  [DRY RUN] Would migrate Source ${source.id}: packId=${source.packId} → defaultTopicIds=[${source.packId}]`);
      migrated++;
      continue;
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        defaultTopicIds: [source.packId],
      },
    });
    migrated++;
  }

  log(`  Step 7 complete: ${migrated} Sources migrated`);
  return { migrated };
}

async function migrateBookmarks(): Promise<{ migrated: number; deleted: number }> {
  log("Step 8a: Migrating Bookmark.itemId → Bookmark.contentId...");

  const bookmarks = await prisma.bookmark.findMany({
    where: { itemId: { not: "" } },
    include: { item: true },
  });

  log(`  Found ${bookmarks.length} Bookmarks with legacy itemId`);

  let migrated = 0;

  for (const bookmark of bookmarks) {
    if (!bookmark.itemId) continue;

    // Find Content via legacyId lookup
    const allContents = await prisma.content.findMany({
      where: { kind: "article" },
      select: { id: true, metadataJson: true },
    });

    let contentId: string | null = null;
    for (const content of allContents) {
      if (!content.metadataJson) continue;
      try {
        const meta = JSON.parse(content.metadataJson);
        if (meta.legacyId?.type === "item" && meta.legacyId.id === bookmark.itemId) {
          contentId = content.id;
          break;
        }
      } catch {
        // Skip
      }
    }

    if (!contentId) {
      log(`  Warning: No Content found for legacy itemId ${bookmark.itemId}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate Bookmark ${bookmark.id}: ${bookmark.itemId} → ${contentId}`);
      migrated++;
      continue;
    }

    await prisma.bookmark.update({
      where: { id: bookmark.id },
      data: { contentId },
    });
    migrated++;
  }

  log(`  Step 8a complete: ${migrated} Bookmarks migrated`);

  // Step 8b: Migrate TweetBookmark → Bookmark with contentId
  log("Step 8b: Migrating TweetBookmark → Bookmark with contentId...");

  const tweetBookmarks = await prisma.tweetBookmark.findMany({
    include: { tweet: true },
  });

  log(`  Found ${tweetBookmarks.length} TweetBookmarks`);

  let tbMigrated = 0;
  let tbDeleted = 0;

  for (const tb of tweetBookmarks) {
    // Find Content via legacyId lookup
    const allContents = await prisma.content.findMany({
      where: { kind: "tweet" },
      select: { id: true, metadataJson: true },
    });

    let contentId: string | null = null;
    for (const content of allContents) {
      if (!content.metadataJson) continue;
      try {
        const meta = JSON.parse(content.metadataJson);
        if (meta.legacyId?.type === "tweet" && meta.legacyId.id === tb.tweetId) {
          contentId = content.id;
          break;
        }
      } catch {
        // Skip
      }
    }

    if (!contentId) {
      log(`  Warning: No Content found for legacy tweetId ${tb.tweetId}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] Would migrate TweetBookmark ${tb.id} → Bookmark with contentId ${contentId}`);
      tbMigrated++;
      continue;
    }

    // Create new Bookmark entry
    // Note: itemId is required in schema but deprecated - use placeholder during migration
    await prisma.bookmark.create({
      data: {
        itemId: `legacy-tweet:${tb.tweetId}`, // Legacy placeholder
        contentId,
        bookmarkedAt: tb.bookmarkedAt,
      },
    });

    // Delete TweetBookmark
    await prisma.tweetBookmark.delete({
      where: { id: tb.id },
    });

    tbMigrated++;
    tbDeleted++;
  }

  log(`  Step 8b complete: ${tbMigrated} TweetBookmarks migrated, ${tbDeleted} deleted`);

  return { migrated: migrated + tbMigrated, deleted: tbDeleted };
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
      await migrateXPageConfigToSource();
    }

    if (step === "all" || step === "4") {
      await migrateDigestTopic();
    }

    if (step === "all" || step === "5") {
      await migrateWeeklyPick();
    }

    if (step === "all" || step === "6") {
      await migratePackToTopic();
    }

    if (step === "all" || step === "7") {
      await migrateSourcePackId();
    }

    if (step === "all" || step === "8") {
      await migrateBookmarks();
    }

    log("Migration completed successfully!");

    if (cleanup && !dryRun) {
      log("WARNING: --cleanup specified. Legacy data will be removed.");
      log("This is a destructive operation. Run manually after verification.");
    }
  } catch (error) {
    log(`ERROR: Migration failed: ${error}`);
    process.exit(1);
  }
}

main();
