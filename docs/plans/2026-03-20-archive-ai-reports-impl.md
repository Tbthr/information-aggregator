# AI 增强与报告生成实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 archive collect 增加 AI 增强，新增 daily/weekly generate 命令

**Architecture:** 在现有抓取流程后增加内容提取和 AI 增强，日报/周报基于已增强的数据生成

**Tech Stack:** Prisma, Supabase, AI Client (Anthropic/Gemini), @mozilla/readability

---

## Task 1: 创建报告 AI Prompts

**Files:**
- Create: `src/ai/prompts-reports.ts`

**Step 1: 创建日报/周报 AI prompts 文件**

```typescript
/**
 * 日报和周报相关的 AI Prompts
 */

// ============ 日报 Prompts ============

/**
 * 构建日报概览 prompt
 */
export function buildDailyOverviewPrompt(items: Array<{ title: string; summary?: string | null }>): string {
  const itemList = items
    .map((item, i) => `${i + 1}. ${item.title}${item.summary ? `: ${item.summary.slice(0, 100)}` : ""}`)
    .join("\n");

  return `你是技术新闻编辑。请基于以下今日热门文章，生成日报概览。

今日文章列表：
${itemList}

请提供：
1. 整体摘要（2-3句话，概括今日技术社区的主要动态）
2. 今日看点（3-5个看点，每个看点一句话）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "summary": "<整体摘要>",
  "highlights": ["<看点1>", "<看点2>", "<看点3>"]
}`;
}

/**
 * 解析日报概览结果
 */
export function parseDailyOverviewResult(text: string): {
  summary: string;
  highlights: string[];
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.highlights)) {
      return null;
    }

    return {
      summary: parsed.summary,
      highlights: (parsed.highlights as string[]).filter((h): h is string => typeof h === "string"),
    };
  } catch {
    return null;
  }
}

// ============ 周报 Prompts ============

/**
 * 构建周报编辑评述 prompt
 */
export function buildWeeklyEditorialPrompt(
  timelineEvents: Array<{ date: string; dayLabel: string; title: string }>,
): string {
  const eventList = timelineEvents
    .map((e) => `- ${e.dayLabel} (${e.date}): ${e.title}`)
    .join("\n");

  return `你是技术新闻主编。请基于本周技术动态，撰写周报编辑评述。

本周技术动态：
${eventList}

请提供：
1. 周标题（一句话概括本周核心主题，不超过20字）
2. 周副标题（补充说明，不超过50字）
3. 编辑评述（200字以内，分析本周技术趋势和重要事件）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "headline": "<周标题>",
  "subheadline": "<周副标题>",
  "editorial": "<编辑评述>"
}`;
}

/**
 * 解析周报编辑评述结果
 */
export function parseWeeklyEditorialResult(text: string): {
  headline: string;
  subheadline: string;
  editorial: string;
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.subheadline !== "string" ||
      typeof parsed.editorial !== "string"
    ) {
      return null;
    }

    return {
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      editorial: parsed.editorial,
    };
  } catch {
    return null;
  }
}

/**
 * 构建时间线事件标题 prompt
 */
export function buildTimelineEventPrompt(
  items: Array<{ title: string; summary?: string | null }>,
  dayLabel: string,
): string {
  const itemList = items
    .map((item, i) => `${i + 1}. ${item.title}`)
    .join("\n");

  return `你是技术新闻编辑。请为以下今日技术动态生成一个简洁的标题和摘要。

日期：${dayLabel}

今日动态：
${itemList}

请提供：
1. 今日标题（一句话概括今日核心主题，不超过15字）
2. 今日摘要（100字以内）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "title": "<今日标题>",
  "summary": "<今日摘要>"
}`;
}

/**
 * 解析时间线事件结果
 */
export function parseTimelineEventResult(text: string): {
  title: string;
  summary: string;
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (typeof parsed.title !== "string" || typeof parsed.summary !== "string") {
      return null;
    }

    return {
      title: parsed.title,
      summary: parsed.summary,
    };
  } catch {
    return null;
  }
}
```

**Step 2: 验证文件创建**

