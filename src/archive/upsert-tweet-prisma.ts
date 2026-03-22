/**
 * Tweet 归档模块（Prisma 版本）
 * 将 bird CLI adapter 返回的数据写入 Tweet 表，以 tweetId 去重
 */

import { prisma } from "../../lib/prisma";

// 批量操作的分批大小
const BATCH_SIZE = 100;

// ─── 内联类型定义（避免引入已清理的 x-* 类型） ───

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

/** 解析后的 metadata 结构（bird CLI 写入的字段子集） */
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

/** 转换后的 Tweet 数据（用于 createMany） */
export interface TweetCreateData {
  tweetId: string;
  tab: string;
  text: string;
  url: string;
  expandedUrl: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  authorHandle: string;
  authorName: string | null;
  authorId: string | null;
  conversationId: string | null;
  likeCount: number;
  replyCount: number;
  retweetCount: number;
  summary: string | null;
  bullets: string[];
  categories: string[];
  score: number;
  mediaJson: string | null;
  quotedTweetJson: string | null;
  threadJson: string | null;
  parentJson: string | null;
  articleJson: string | null;
}

export interface ArchiveTweetsResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
  newTweetIds: string[];
}

// ─── 解析函数 ───

/**
 * 将 bird CLI adapter 返回的 RawItem[] 转换为 Tweet 表数据
 */
export function parseRawItemsToTweetData(
  items: RawItem[],
  tab: string,
): TweetCreateData[] {
  const now = new Date();

  return items.map((item) => {
    let metadata: ParsedMetadata = {};
    try {
      metadata = JSON.parse(item.metadataJson) as ParsedMetadata;
    } catch {
      // metadataJson 解析失败时使用空对象
    }

    const engagement = metadata.engagement;

    // quotedTweet: quote || quotedTweet
    const quotedTweet = (metadata as Record<string, unknown>).quotedTweet ?? metadata.quote;

    return {
      tweetId: metadata.tweetId || item.id,
      tab,
      text: item.content || item.title,
      url: item.url,
      expandedUrl: metadata.expandedUrl ?? null,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      fetchedAt: item.fetchedAt ? new Date(item.fetchedAt) : now,
      authorHandle: item.author ?? "",
      authorName: metadata.authorName ?? null,
      authorId: metadata.authorId ?? null,
      conversationId: metadata.conversationId ?? null,
      likeCount: engagement?.score ?? 0,
      replyCount: engagement?.comments ?? 0,
      retweetCount: engagement?.reactions ?? 0,
      summary: null,
      bullets: [],
      categories: [],
      score: 5.0,
      mediaJson: metadata.media ? JSON.stringify(metadata.media) : null,
      quotedTweetJson: quotedTweet ? JSON.stringify(quotedTweet) : null,
      threadJson: metadata.thread ? JSON.stringify(metadata.thread) : null,
      parentJson: metadata.parent ? JSON.stringify(metadata.parent) : null,
      articleJson: metadata.article ? JSON.stringify(metadata.article) : null,
    };
  });
}

// ─── 归档函数 ───

/**
 * 使用 Prisma upsert 写入 Tweet 表，以 tweetId 去重
 */
export async function archiveTweets(
  items: RawItem[],
  tab: string,
): Promise<ArchiveTweetsResult> {
  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newTweetIds: [] };
  }

  // 1. 转换为 Tweet 数据
  const tweetDataList = parseRawItemsToTweetData(items, tab);
  const tweetIdMap = new Map(tweetDataList.map((d) => [d.tweetId, d]));

  // 2. 查询已有的 tweetId
  const allTweetIds = [...tweetIdMap.keys()];
  const existingTweets = await prisma.tweet.findMany({
    where: { tweetId: { in: allTweetIds } },
    select: { id: true, tweetId: true },
  });
  const existingTweetIdSet = new Set(existingTweets.map((t) => t.tweetId));
  const existingTweetIdToDbId = new Map(existingTweets.map((t) => [t.tweetId, t.id]));

  // 3. 分离新增和更新
  const newItems: TweetCreateData[] = [];
  const updateItems: TweetCreateData[] = [];

  for (const data of tweetDataList) {
    if (existingTweetIdSet.has(data.tweetId)) {
      updateItems.push(data);
    } else {
      newItems.push(data);
    }
  }

  let newCount = 0;
  let updateCount = 0;
  let newTweetIds: string[] = [];

  // 4. 批量创建新记录
  if (newItems.length > 0) {
    for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
      const batch = newItems.slice(i, i + BATCH_SIZE);
      const result = await prisma.tweet.createMany({
        data: batch,
        skipDuplicates: true,
      });
      newCount += result.count;
    }

    // 查询本次实际新建的 Tweet DB ID
    const newTweetIdsOnly = newItems.map((d) => d.tweetId);
    const createdTweets = await prisma.tweet.findMany({
      where: { tweetId: { in: newTweetIdsOnly } },
      select: { id: true, tweetId: true },
    });
    const existingIdSet = new Set(existingTweets.map((t) => t.id));
    newTweetIds = createdTweets
      .filter((t) => !existingIdSet.has(t.id))
      .map((t) => t.id);
  }

  // 5. 批量更新已有记录（刷新 engagement 数据和 tab）
  if (updateItems.length > 0) {
    const updatePromises = updateItems.map((data) => {
      const dbId = existingTweetIdToDbId.get(data.tweetId)!;
      return prisma.tweet.update({
        where: { id: dbId },
        data: {
          tab,
          text: data.text,
          likeCount: data.likeCount,
          replyCount: data.replyCount,
          retweetCount: data.retweetCount,
          mediaJson: data.mediaJson,
          quotedTweetJson: data.quotedTweetJson,
          threadJson: data.threadJson,
          parentJson: data.parentJson,
          articleJson: data.articleJson,
        },
      });
    });

    for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
      const batch = updatePromises.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(batch);
      updateCount += batch.length;
    }
  }

  return {
    newCount,
    updateCount,
    totalCount: items.length,
    newTweetIds,
  };
}
