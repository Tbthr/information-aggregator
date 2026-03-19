/**
 * AI 增强模块（Prisma 版本）
 * 对 Item 进行内容提取和 AI 增强
 */

import { PrismaClient } from "@prisma/client";
import { extractArticleContent, isExtractionSuccess, type ExtractedContent } from "../pipeline/extract-content";
import { processWithConcurrency } from "../ai/concurrency";
import type { AiClient } from "../ai/types";
import { createLogger } from "../utils/logger";

const logger = createLogger("archive:enrich-prisma");

const prisma = new PrismaClient();

// 默认配置
const DEFAULT_CONFIG = {
  contentExtractionTimeout: 15000,
  maxContentLength: 10000,
  extractionConcurrency: 3,
  extractionBatchSize: 5,
  aiConcurrency: 2,
  aiBatchSize: 5,
};

export interface EnrichConfig {
  contentExtractionTimeout?: number;
  maxContentLength?: number;
  extractionConcurrency?: number;
  extractionBatchSize?: number;
  aiConcurrency?: number;
  aiBatchSize?: number;
}

export interface EnrichResult {
  successCount: number;
  failCount: number;
  totalCount: number;
}

/**
 * 获取需要增强的 Item IDs
 */
export async function getItemsToEnrich(
  mode: "new" | "backfill" | "force",
  newItemIds: string[],
): Promise<string[]> {
  if (mode === "force") {
    // 强制模式：获取所有 Item
    const allItems = await prisma.item.findMany({
      select: { id: true },
    });
    return allItems.map((i) => i.id);
  }

  if (mode === "backfill") {
    // 补全模式：获取 summary 为空的 Item
    const emptyItems = await prisma.item.findMany({
      where: { summary: null },
      select: { id: true },
    });
    return emptyItems.map((i) => i.id);
  }

  // 默认模式：仅新 Item
  return newItemIds;
}

/**
 * 单个 Item 增强结果
 */
interface ItemEnrichData {
  id: string;
  content?: string;
  imageUrl?: string;
  summary?: string;
  bullets?: string[];
  categories?: string[];
  score?: number;
}

/**
 * 对单个 Item 执行内容提取
 */
async function extractContentForItem(
  item: { id: string; url: string; title: string },
  config: EnrichConfig,
): Promise<ExtractedContent | null> {
  try {
    const result = await extractArticleContent(item.url, {
      timeout: config.contentExtractionTimeout ?? DEFAULT_CONFIG.contentExtractionTimeout,
      maxLength: config.maxContentLength ?? DEFAULT_CONFIG.maxContentLength,
    });

    if (isExtractionSuccess(result)) {
      return result;
    }

    logger.warn("Content extraction failed", {
      itemId: item.id,
      error: result.error,
    });
    return null;
  } catch (error) {
    logger.error("Content extraction error", {
      itemId: item.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 对单个 Item 执行 AI 增强
 */
async function aiEnrichItem(
  item: { id: string; title: string; url: string },
  content: string | null,
  aiClient: AiClient,
): Promise<Omit<ItemEnrichData, "id" | "content" | "imageUrl"> | null> {
  const textContent = content || item.title;

  try {
    // 并行执行 AI 任务
    const [score, summary, bullets, categories] = await Promise.all([
      aiClient.scoreWithContent(item.title, textContent, item.url).catch(() => null),
      aiClient.summarizeContent(item.title, textContent, 150).catch(() => null),
      aiClient.extractKeyPoints(item.title, textContent, 5).catch(() => null),
      aiClient.generateTags(item.title, textContent, 3).catch(() => null),
    ]);

    return {
      score: score ?? 5.0,
      summary: summary ?? undefined,
      bullets: bullets ?? [],
      categories: categories ?? [],
    };
  } catch (error) {
    logger.error("AI enrichment failed", {
      itemId: item.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 批量增强 Items
 */
export async function enrichItems(
  itemIds: string[],
  aiClient: AiClient,
  config: EnrichConfig = {},
): Promise<EnrichResult> {
  if (itemIds.length === 0) {
    return { successCount: 0, failCount: 0, totalCount: 0 };
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // 获取 Item 详情
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, url: true, title: true },
  });

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const results: ItemEnrichData[] = [];

  // 阶段1: 内容提取（带并发控制）
  logger.info("Starting content extraction", { count: items.length });

  const extractionResults = await processWithConcurrency(
    items,
    {
      batchSize: mergedConfig.extractionBatchSize,
      concurrency: mergedConfig.extractionConcurrency,
    },
    async (item) => {
      const content = await extractContentForItem(item, mergedConfig);
      return { itemId: item.id, content };
    },
  );

  // 阶段2: AI 增强（带并发控制）
  logger.info("Starting AI enrichment", { count: items.length });

  const enrichmentResults = await processWithConcurrency(
    extractionResults,
    {
      batchSize: mergedConfig.aiBatchSize,
      concurrency: mergedConfig.aiConcurrency,
    },
    async ({ itemId, content }) => {
      const item = itemMap.get(itemId);
      if (!item) return { itemId, data: null };

      const extractedContent = content;
      const textContent = extractedContent && isExtractionSuccess(extractedContent)
        ? extractedContent.textContent
        : null;

      const aiResult = await aiEnrichItem(item, textContent, aiClient);

      return {
        itemId,
        data: {
          id: itemId,
          content: textContent ?? undefined,
          imageUrl: extractedContent && isExtractionSuccess(extractedContent)
            ? undefined // Readability 不提取 imageUrl，后续可扩展
            : undefined,
          ...aiResult,
        },
      };
    },
  );

  // 收集成功的结果
  for (const { itemId, data } of enrichmentResults) {
    if (data) {
      results.push(data);
    }
  }

  // 阶段3: 批量更新数据库
  let successCount = 0;
  let failCount = 0;

  for (const result of results) {
    try {
      await prisma.item.update({
        where: { id: result.id },
        data: {
          content: result.content,
          imageUrl: result.imageUrl,
          summary: result.summary,
          bullets: result.bullets ?? [],
          categories: result.categories ?? [],
          score: result.score ?? 5.0,
        },
      });
      successCount++;
    } catch (error) {
      logger.error("Failed to update item", {
        itemId: result.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failCount++;
    }
  }

  logger.info("Enrichment completed", {
    total: itemIds.length,
    success: successCount,
    failed: failCount,
  });

  return {
    successCount,
    failCount,
    totalCount: itemIds.length,
  };
}

export { prisma };
