/**
 * 周报生成模块
 */

import { prisma } from "../../lib/prisma";
import { beijingWeekRange, formatUtcDate, formatUtcDayLabel, utcWeekNumber } from "../../lib/date-utils";
import type { AiClient } from "../ai/types";
import {
  buildWeeklyEditorialPrompt,
  parseWeeklyEditorialResult,
  buildTimelineEventPrompt,
  parseTimelineEventResult,
} from "../ai/prompts-reports";
import { createLogger } from "../utils/logger";

const logger = createLogger("reports:weekly");

export interface WeeklyGenerateConfig {
  days: number;
  maxItemsPerDay: number;
}

const DEFAULT_CONFIG: WeeklyGenerateConfig = {
  days: 7,
  maxItemsPerDay: 5,
};

export interface WeeklyGenerateResult {
  weekNumber: string;
  timelineEventCount: number;
}

/**
 * 计算周范围（按北京时间界定周一~周日）
 */
function getWeekRange(date: Date): { start: Date; end: Date; weekNumber: string } {
  const { start, end } = beijingWeekRange(date);
  const weekNumber = utcWeekNumber(start);
  return { start, end, weekNumber };
}

/**
 * 生成周报
 */
export async function generateWeeklyReport(
  date: Date,
  aiClient: AiClient,
  config: Partial<WeeklyGenerateConfig> = {},
): Promise<WeeklyGenerateResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxItemsPerDay } = mergedConfig;

  const weekRange = getWeekRange(date);
  const { start, end, weekNumber } = weekRange;

  logger.info("Generating weekly report", { weekNumber, start, end });

  // 1. 查询本周 DailyOverview（或直接查 Item）
  let dailyOverviews: Array<{
    id: string;
    createdAt: Date;
    date: string;
    dayLabel: string;
    summary: string;
    itemIds: string[];
  }> = await prisma.dailyOverview.findMany({
    where: {
      date: {
        gte: formatUtcDate(start),
        lte: formatUtcDate(end),
      },
    },
    orderBy: { date: "asc" },
  });

  // 如果没有 DailyOverview，直接查询 Item
  if (dailyOverviews.length === 0) {
    logger.info("No DailyOverview found, querying items directly");

    const items = await prisma.item.findMany({
      where: {
        publishedAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { score: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        publishedAt: true,
      },
    });

    // 按日期分组
    const itemsByDate = new Map<string, typeof items>();
    for (const item of items) {
      const dateStr = item.publishedAt ? formatUtcDate(item.publishedAt) : formatUtcDate(new Date());
      if (!itemsByDate.has(dateStr)) {
        itemsByDate.set(dateStr, []);
      }
      itemsByDate.get(dateStr)!.push(item);
    }

    // 创建临时的 DailyOverview 数据（用于后续处理，不写入数据库）
    dailyOverviews = Array.from(itemsByDate.entries()).map(([d, items]) => ({
      id: `temp-${d}`,
      createdAt: new Date(),
      date: d,
      dayLabel: formatUtcDayLabel(new Date(d)),
      summary: "",
      itemIds: items.slice(0, maxItemsPerDay).map((i) => i.id),
    }));
  }

  if (dailyOverviews.length === 0) {
    logger.warn("No data found for week", { weekNumber });
    return { weekNumber, timelineEventCount: 0 };
  }

  // 2. 生成 TimelineEvent
  const timelineEvents: Array<{
    date: string;
    dayLabel: string;
    title: string;
    summary: string;
    itemIds: string[];
  }> = [];

  for (const overview of dailyOverviews) {
    // 获取 Item 详情
    const items = await prisma.item.findMany({
      where: { id: { in: overview.itemIds } },
      select: { id: true, title: true, summary: true },
    });

    // AI 生成时间线事件标题
    const prompt = buildTimelineEventPrompt(items, overview.dayLabel);
    let title = `${overview.dayLabel}动态`;
    let summary = `共 ${items.length} 篇文章`;

    try {
      const aiResponse = await (aiClient as unknown as { request?: (p: string) => Promise<unknown> }).request?.(prompt);
      if (aiResponse) {
        const text = typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse);
        const result = parseTimelineEventResult(text);
        if (result) {
          title = result.title;
          summary = result.summary;
        }
      }
    } catch (error) {
      logger.warn("Failed to generate timeline event", { date: overview.date });
    }

    timelineEvents.push({
      date: overview.date,
      dayLabel: overview.dayLabel,
      title,
      summary,
      itemIds: overview.itemIds,
    });
  }

  // 3. AI 生成周报编辑评述
  const editorialPrompt = buildWeeklyEditorialPrompt(timelineEvents);
  let headline = `第${weekNumber.split("-W")[1]}周技术动态`;
  let subheadline = `本周共 ${dailyOverviews.length} 天更新`;
  let editorial = "";

  try {
    const aiResponse = await (aiClient as unknown as { request?: (p: string) => Promise<unknown> }).request?.(editorialPrompt);
    if (aiResponse) {
      const text = typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse);
      const result = parseWeeklyEditorialResult(text);
      if (result) {
        headline = result.headline;
        subheadline = result.subheadline;
        editorial = result.editorial;
      }
    }
  } catch (error) {
    logger.warn("Failed to generate weekly editorial");
  }

  // 4. 写入 WeeklyReport + TimelineEvent
  const weeklyReport = await prisma.weeklyReport.upsert({
    where: { weekNumber },
    create: {
      weekNumber,
      headline,
      subheadline,
      editorial,
    },
    update: {
      headline,
      subheadline,
      editorial,
    },
  });

  // 删除旧的 TimelineEvent
  await prisma.timelineEvent.deleteMany({
    where: { weeklyReportId: weeklyReport.id },
  });

  // 创建新的 TimelineEvent
  for (let i = 0; i < timelineEvents.length; i++) {
    const event = timelineEvents[i];
    await prisma.timelineEvent.create({
      data: {
        weeklyReportId: weeklyReport.id,
        date: event.date,
        dayLabel: event.dayLabel,
        title: event.title,
        summary: event.summary,
        itemIds: event.itemIds,
        order: i,
      },
    });
  }

  logger.info("Weekly report generated", {
    weekNumber,
    timelineEventCount: timelineEvents.length,
  });

  return {
    weekNumber,
    timelineEventCount: timelineEvents.length,
  };
}


