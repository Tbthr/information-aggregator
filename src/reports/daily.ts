/**
 * 日报生成模块
 */

import { prisma } from "../../lib/prisma";
import { beijingDayRange, formatUtcDayLabel } from "../../lib/date-utils";
import type { AiClient } from "../ai/types";
import {
  buildDailyOverviewPrompt,
  parseDailyOverviewResult,
} from "../ai/prompts-reports";
import { createLogger } from "../utils/logger";

const logger = createLogger("reports:daily");

export interface DailyGenerateConfig {
  maxItems: number;
}

const DEFAULT_CONFIG: DailyGenerateConfig = {
  maxItems: 20,
};

export interface DailyGenerateResult {
  date: string;
  itemCount: number;
}

/**
 * 生成日报
 */
export async function generateDailyReport(
  date: string, // YYYY-MM-DD
  aiClient: AiClient,
  config: Partial<DailyGenerateConfig> = {},
): Promise<DailyGenerateResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxItems } = mergedConfig;

  logger.info("Generating daily report", { date, maxItems });

  // 1. 查询当日 Item（按 publishedAt 过滤，使用北京时间界定一天）
  const { start: startOfDay, end: endOfDay } = beijingDayRange(date);

  const items = await prisma.item.findMany({
    where: {
      publishedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { score: "desc" },
    take: maxItems,
    select: {
      id: true,
      title: true,
      summary: true,
      score: true,
    },
  });

  if (items.length === 0) {
    logger.warn("No items found for date", { date });
    return { date, itemCount: 0 };
  }

  const itemIds = items.map((i) => i.id);

  // 3. AI 生成日报概览
  const prompt = buildDailyOverviewPrompt(items);

  let summary = `${date} 技术日报：共 ${items.length} 篇文章`;

  try {
    // 尝试调用 AI（如果客户端支持）
    const aiResponse = await (aiClient as unknown as { request?: (p: string) => Promise<unknown> }).request?.(prompt);
    if (aiResponse) {
      const text = typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse);
      const result = parseDailyOverviewResult(text);
      if (result) {
        summary = result.summary;
      }
    }
  } catch (error) {
    logger.warn("AI summary generation failed, using default", { date });
  }

  // 4. 生成 dayLabel
  const dayLabel = formatUtcDayLabel(new Date(date));

  // 5. 写入 DailyOverview（upsert）
  await prisma.dailyOverview.upsert({
    where: { date },
    create: {
      date,
      dayLabel,
      summary,
      itemIds,
    },
    update: {
      dayLabel,
      summary,
      itemIds,
    },
  });

  logger.info("Daily report generated", {
    date,
    itemCount: items.length,
  });

  return {
    date,
    itemCount: items.length,
  };
}


