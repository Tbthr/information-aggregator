import { prisma } from "../../lib/prisma";
import type { RawItem, SourceType } from "../types/index";

import type { Item } from "@prisma/client";

// 批量操作的分批大小
const BATCH_SIZE = 100;

export interface ArchiveResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
  newItemIds: string[];
}

/**
 * 从 metadataJson 解析 sourceType
 */
function parseSourceType(metadataJson: string): SourceType {
  try {
    const metadata = JSON.parse(metadataJson);
    return metadata.sourceType || "rss";
  } catch {
    return "rss";
  }
}

/**
 * 将 RawItem 转换为数据库记录（用于 createMany）
 */
function rawItemToCreateData(
  item: RawItem,
  fetchedAt: string,
  sourceNameMap: Record<string, string>,
): Omit<Item, "source" | "bookmarks" | "createdAt" | "updatedAt" | "id"> {
  const sourceType = parseSourceType(item.metadataJson);
  const sourceName = sourceNameMap[item.sourceId] ?? item.sourceId;

  return {
    // id 由 Prisma 自动生成 cuid
    title: item.title,
    url: item.url,
    sourceId: item.sourceId,
    sourceName,
    sourceType,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    fetchedAt: new Date(fetchedAt),
    author: item.author ?? null,
    summary: null,
    bullets: [],
    content: item.content ?? null,
    imageUrl: null,
    categories: [],
    score: 5.0,
    metadataJson: item.metadataJson ?? null,
  };
}

/**
 * 归档写入 Supabase：批量 UPSERT 模式
 * @param sourceNameMap sourceId → source.name 的映射，用于正确填充 sourceName 字段
 */
export async function archiveRawItems(
  items: RawItem[],
  fetchedAt: string,
  sourceNameMap: Record<string, string> = {},
): Promise<ArchiveResult> {
  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newItemIds: [] };
  }

  // 如果未提供 sourceNameMap，从 DB 查询补充
  let resolvedNameMap = sourceNameMap;
  if (Object.keys(resolvedNameMap).length === 0 && items.length > 0) {
    const sourceIds = [...new Set(items.map((i) => i.sourceId))];
    const sources = await prisma.source.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true },
    });
    resolvedNameMap = Object.fromEntries(sources.map((s) => [s.id, s.name]));
  }

  // 1. 批量查询已存在的 URL（用于去重）
  const allUrls = items.map((i) => i.url);
  const existingItems = await prisma.item.findMany({
    where: { url: { in: allUrls } },
    select: { id: true, url: true },
  });
  const existingUrlSet = new Set(existingItems.map((i) => i.url));
  const existingUrlToId = new Map(existingItems.map((i) => [i.url, i.id]));

  // 2. 分离新增和更新
  const newItems: RawItem[] = [];
  const updateItems: Array<{ item: RawItem; existingId: string }> = [];

  for (const item of items) {
    if (existingUrlSet.has(item.url)) {
      updateItems.push({ item, existingId: existingUrlToId.get(item.url)! });
    } else {
      newItems.push(item);
    }
  }

  let newCount = 0;
  let updateCount = 0;
  let newItemIds: string[] = [];

  // 3. 批量创建新记录
  if (newItems.length > 0) {
    const createData = newItems.map((item) => rawItemToCreateData(item, fetchedAt, resolvedNameMap));

    // 分批创建，避免单次操作过大
    for (let i = 0; i < createData.length; i += BATCH_SIZE) {
      const batch = createData.slice(i, i + BATCH_SIZE);
      const result = await prisma.item.createMany({
        data: batch,
        skipDuplicates: true,
      });
      newCount += result.count;
    }

    // 仅查询本次实际新建的 item ID（排除已有 URL 对应的 item）
    const newUrls = newItems.map(i => i.url);
    const createdItems = await prisma.item.findMany({
      where: { url: { in: newUrls } },
      select: { id: true, url: true },
    });
    const existingUrlToExistingId = new Map(existingItems.map(i => [i.url, i.id]));
    newItemIds = createdItems
      .filter(i => !existingUrlToExistingId.has(i.url))
      .map(i => i.id);
  }

  // 4. 批量更新已存在的记录
  if (updateItems.length > 0) {
    const updatePromises = updateItems.map(({ item, existingId }) =>
      prisma.item.update({
        where: { id: existingId },
        data: {
          fetchedAt: new Date(fetchedAt),
        },
      }),
    );

    // 分批执行，避免事务过大
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
    newItemIds,
  };
}

/**
 * 同步 Packs 到数据库（批量）
 */
export async function syncPacksToPrisma(
  packs: Array<{
    id: string;
    name: string;
    description?: string;
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
 * Upsert 数据源（支持批量）
 */
export async function upsertSourceToPrisma(source: {
  id: string;
  type: string;
  name?: string;
  enabled: boolean;
  url?: string;
  configJson?: string;
  packId?: string;
}): Promise<void> {
  await prisma.source.upsert({
    where: { id: source.id },
    create: {
      id: source.id,
      type: source.type,
      name: source.name || source.id,
      url: source.url || "",
      enabled: source.enabled,
      configJson: source.configJson,
      packId: source.packId,
    },
    update: {
      type: source.type,
      name: source.name || source.id,
      url: source.url || "",
      enabled: source.enabled,
      configJson: source.configJson,
      packId: source.packId,
    },
  });
}

/**
 * 批量 Upsert 数据源
 */
export async function upsertSourcesBatch(
  sources: Array<{
    id: string;
    type: string;
    name?: string;
    enabled: boolean;
    url?: string;
    configJson?: string;
    packId?: string;
  }>,
): Promise<void> {
  if (sources.length === 0) return;

  const upsertPromises = sources.map((source) =>
    prisma.source.upsert({
      where: { id: source.id },
      create: {
        id: source.id,
        type: source.type,
        name: source.name || source.id,
        url: source.url || "",
        enabled: source.enabled,
        configJson: source.configJson,
        packId: source.packId,
      },
      update: {
        type: source.type,
        name: source.name || source.id,
        url: source.url || "",
        enabled: source.enabled,
        configJson: source.configJson,
        packId: source.packId,
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
 * 批量记录数据源成功状态
 */
export async function recordSourceSuccess(
  sourceId: string,
  metrics: { fetchedAt: string; itemCount: number },
): Promise<void> {
  await prisma.sourceHealth.upsert({
    where: { sourceId },
    create: {
      sourceId,
      lastSuccessAt: new Date(metrics.fetchedAt),
      consecutiveFailures: 0,
      updatedAt: new Date(),
    },
    update: {
      lastSuccessAt: new Date(metrics.fetchedAt),
      consecutiveFailures: 0,
      updatedAt: new Date(),
    },
  });
}

/**
 * 批量记录数据源状态
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
 * 获取归档统计
 */
export async function getArchiveStats(): Promise<{
  totalItems: number;
  oldestItem: Date | null;
  newestItem: Date | null;
  bySource: Array<{ sourceId: string; count: bigint }>;
}> {
  const totalItems = await prisma.item.count();

  const oldestNewest = await prisma.item.findFirst({
    orderBy: { fetchedAt: "asc" },
    select: { fetchedAt: true },
  });

  const newestItem = await prisma.item.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });

  const bySource = await prisma.item.groupBy({
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


