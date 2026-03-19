import { PrismaClient } from "@prisma/client";
import type { RawItem, SourceType } from "../types/index";

const prisma = new PrismaClient();

export interface ArchiveResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
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
 * 从 sourceId 生成 sourceName（简化版）
 */
function sourceIdToName(sourceId: string): string {
  // 从 sourceId 中提取域名作为名称
  const parts = sourceId.split("-");
  if (parts.length > 1) {
    return parts.slice(0, -1).join("-").replace(/-/g, " ");
  }
  return sourceId;
}

/**
 * 归档写入 Supabase：UPSERT 模式
 */
export async function archiveRawItems(
  items: RawItem[],
  fetchedAt: string,
): Promise<ArchiveResult> {
  let newCount = 0;
  let updateCount = 0;

  for (const item of items) {
    const sourceType = parseSourceType(item.metadataJson);
    const sourceName = sourceIdToName(item.sourceId);

    // 检查是否已存在
    const existing = await prisma.item.findUnique({
      where: { id: item.id },
    });

    if (existing) {
      // 更新现有记录
      await prisma.item.update({
        where: { id: item.id },
        data: {
          fetchedAt: new Date(fetchedAt),
          snippet: item.snippet ?? existing.snippet,
        },
      });
      updateCount++;
    } else {
      // 创建新记录
      await prisma.item.create({
        data: {
          id: item.id,
          title: item.title,
          url: item.url,
          canonicalUrl: item.url,
          snippet: item.snippet,
          sourceId: item.sourceId,
          sourceName,
          sourceType,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          fetchedAt: new Date(fetchedAt),
          author: item.author,
          metadataJson: item.metadataJson,
          score: 5.0,
          bullets: [],
          categories: [],
        },
      });
      newCount++;
    }
  }

  return {
    newCount,
    updateCount,
    totalCount: items.length,
  };
}

/**
 * 同步 Packs 到数据库
 */
export async function syncPacksToPrisma(
  packs: Array<{
    id: string;
    name: string;
    description?: string;
    policyJson?: string;
  }>,
): Promise<void> {
  for (const pack of packs) {
    await prisma.pack.upsert({
      where: { id: pack.id },
      create: {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        policyJson: pack.policyJson,
      },
      update: {
        name: pack.name,
        description: pack.description,
        policyJson: pack.policyJson,
      },
    });
  }
}

/**
 * Upsert 数据源
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
      url: source.url,
      enabled: source.enabled,
      configJson: source.configJson,
      packId: source.packId,
    },
    update: {
      type: source.type,
      name: source.name || source.id,
      url: source.url,
      enabled: source.enabled,
      configJson: source.configJson,
      packId: source.packId,
    },
  });
}

/**
 * 记录数据源成功状态
 */
export async function recordSourceSuccess(
  sourceId: string,
  metrics: { fetchedAt: string; itemCount: number },
): Promise<void> {
  const existing = await prisma.sourceHealth.findUnique({
    where: { sourceId },
  });

  if (existing) {
    await prisma.sourceHealth.update({
      where: { sourceId },
      data: {
        lastSuccessAt: new Date(metrics.fetchedAt),
        consecutiveFailures: 0,
      },
    });
  } else {
    await prisma.sourceHealth.create({
      data: {
        sourceId,
        lastSuccessAt: new Date(metrics.fetchedAt),
        consecutiveFailures: 0,
      },
    });
  }
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

export { prisma };