Run: `ls -la src/ai/prompts-reports.ts`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/ai/prompts-reports.ts
git commit -m "feat: add AI prompts for daily and weekly reports"
```

---

## Task 2: 创建 Prisma AI 增强模块

**Files:**
- Create: `src/archive/enrich-prisma.ts`

**Step 1: 创建 AI 增强模块**

```typescript
/**
 * AI 增强模块（Prisma 版本）
 * 对 Item 进行内容提取和 AI 增强
 */

import { PrismaClient, type Item } from "@prisma/client";
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
```

**Step 2: 验证文件创建**

Run: `ls -la src/archive/enrich-prisma.ts`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/archive/enrich-prisma.ts
git commit -m "feat: add Prisma-based AI enrichment module"
```

---

## Task 3: 创建日报生成模块

**Files:**
- Create: `src/reports/daily.ts`

**Step 1: 创建日报生成模块**

```typescript
/**
 * 日报生成模块
 */

import { PrismaClient } from "@prisma/client";
import type { AiClient } from "../ai/types";
import {
  buildDailyOverviewPrompt,
  parseDailyOverviewResult,
} from "../ai/prompts-reports";
import { createLogger } from "../utils/logger";

const logger = createLogger("reports:daily");

const prisma = new PrismaClient();

export interface DailyGenerateConfig {
  maxItems: number;
  maxSpotlight: number;
}

const DEFAULT_CONFIG: DailyGenerateConfig = {
  maxItems: 20,
  maxSpotlight: 3,
};

export interface DailyGenerateResult {
  date: string;
  itemCount: number;
  spotlightCount: number;
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
  const { maxItems, maxSpotlight } = mergedConfig;

  logger.info("Generating daily report", { date, maxItems, maxSpotlight });

  // 1. 查询当日 Item（按 publishedAt 过滤）
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

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
    return { date, itemCount: 0, spotlightCount: 0 };
  }

  // 2. 选择 spotlight
  const spotlightItems = items.slice(0, maxSpotlight);
  const spotlightIds = spotlightItems.map((i) => i.id);
  const itemIds = items.map((i) => i.id);

  // 3. AI 生成日报概览
  const prompt = buildDailyOverviewPrompt(items);
  const response = await aiClient["request"]
    ? (aiClient as unknown as { request: (p: string) => Promise<unknown> }).request(prompt)
    : null;

  let summary = `${date} 技术日报：共 ${items.length} 篇文章`;

  if (response) {
    const text = typeof response === "string" ? response : JSON.stringify(response);
    const result = parseDailyOverviewResult(text);
    if (result) {
      summary = result.summary;
    }
  }

  // 4. 生成 dayLabel
  const dateObj = new Date(date);
  const dayLabel = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

  // 5. 写入 DailyOverview（upsert）
  await prisma.dailyOverview.upsert({
    where: { date },
    create: {
      date,
      dayLabel,
      summary,
      itemIds,
      spotlightIds,
    },
    update: {
      dayLabel,
      summary,
      itemIds,
      spotlightIds,
    },
  });

  logger.info("Daily report generated", {
    date,
    itemCount: items.length,
    spotlightCount: spotlightItems.length,
  });

  return {
    date,
    itemCount: items.length,
    spotlightCount: spotlightItems.length,
  };
}

export { prisma };
```

**Step 2: 验证文件创建**

Run: `ls -la src/reports/`
Expected: 目录存在

**Step 3: Commit**

```bash
git add src/reports/daily.ts
git commit -m "feat: add daily report generation module"
```

---

## Task 4: 创建周报生成模块

**Files:**
- Create: `src/reports/weekly.ts`

**Step 1: 创建周报生成模块**

