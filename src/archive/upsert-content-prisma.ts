/**
 * Unified Content upsert layer for Prisma
 *
 * Replaces separate Item/Tweet upserts with a single Content model.
 * Content is deduplicated by URL (unique constraint).
 */

import { prisma } from "../../lib/prisma";
import type { ContentKind } from "../types/index";
import type { Prisma } from "@prisma/client";

// 批量操作的分批大小
const BATCH_SIZE = 30;

/**
 * Input for archiving a normalized item as Content
 */
export interface ContentArchiveInput {
  id: string;
  kind: ContentKind;
  title: string;
  body: string | null;
  url: string;
  authorLabel: string | null;
  publishedAt: string;
  fetchedAt: string;
  engagementScore: number | null;
  topicIds: string[];
  topicScoresJson: string | null;
  metadataJson: string;
  sourceId: string;
}

/**
 * Archive result with counts
 */
export interface ContentArchiveResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
  newContentIds: string[];
}

/**
 * Archive normalized items as unified Content records.
 * Deduplicates by URL (unique constraint).
 *
 * For new items: creates Content record with all fields.
 * For existing items (same URL): updates fetchedAt and topicIds (union).
 */
export async function archiveContentItems(
  items: ContentArchiveInput[],
  tx?: Prisma.TransactionClient,
): Promise<ContentArchiveResult> {
  const client = tx ?? prisma;
  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newContentIds: [] };
  }

  // 1. 查询已存在的 URL
  const allUrls = items.map((i) => i.url);
  const existingContents = await client.content.findMany({
    where: { url: { in: allUrls } },
    select: { id: true, url: true, topicIds: true },
  });
  const existingUrlSet = new Set(existingContents.map((c) => c.url));
  const existingUrlToContent = new Map(existingContents.map((c) => [c.url, c]));

  // 2. 分离新增和更新
  const newItems: ContentArchiveInput[] = [];
  const updateItems: Array<{ item: ContentArchiveInput; existingId: string }> = [];

  for (const item of items) {
    if (existingUrlSet.has(item.url)) {
      updateItems.push({ item, existingId: existingUrlToContent.get(item.url)!.id });
    } else {
      newItems.push(item);
    }
  }

  let newCount = 0;
  let updateCount = 0;
  let newContentIds: string[] = [];

  // 3. 批量创建新记录
  if (newItems.length > 0) {
    const createData = newItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      sourceId: item.sourceId,
      title: item.title,
      body: item.body,
      url: item.url,
      authorLabel: item.authorLabel,
      publishedAt: new Date(item.publishedAt),
      fetchedAt: new Date(item.fetchedAt),
      engagementScore: item.engagementScore,
      topicIds: item.topicIds,
      topicScoresJson: item.topicScoresJson,
      metadataJson: item.metadataJson,
    }));

    // 分批创建
    for (let i = 0; i < createData.length; i += BATCH_SIZE) {
      const batch = createData.slice(i, i + BATCH_SIZE);
      await client.content.createMany({
        data: batch,
        skipDuplicates: true,
      });
      newCount += batch.length;
    }

    // 查询本次实际新建的 content ID
    const newUrls = newItems.map((i) => i.url);
    const createdContents = await client.content.findMany({
      where: { url: { in: newUrls } },
      select: { id: true, url: true },
    });
    const existingUrls = new Set(existingContents.map((c) => c.url));
    newContentIds = createdContents.filter((c) => !existingUrls.has(c.url)).map((c) => c.id);
  }

  // 4. 批量更新已有记录
  if (updateItems.length > 0) {
    const updatePromises = updateItems.map(({ item, existingId }) => {
      const existing = existingUrlToContent.get(item.url);
      // Merge topicIds: union of existing and new
      const mergedTopicIds = existing
        ? Array.from(new Set([...existing.topicIds, ...item.topicIds]))
        : item.topicIds;

      return client.content.update({
        where: { id: existingId },
        data: {
          fetchedAt: new Date(item.fetchedAt),
          topicIds: mergedTopicIds,
          // Update engagement score if provided
          ...(item.engagementScore !== null && { engagementScore: item.engagementScore }),
        },
      });
    });

    // 分批执行
    for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
      const batch = updatePromises.slice(i, i + BATCH_SIZE);
      await Promise.all(batch);
      updateCount += batch.length;
    }
  }

  return {
    newCount,
    updateCount,
    totalCount: items.length,
    newContentIds,
  };
}

// ─── Source management functions ─────────────────────────────────────────────

/**
 * 同步 Topics 到数据库（批量）
 */
