/**
 * Unified Content upsert layer for Prisma
 *
 * Replaces separate Item/Tweet upserts with a single Content model.
 * Content is deduplicated by URL (unique constraint).
 */

import { prisma } from "../../lib/prisma";
import type { Content, ContentKind } from "../types/index";

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
): Promise<ContentArchiveResult> {
  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newContentIds: [] };
  }

  // 1. 查询已存在的 URL
  const allUrls = items.map((i) => i.url);
  const existingContents = await prisma.content.findMany({
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
      await prisma.content.createMany({
        data: batch,
        skipDuplicates: true,
      });
      newCount += batch.length;
    }

    // 查询本次实际新建的 content ID
    const newUrls = newItems.map((i) => i.url);
    const createdContents = await prisma.content.findMany({
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

      return prisma.content.update({
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
 * 同步 Packs 到数据库（批量）
 */
export async function syncPacksToPrisma(
  packs: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>,
): Promise<void> {
  if (packs.length === 0) return;

  const upsertPromises = packs.map((pack) =>
    prisma.pack.upsert({
      where: { id: pack.id },
      create: {
        id: pack.id,
        name: pack.name,
        description: pack.description,
      },
      update: {
        name: pack.name,
        description: pack.description,
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
    packId?: string;
  }>,
): Promise<void> {
  if (sources.length === 0) return;

  // Deduplicate by (packId, url) — keep first occurrence, ignore duplicates
  const seen = new Set<string>();
  const deduped = sources.filter((s) => {
    const key = `${s.packId ?? ""}|${s.url ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Step 1: Query existing sources by (packId, url) to handle the case where
  // a (packId, url) combo exists with a different id than source.id
  const packUrlKeys = deduped.map((s) => ({ packId: s.packId ?? null, url: s.url ?? "" }));
  const existingByPackUrl = await prisma.source.findMany({
    where: {
      OR: packUrlKeys.map((k) => ({ packId: k.packId, url: { equals: k.url } })),
    },
    select: { id: true, packId: true, url: true },
  });
  const packUrlToId = new Map(
    existingByPackUrl.map((e) => [`${e.packId ?? ""}|${e.url}`, e.id]),
  );

  // Step 2: Build upsert operations — use id if exists, otherwise use (packId, url)
  const upsertPromises = deduped.map((source) => {
    const key = `${source.packId ?? ""}|${source.url ?? ""}`;
    const existingId = packUrlToId.get(key);

    if (existingId) {
      // (packId, url) exists — upsert by id to update it
      return prisma.source.upsert({
        where: { id: existingId },
        create: {
          id: existingId,
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          packId: source.packId,
        },
        update: {
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          packId: source.packId,
        },
      });
    } else {
      // No existing (packId, url) — upsert by id (will create new)
      return prisma.source.upsert({
        where: { id: source.id },
        create: {
          id: source.id,
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          packId: source.packId,
        },
        update: {
          kind: source.kind,
          name: source.name || source.id,
          url: source.url || "",
          enabled: source.enabled,
          configJson: source.configJson,
          packId: source.packId,
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