```typescript
/**
 * 周报生成模块
 */

import { PrismaClient } from "@prisma/client";
import type { AiClient } from "../ai/types";
import {
  buildWeeklyEditorialPrompt,
  parseWeeklyEditorialResult,
  buildTimelineEventPrompt,
  parseTimelineEventResult,
} from "../ai/prompts-reports";
import { createLogger } from "../utils/logger";

const logger = createLogger("reports:weekly");

const prisma = new PrismaClient();

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
 * 计算周范围
 */
function getWeekRange(date: Date): { start: Date; end: Date; weekNumber: string } {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  // ISO week number
  const year = monday.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const days = Math.floor((monday.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);

  return {
    start: monday,
    end,
    weekNumber: `${year}-W${String(weekNumber).padStart(2, "0")}`,
  };
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * 格式化日期为中文星期
 */
function formatDayLabel(date: Date): string {
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[date.getDay()];
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
  const { days, maxItemsPerDay } = mergedConfig;

  const weekRange = getWeekRange(date);
  const { start, end, weekNumber } = weekRange;

  logger.info("Generating weekly report", { weekNumber, start, end });

  // 1. 查询本周 DailyOverview（或直接查 Item）
  // 这里按设计文档使用 DailyOverview 聚合，但如果没有 DailyOverview 则回退到 Item
  let dailyOverviews = await prisma.dailyOverview.findMany({
    where: {
      date: {
        gte: formatDate(start),
        lte: formatDate(end),
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
      const dateStr = item.publishedAt ? formatDate(item.publishedAt) : formatDate(new Date());
      if (!itemsByDate.has(dateStr)) {
        itemsByDate.set(dateStr, []);
      }
      itemsByDate.get(dateStr)!.push(item);
    }

    // 创建临时的 DailyOverview 数据
    dailyOverviews = Array.from(itemsByDate.entries()).map(([d, items]) => ({
      date: d,
      dayLabel: formatDayLabel(new Date(d)),
      summary: "",
      itemIds: items.slice(0, maxItemsPerDay).map((i) => i.id),
      spotlightIds: items.slice(0, 2).map((i) => i.id),
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
      const response = await (aiClient as unknown as { request: (p: string) => Promise<unknown> }).request(prompt);
      const text = typeof response === "string" ? response : JSON.stringify(response);
      const result = parseTimelineEventResult(text);
      if (result) {
        title = result.title;
        summary = result.summary;
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
    const response = await (aiClient as unknown as { request: (p: string) => Promise<unknown> }).request(editorialPrompt);
    const text = typeof response === "string" ? response : JSON.stringify(response);
    const result = parseWeeklyEditorialResult(text);
    if (result) {
      headline = result.headline;
      subheadline = result.subheadline;
      editorial = result.editorial;
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

export { prisma };
```

**Step 2: 验证文件创建**

Run: `ls -la src/reports/weekly.ts`
Expected: 文件存在

**Step 3: Commit**

```bash
git add src/reports/weekly.ts
git commit -m "feat: add weekly report generation module"
```

---

## Task 5: 修改 CLI 命令解析

**Files:**
- Modify: `src/cli/index.ts`

**Step 1: 添加新命令类型**

在 `ParsedCliArgs` 接口中添加新命令：

```typescript
export interface ParsedCliArgs {
  command:
    | "sources list"
    | "config validate"
    | "auth check"
    | "auth status"
    | "archive collect"
    | "archive stats"
    | "daily generate"
    | "weekly generate"
    | "serve"
    | "help"
    | "version";
  authType?: string;
  packIds?: string[];
  port?: number;
  dbPath?: string;
  date?: string;
  enrichMode?: "new" | "backfill" | "force";
}
```

**Step 2: 添加命令解析逻辑**

在 `parseCliArgs` 函数中添加：

```typescript
// daily generate [--date YYYY-MM-DD]
if (args[0] === "daily" && args[1] === "generate") {
  const rest = args.slice(2);
  const dateIndex = rest.indexOf("--date");
  const date = dateIndex !== -1 ? rest[dateIndex + 1] : undefined;
  return { command: "daily generate", date };
}

// weekly generate [--date YYYY-MM-DD]
if (args[0] === "weekly" && args[1] === "generate") {
  const rest = args.slice(2);
  const dateIndex = rest.indexOf("--date");
  const date = dateIndex !== -1 ? rest[dateIndex + 1] : undefined;
  return { command: "weekly generate", date };
}
```

**Step 3: 修改 archive collect 解析**

在 `archive collect` 解析部分添加 enrichMode：

```typescript
// archive collect [packs...] [--backfill] [--force]
if (args[0] === "archive" && args[1] === "collect") {
  const rest = args.slice(2);
  const backfill = rest.includes("--backfill");
  const force = rest.includes("--force");
  const enrichMode: "new" | "backfill" | "force" = force ? "force" : backfill ? "backfill" : "new";

  const packIds = rest.filter((a) => a !== "--backfill" && a !== "--force");
  return { command: "archive collect", packIds, enrichMode };
}
```

**Step 4: 更新帮助文本**