export async function syncTopicsToPrisma(
  topics: Array<{
    id: string;
    name: string;
    description?: string | null;
    includeRules?: string[];
    excludeRules?: string[];
    scoreBoost?: number;
    displayOrder?: number;
    maxItems?: number;
  }>,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  if (topics.length === 0) return;

  const upsertPromises = topics.map((topic) =>
    client.topic.upsert({
      where: { id: topic.id },
      create: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        includeRules: topic.includeRules ?? [],
        excludeRules: topic.excludeRules ?? [],
        scoreBoost: topic.scoreBoost ?? 1.0,
        displayOrder: topic.displayOrder ?? 0,
        maxItems: topic.maxItems ?? 10,
      },
      update: {
        name: topic.name,
        description: topic.description,
        includeRules: topic.includeRules ?? [],
        excludeRules: topic.excludeRules ?? [],
        scoreBoost: topic.scoreBoost ?? 1.0,
        displayOrder: topic.displayOrder ?? 0,
        maxItems: topic.maxItems ?? 10,
      },
    }),
  );

  // 分批执行
  for (let i = 0; i < upsertPromises.length; i += BATCH_SIZE) {
    const batch = upsertPromises.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }
}

/**
 * 批量 Upsert 数据源（使用 kind 字段）
 */
export async function upsertSourcesBatch(
  sources: Array<{
    id: string;
    kind: string;
    name?: string;
    enabled: boolean;
    url?: string;
    configJson?: string;
    defaultTopicIds?: string[];
  }>,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  if (sources.length === 0) return;

  // Deduplicate by url — keep first occurrence, ignore duplicates
  const seen = new Set<string>();
  const deduped = sources.filter((s) => {
    const key = s.url ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Step 1: Query existing sources by url
  const urls = deduped.map((s) => s.url ?? "");
  const existingByUrl = await client.source.findMany({
    where: { url: { in: urls } },
    select: { id: true, url: true },
  });
  const urlToId = new Map(existingByUrl.map((e) => [e.url, e.id]));

  // Step 2: Build upsert operations
  const upsertPromises = deduped.map((source) => {
    const existingId = urlToId.get(source.url ?? "");

    if (existingId) {
      return client.source.upsert({
        where: { id: existingId },
        create: {
          id: existingId,
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          defaultTopicIds: source.defaultTopicIds ?? [],
        },
        update: {
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          defaultTopicIds: source.defaultTopicIds ?? [],
        },
      });
    } else {
      return client.source.upsert({
        where: { id: source.id },
        create: {
          id: source.id,
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          defaultTopicIds: source.defaultTopicIds ?? [],
        },
        update: {
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          defaultTopicIds: source.defaultTopicIds ?? [],
        },
      });
    }
  });

  // 分批执行
  for (let i = 0; i < upsertPromises.length; i += BATCH_SIZE) {
    const batch = upsertPromises.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }
}

/**
 * 批量记录数据源成功状态
 */
export async function recordSourcesSuccessBatch(
  sources: Array<{ sourceId: string; fetchedAt: string; itemCount: number }>,
): Promise<void> {
  if (sources.length === 0) return;

  const upsertPromises = sources.map((s) =>
    prisma.sourceHealth.upsert({
      where: { sourceId: s.sourceId },
      create: {
        sourceId: s.sourceId,
        lastSuccessAt: new Date(s.fetchedAt),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      },
      update: {
        lastSuccessAt: new Date(s.fetchedAt),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      },
    }),
  );

  // 分批执行
  for (let i = 0; i < upsertPromises.length; i += BATCH_SIZE) {
    const batch = upsertPromises.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }
}

/**
 * 记录数据源失败状态
 */
export async function recordSourceFailure(
  sourceId: string,
  error: string,
): Promise<void> {
  await prisma.sourceHealth.upsert({
    where: { sourceId },
    create: {
      sourceId,
      lastFailureAt: new Date(),
      lastError: error,
      consecutiveFailures: 1,
      updatedAt: new Date(),
    },
    update: {
      lastFailureAt: new Date(),
      lastError: error,
      consecutiveFailures: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}

/**
 * 获取归档统计（基于 Content）
 */
export async function getArchiveStats(): Promise<{
  totalItems: number;
  oldestItem: Date | null;
  newestItem: Date | null;
  bySource: Array<{ sourceId: string; count: bigint }>;
}> {
  const totalItems = await prisma.content.count();

  const oldestNewest = await prisma.content.findFirst({
    orderBy: { fetchedAt: "asc" },
    select: { fetchedAt: true },
  });

  const newestItem = await prisma.content.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });

  const bySource = await prisma.content.groupBy({
    by: ["sourceId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return {
    totalItems,
    oldestItem: oldestNewest?.fetchedAt ?? null,
    newestItem: newestItem?.fetchedAt ?? null,
    bySource: bySource.map((s) => ({
      sourceId: s.sourceId,
      count: BigInt(s._count.id),
    })),
  };
}

// ─── Tweet archival functions ─────────────────────────────────────────────────

/**
 * RawItem from bird adapter
 */
interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  fetchedAt: string;
  metadataJson: string;
  publishedAt?: string;
  author?: string;
  content?: string;
}

/**
 * Parsed metadata from bird adapter
 */
interface ParsedMetadata {
  tweetId?: string;
  authorName?: string;
  authorId?: string;
  expandedUrl?: string;
  conversationId?: string;
  engagement?: {
    score?: number;
    comments?: number;
    reactions?: number;
  };
  media?: unknown;
  quote?: unknown;
  thread?: unknown;
  parent?: unknown;
  article?: unknown;
}

/**
 * Archive result for tweets
 */
export interface ArchiveTweetsResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
  newContentIds: string[];
}

/**
 * 计算 engagement score for tweets
 * Formula: min(100, floor((likeCount * 1 + replyCount * 2 + retweetCount * 3) / 10))
 */
function computeTweetEngagementScore(likeCount: number, replyCount: number, retweetCount: number): number {
  return Math.min(100, Math.floor((likeCount * 1 + replyCount * 2 + retweetCount * 3) / 10));
}

/**
 * Parse RawItem metadata
 */
function parseMetadata(metadataJson: string | undefined): ParsedMetadata {
  if (!metadataJson) return {};
  try {
    return JSON.parse(metadataJson) as ParsedMetadata;
  } catch {
    return {};
  }
}

/**
 * Archive tweets as Content(kind="tweet")
 * Uses expandedUrl for deduplication (URL dedup is the standard dedup strategy for Content)
 */
export async function archiveTweetsAsContent(
  items: RawItem[],
  tab: string,
): Promise<ArchiveTweetsResult> {
  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newContentIds: [] };
  }

  const now = new Date();

  // Convert RawItem[] to Content data
  const contentDataList = items.map((item) => {
    const metadata = parseMetadata(item.metadataJson);
    const engagement = metadata.engagement ?? {};
    const likeCount = engagement.score ?? 0;
    const replyCount = engagement.comments ?? 0;
    const retweetCount = engagement.reactions ?? 0;

    // quotedTweet: quote || quotedTweet
    const quotedTweet = (metadata as Record<string, unknown>).quotedTweet ?? metadata.quote;

    // Build metadata JSON for Content
    const contentMetadata = {
      tweetId: metadata.tweetId || item.id,
      tab,
      likeCount,
      replyCount,
      retweetCount,
      media: metadata.media,
      quotedTweet,
      thread: metadata.thread,
      parent: metadata.parent,
      article: metadata.article,
    };

    return {
      id: item.id,
      kind: "tweet" as ContentKind,
      sourceId: item.sourceId || "twitter",
      title: null, // tweets don't have a separate title
      body: item.content || item.title,
      url: metadata.expandedUrl || item.url, // Use expandedUrl for deduplication
      authorLabel: item.author || metadata.authorName || "",
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : now,
      fetchedAt: item.fetchedAt ? new Date(item.fetchedAt) : now,
      engagementScore: computeTweetEngagementScore(likeCount, replyCount, retweetCount),
      topicIds: [] as string[],
      topicScoresJson: null,
      metadataJson: JSON.stringify(contentMetadata),
    };
  });

  // Query existing URLs for deduplication
  const allUrls = contentDataList.map((c) => c.url);
  const existingContents = await prisma.content.findMany({
    where: { url: { in: allUrls }, kind: "tweet" },
    select: { id: true, url: true, topicIds: true },
  });
  const existingUrlSet = new Set(existingContents.map((c) => c.url));
  const existingUrlToContent = new Map(existingContents.map((c) => [c.url, c]));

  // Separate new and update
  const newItems = [];
  const updateItems: Array<{ item: typeof contentDataList[0]; existingId: string }> = [];

  for (const item of contentDataList) {
    if (existingUrlSet.has(item.url)) {
      updateItems.push({ item, existingId: existingUrlToContent.get(item.url)!.id });
    } else {
      newItems.push(item);
    }
  }

  let newCount = 0;
  let updateCount = 0;
  let newContentIds: string[] = [];

  // Batch create new records
  if (newItems.length > 0) {
    for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
      const batch = newItems.slice(i, i + BATCH_SIZE);
      await prisma.content.createMany({
        data: batch,
        skipDuplicates: true,
      });
      newCount += batch.length;
    }

    // Query newly created content IDs
    const newUrls = newItems.map((c) => c.url);
    const createdContents = await prisma.content.findMany({
      where: { url: { in: newUrls }, kind: "tweet" },
      select: { id: true, url: true },
    });
    const existingUrls = new Set(existingContents.map((c) => c.url));
    newContentIds = createdContents.filter((c) => !existingUrls.has(c.url)).map((c) => c.id);
  }

  // Batch update existing records
  if (updateItems.length > 0) {
    const updatePromises = updateItems.map(({ item, existingId }) => {
      const existing = existingUrlToContent.get(item.url);
      const mergedTopicIds = existing
        ? Array.from(new Set([...existing.topicIds, ...item.topicIds]))
        : item.topicIds;

      return prisma.content.update({
        where: { id: existingId },
        data: {
          fetchedAt: item.fetchedAt,
          engagementScore: item.engagementScore,
          topicIds: mergedTopicIds,
        },
      });
    });

    for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
      const batch = updatePromises.slice(i, i + BATCH_SIZE);
      await Promise.all(batch);
      updateCount += batch.length;
    }
  }

  return {
    newCount,
    updateCount,
    totalCount: items.length,
    newContentIds,
  };
}