```typescript
export function getHelpText(): string {
  return [
    "information-aggregator",
    "",
    "Commands:",
    "  sources list               List sources matching selectors",
    "  config validate            Validate local config files",
    "  auth check                 Check auth configuration for a type",
    "  auth status                Show all auth configurations",
    "",
    "  archive collect [packs...] Collect and archive items with AI enrichment",
    "    --backfill               Backfill historical items with null fields",
    "    --force                  Force re-enrich all items",
    "  archive stats              Show archive statistics",
    "",
    "  daily generate [--date]    Generate daily report (default: today)",
    "  weekly generate [--date]   Generate weekly report (default: this week)",
    "",
    "  serve                      Start API server",
    "    --port <port>            Port number (default: 3000)",
    "",
    "  --help                     Show this help",
    "  --version                  Show version",
  ].join("\n");
}
```

**Step 5: 验证类型检查**

Run: `pnpm build`
Expected: 编译通过

**Step 6: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: add CLI parsing for daily/weekly generate commands"
```

---

## Task 6: 修改 CLI 主入口

**Files:**
- Modify: `src/cli/main.ts`

**Step 1: 添加命令导入**

```typescript
import { archiveCollectCommand, archiveStatsCommand } from "./commands/archive";
import { dailyGenerateCommand } from "./commands/daily";
import { weeklyGenerateCommand } from "./commands/weekly";
import { serveCommand } from "./commands/serve";
```

**Step 2: 添加命令路由**

在 `main` 函数中添加：

```typescript
if (parsed.command === "daily generate") {
  await dailyGenerateCommand(parsed.date);
  return;
}

if (parsed.command === "weekly generate") {
  await weeklyGenerateCommand(parsed.date);
  return;
}
```

**Step 3: 修改 archive collect 调用**

```typescript
if (parsed.command === "archive collect") {
  await archiveCollectCommand(
    parsed.packIds ?? [],
    { enrichMode: parsed.enrichMode ?? "new" },
  );
  return;
}
```

**Step 4: Commit**

```bash
git add src/cli/main.ts
git commit -m "feat: add CLI routing for daily/weekly generate commands"
```

---

## Task 7: 创建日报命令

**Files:**
- Create: `src/cli/commands/daily.ts`

**Step 1: 创建日报命令文件**

```typescript
/**
 * 日报生成命令
 */

import { PrismaClient } from "@prisma/client";
import { createAiClient, loadSettings } from "../../ai/providers";
import { generateDailyReport } from "../../reports/daily";
import { createLogger } from "../../utils/logger";

const logger = createLogger("cli:daily");

const prisma = new PrismaClient();

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * daily generate 命令
 */
export async function dailyGenerateCommand(dateStr?: string): Promise<void> {
  const date = dateStr || formatDate(new Date());

  console.log(`Generating daily report for ${date}...`);

  // 加载 AI 配置
  const settings = loadSettings("config/settings.yaml");
  const aiClient = createAiClient(settings);

  // 生成日报
  const result = await generateDailyReport(date, aiClient);

  if (result.itemCount === 0) {
    console.log(`No items found for ${date}`);
    return;
  }

  console.log(`Daily report generated for ${date}:`);
  console.log(`  Items: ${result.itemCount}`);
  console.log(`  Spotlight: ${result.spotlightCount}`);

  await prisma.$disconnect();
}
```

**Step 2: Commit**

```bash
git add src/cli/commands/daily.ts
git commit -m "feat: add daily generate CLI command"
```

---

## Task 8: 创建周报命令

**Files:**
- Create: `src/cli/commands/weekly.ts`

**Step 1: 创建周报命令文件**

```typescript
/**
 * 周报生成命令
 */

import { PrismaClient } from "@prisma/client";
import { createAiClient, loadSettings } from "../../ai/providers";
import { generateWeeklyReport } from "../../reports/weekly";
import { createLogger } from "../../utils/logger";

const logger = createLogger("cli:weekly");

const prisma = new PrismaClient();

/**
 * weekly generate 命令
 */
export async function weeklyGenerateCommand(dateStr?: string): Promise<void> {
  const date = dateStr ? new Date(dateStr) : new Date();

  console.log(`Generating weekly report for week of ${date.toISOString().split("T")[0]}...`);

  // 加载 AI 配置
  const settings = loadSettings("config/settings.yaml");
  const aiClient = createAiClient(settings);

  // 生成周报
  const result = await generateWeeklyReport(date, aiClient);

  if (result.timelineEventCount === 0) {
    console.log(`No data found for this week`);
    return;
  }

  console.log(`Weekly report generated:`);
  console.log(`  Week: ${result.weekNumber}`);
  console.log(`  Timeline events: ${result.timelineEventCount}`);

  await prisma.$disconnect();
}
```

**Step 2: Commit**

```bash
git add src/cli/commands/weekly.ts
git commit -m "feat: add weekly generate CLI command"
```

---

## Task 9: 修改 archive collect 命令

**Files:**
- Modify: `src/cli/commands/archive.ts`

**Step 1: 添加 AI 增强逻辑**

在 `archiveCollectCommand` 函数中：

1. 添加 `enrichMode` 参数
2. 在写入基础字段后调用 AI 增强
3. 更新函数签名

```typescript
import {
  archiveRawItems,
  syncPacksToPrisma,
  upsertSourcesBatch,
  recordSourcesSuccessBatch,
  getArchiveStats,
} from "../../archive/upsert-prisma";
import { getItemsToEnrich, enrichItems } from "../../archive/enrich-prisma";
import { createAiClient, loadSettings } from "../../ai/providers";

export interface ArchiveOptions {
  concurrency?: number;
  packDir?: string;
  enrichMode?: "new" | "backfill" | "force";
}

export async function archiveCollectCommand(
  packIds: string[],
  options: ArchiveOptions = {},
): Promise<void> {
  const packDir = options.packDir || "config/packs";
  const enrichMode = options.enrichMode ?? "new";

  console.log(`Connecting to Supabase database...`);
  console.log(`Loading packs from: ${packDir}`);
  const packs = await loadAllPacks(packDir);

  // ... 现有的 pack 和 source 同步逻辑 ...

  // 抓取
  const items = await collectSources(selection.sources, dependencies);
  console.log(`\nCollected ${items.length} items in ${Date.now() - startTime}ms`);

  // 归档到 Supabase（基础字段）
  const now = new Date().toISOString();
  const result = await archiveRawItems(items, now);

  console.log(`Archived: ${result.newCount} new, ${result.updateCount} updated`);

  // AI 增强
  const settings = loadSettings("config/settings.yaml");
  const aiClient = createAiClient(settings);

  // 确定需要增强的 Item
  const newItemIds = items.filter((i) => !existingIdSet.has(i.id)).map((i) => i.id);
  const enrichItemIds = await getItemsToEnrich(enrichMode, newItemIds);

  if (enrichItemIds.length > 0) {
    console.log(`\nEnriching ${enrichItemIds.length} items with AI...`);
    const enrichResult = await enrichItems(enrichItemIds, aiClient);
    console.log(`Enriched: ${enrichResult.successCount} success, ${enrichResult.failCount} failed`);
  }

  // 更新数据源健康状态
  // ... 现有逻辑 ...

  console.log(`Done!`);
}
```

**Step 2: 验证编译**

Run: `pnpm build`
Expected: 编译通过

**Step 3: Commit**

```bash
git add src/cli/commands/archive.ts
git commit -m "feat: add AI enrichment to archive collect command"
```

---

## Task 10: 端到端测试

**Step 1: 测试 archive collect**

Run: `pnpm archive collect --help`
Expected: 显示帮助信息

**Step 2: 测试 daily generate**

Run: `pnpm daily generate --help`
Expected: 显示帮助信息

**Step 3: 测试 weekly generate**

Run: `pnpm weekly generate --help`
Expected: 显示帮助信息

**Step 4: 实际运行测试**

```bash
# 抓取数据（小规模测试）
pnpm archive collect tech-news

# 生成日报
pnpm daily generate

# 生成周报
pnpm weekly generate
```

**Step 5: 验证数据库**

检查 Supabase 中的数据：
- Item 表：summary, bullets, categories, score 字段已填充
- DailyOverview 表：有当天记录
- WeeklyReport 表：有本周记录

---

## Task 11: 最终提交

**Step 1: 确保所有测试通过**

Run: `pnpm build && pnpm lint`
Expected: 全部通过

**Step 2: 提交所有更改**

```bash
git add -A
git commit -m "feat: complete AI enhancement and report generation pipeline"
```

**Step 3: 推送到远程**

```bash
git push origin main
```
