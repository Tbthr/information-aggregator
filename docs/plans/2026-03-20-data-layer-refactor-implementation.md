# 数据层改造实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 改造数据爬取、解析、AI 增强逻辑，以及后端 API 接口，满足前端展示需求

**Architecture:** 数据获取与视图分离，日报/周报由定时任务预生成，API 只负责读取。配置驱动行为，AI 增强统一 prompt。

**Tech Stack:** Prisma, Next.js API Routes, YAML configs, TypeScript

---

## Task 1: 创建配置文件目录和 schema 定义

**Files:**
- Create: `config/scheduler.yaml`
- Create: `config/reports/daily.yaml`
- Create: `config/reports/weekly.yaml`
- Create: `src/config/load-scheduler.ts`
- Create: `src/config/reports-schema.ts`

**Step 1: 创建 scheduler.yaml**

```yaml
# config/scheduler.yaml
scheduler:
  jobs:
    fetch-and-process:
      cron: "0 */30 * * * *"
      description: "获取所有 enabled sources 数据，处理并持久化"
      enabled: true

    daily-report:
      cron: "0 30 6 * * *"
      description: "根据 daily.yaml 配置生成日报"
      enabled: true

    weekly-report:
      cron: "0 0 7 * * 1"
      description: "根据 weekly.yaml 配置生成周报"
      enabled: true
```

**Step 2: 创建 reports/daily.yaml**

```yaml
# config/reports/daily.yaml
daily:
  packs: all

  maxItems: 20
  maxSpotlight: 3

  sort: ranked

  enableOverview: true

  newsFlashes:
    enabled: true
    maxCount: 12
```

**Step 3: 创建 reports/weekly.yaml**

```yaml
# config/reports/weekly.yaml
weekly:
  days: 7

  maxTimelineEvents: 10
  maxDeepDives: 5

  enableEditorial: true
```

**Step 4: 创建 reports-schema.ts 类型定义**

```typescript
// src/config/reports-schema.ts
export interface DailyReportConfig {
  packs: "all" | string[]
  maxItems: number
  maxSpotlight: number
  sort: "ranked" | "recent"
  enableOverview: boolean
  newsFlashes: {
    enabled: boolean
    maxCount: number
  }
}

export interface WeeklyReportConfig {
  days: number
  maxTimelineEvents: number
  maxDeepDives: 5
  enableEditorial: boolean
}

export interface SchedulerConfig {
  jobs: {
    [key: string]: {
      cron: string
      description: string
      enabled: boolean
    }
  }
}
```

**Step 5: 创建 load-scheduler.ts**

```typescript
// src/config/load-scheduler.ts
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import YAML from "yaml"
import type { SchedulerConfig } from "./reports-schema"

export async function loadSchedulerConfig(): Promise<SchedulerConfig> {
  const path = resolve(process.cwd(), "config/scheduler.yaml")
  const content = await readFile(path, "utf8")
  const parsed = YAML.parse(content) as { scheduler: SchedulerConfig }
  return parsed.scheduler
}
```

**Step 6: Commit**

```bash
git add config/scheduler.yaml config/reports/daily.yaml config/reports/weekly.yaml src/config/load-scheduler.ts src/config/reports-schema.ts
git commit -m "feat: add scheduler and report configs"
```

---

## Task 2: 调整 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 修改 Item 模型**

在 Item 模型中添加/修改字段：

```prisma
model Item {
  id           String   @id @default(cuid())
  title        String
  url          String
  canonicalUrl String
  snippet      String?  @db.Text
  sourceId     String
  sourceName   String                    // 新增
  sourceType   String
  packId       String?
  publishedAt  DateTime?
  fetchedAt    DateTime @default(now())
  author       String?

  // AI 增强字段
  summary      String?  @db.Text
  bullets      String[]
  content      String?  @db.Text
  imageUrl     String?
  categories   String[]                  // 改为数组
  score        Float    @default(5.0)
  scoresJson   String?  @db.Text
  metadataJson String?  @db.Text

  source       Source     @relation(fields: [sourceId], references: [id])
  bookmarks    Bookmark[]
  newsFlashes  NewsFlash[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([sourceId])
  @@index([fetchedAt])
  @@index([score])
}
```

**Step 2: 重命名 SavedItem 为 Bookmark**

```prisma
model Bookmark {
  id            String   @id @default(cuid())
  itemId        String
  bookmarkedAt  DateTime @default(now())

  item          Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId])
}
```

**Step 3: 修改 DailyOverview 添加关联字段**

```prisma
model DailyOverview {
  id           String   @id @default(cuid())
  date         String   @unique
  dayLabel     String
  summary      String   @db.Text

  itemIds      String[]
  spotlightIds String[]

  createdAt    DateTime @default(now())
}
```

**Step 4: 修改 TimelineEvent 添加关联字段**

```prisma
model TimelineEvent {
  id              String   @id @default(cuid())
  weeklyReportId  String
  date            String
  dayLabel        String
  title           String
  summary         String   @db.Text
  order           Int      @default(0)

  itemIds         String[]

  weeklyReport    WeeklyReport @relation(fields: [weeklyReportId], references: [id], onDelete: Cascade)

  @@index([weeklyReportId])
}
```

**Step 5: 修改 NewsFlash 添加 dailyDate**

```prisma
model NewsFlash {
  id        String   @id @default(cuid())
  time      String
  text      String   @db.Text
  itemId    String?
  dailyDate String?

  item      Item?    @relation(fields: [itemId], references: [id])

  createdAt DateTime @default(now())
}
```

**Step 6: 更新 Item 的 newsFlashes 关联**

确保 Item 模型中有：
```prisma
  newsFlashes  NewsFlash[]
```

**Step 7: 生成迁移**

```bash
npx prisma migrate dev --name refactor-data-layer
```

**Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: update prisma schema for data layer refactor"
```

---

## Task 3: 实现 AI 增强统一 Prompt

**Files:**
- Modify: `src/ai/prompts-enrichment.ts`
- Modify: `src/ai/types.ts`

**Step 1: 更新 AI 类型定义**

在 `src/ai/types.ts` 添加：

```typescript
// 统一 AI 增强输出
export interface UnifiedEnrichmentResult {
  summary: string
  bullets: string[]
  categories: string[]
}
```

**Step 2: 修改 buildComprehensiveEnrichmentPrompt**

修改 `src/ai/prompts-enrichment.ts` 中的 `buildComprehensiveEnrichmentPrompt` 函数：

```typescript
export function buildComprehensiveEnrichmentPrompt(
  title: string,
  content: string,
): string {
  const truncatedContent = content.length > 4000
    ? content.slice(0, 4000) + "..."
    : content;

  return `请分析以下文章，生成结构化的增强数据。

## 输入
标题：${title}
正文：${truncatedContent}

## 输出要求
请以 JSON 格式输出，包含以下字段：

1. **summary** (string): 100-150字概述，提炼核心观点
2. **bullets** (string[]): 3-5个核心要点，每个不超过50字
3. **categories** (string[]): 1-3个最合适的分类标签，自行判断

## 输出格式
\`\`\`json
{
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "categories": ["...", "..."]
}
\`\`\`

只输出 JSON，不要其他内容。`;
}
```

**Step 3: Commit**

```bash
git add src/ai/prompts-enrichment.ts src/ai/types.ts
git commit -m "feat: unify AI enrichment prompt"
```

---

## Task 4: 改造 `/api/items` 返回完整字段

**Files:**
- Modify: `app/app/api/items/_lib.ts`
- Modify: `app/app/api/items/types.ts`

**Step 1: 更新 ItemData 类型**

修改 `app/app/api/items/types.ts`：

```typescript
export interface ItemData {
  id: string
  title: string
  url: string
  canonicalUrl: string
  source: {
    id: string
    type: string
    packId: string
  }
  publishedAt: string | null
  fetchedAt: string
  firstSeenAt: string
  lastSeenAt: string
  snippet: string | null
  author: string | null
  score: number
  scores: ItemScores
  saved?: {
    savedAt: string
  }
  metadata: Record<string, unknown>

  // 新增字段
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  sourceName: string
  isBookmarked: boolean
}
```

**Step 2: 更新 serializeItem 函数**

修改 `app/app/api/items/_lib.ts` 中的 `serializeItem`：

```typescript
function serializeItem(item: ItemRecord): ItemData {
  const bookmarkedAt = item.bookmarks[0]?.bookmarkedAt?.toISOString()
  const metadata = parseJson<Record<string, unknown>>(item.metadataJson, {})
  const scores = parseJson<Partial<ItemData["scores"]>>(item.scoresJson, {
    sourceWeight: 1,
    freshness: 0.5,
    engagement: 0.5,
    contentQuality: 0.5,
  })

  return {
    id: item.id,
    title: item.title,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    source: {
      id: item.sourceId,
      type: item.sourceType || item.source.type || "unknown",
      packId: item.packId ?? item.source.packId ?? "unknown",
    },
    sourceName: item.sourceName || item.source.name || item.sourceType,
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    fetchedAt: item.fetchedAt.toISOString(),
    firstSeenAt: item.fetchedAt.toISOString(),
    lastSeenAt: item.fetchedAt.toISOString(),
    snippet: item.snippet ?? null,
    author: item.author ?? null,
    score: item.score,
    scores: {
      sourceWeight: toNumber(scores.sourceWeight, 0),
      freshness: toNumber(scores.freshness, 0),
      engagement: toNumber(scores.engagement, 0),
      contentQuality: toNumber(scores.contentQuality, 0),
    },
    isBookmarked: !!bookmarkedAt,
    saved: bookmarkedAt ? { savedAt: bookmarkedAt } : undefined,
    metadata,
    // 新增字段
    summary: item.summary ?? null,
    bullets: item.bullets ?? [],
    content: item.content ?? null,
    imageUrl: item.imageUrl ?? null,
    categories: item.categories ?? [],
  }
}
```

**Step 3: 更新 itemInclude 包含 bookmarks**

```typescript
const itemInclude = {
  source: {
    include: {
      pack: true,
    },
  },
  bookmarks: {
    select: {
      bookmarkedAt: true,
    },
  },
} as const
```

**Step 4: Commit**

```bash
git add app/app/api/items/_lib.ts app/app/api/items/types.ts
git commit -m "feat: extend ItemData with AI enrichment fields"
```

---

## Task 5: 重命名收藏接口 `/api/bookmarks`

**Files:**
- Create: `app/app/api/bookmarks/route.ts`
- Create: `app/app/api/bookmarks/[id]/route.ts`
- Modify: `app/app/api/items/_lib.ts`
- Delete: `app/app/api/items/saved/route.ts`
- Delete: `app/app/api/items/[id]/save/route.ts`

**Step 1: 创建 `/api/bookmarks` GET 路由**

```typescript
// app/app/api/bookmarks/route.ts
import { NextResponse } from "next/server"

import { getBookmarks } from "../items/_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { items, total } = await getBookmarks()

  return NextResponse.json({
    success: true,
    data: {
      items,
      meta: {
        total,
      },
    },
  })
}
```

**Step 2: 创建 `/api/bookmarks/[id]` 路由**

```typescript
// app/app/api/bookmarks/[id]/route.ts
import { NextResponse } from "next/server"

import { addBookmark, removeBookmark } from "../items/_lib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const result = await addBookmark(id)

  if (!result) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: result })
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const deleted = await removeBookmark(id)

  if (!deleted) {
    return NextResponse.json({ success: false, error: "Item not bookmarked" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { bookmarkedAt: null } })
}
```

**Step 3: 在 _lib.ts 中重命名函数**

```typescript
// 重命名 getSavedItems -> getBookmarks
export async function getBookmarks(): Promise<SavedItemsData> {
  const rows = await prisma.bookmark.findMany({
    include: {
      item: {
        include: itemInclude,
      },
    },
    orderBy: {
      bookmarkedAt: "desc",
    },
  })

  return {
    items: rows.map((row) => serializeItem(row.item)),
    total: rows.length,
  }
}

// 重命名 saveItemById -> addBookmark
export async function addBookmark(id: string): Promise<{ bookmarkedAt: string; already?: true } | null> {
  const existingItem = await prisma.item.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existingItem) {
    return null
  }

  const existingBookmark = await prisma.bookmark.findUnique({
    where: { itemId: id },
    select: { bookmarkedAt: true },
  })

  if (existingBookmark) {
    return { bookmarkedAt: existingBookmark.bookmarkedAt.toISOString(), already: true }
  }

  const created = await prisma.bookmark.upsert({
    where: { itemId: id },
    create: { itemId: id },
    update: {},
    select: { bookmarkedAt: true },
  })

  return { bookmarkedAt: created.bookmarkedAt.toISOString() }
}

// 重命名 deleteSavedItemById -> removeBookmark
export async function removeBookmark(id: string): Promise<boolean> {
  const result = await prisma.bookmark.deleteMany({
    where: { itemId: id },
  })

  return result.count > 0
}
```

**Step 4: 删除旧路由**

```bash
rm -rf app/app/api/items/saved
rm -rf app/app/api/items/[id]/save
```

**Step 5: Commit**

```bash
git add app/app/api/bookmarks/ app/app/api/items/_lib.ts
git add -A  # 包含删除的文件
git commit -m "refactor: rename saved items to bookmarks"
```

---

## Task 6: 简化 `/api/daily` 为纯查询

**Files:**
- Modify: `app/app/api/daily/route.ts`

**Step 1: 重写 daily 路由**

```typescript
// app/app/api/daily/route.ts
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toArticle(item: {
  id: string
  title: string
  sourceName: string
  url: string
  publishedAt: Date | null
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  score: number
}) {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName,
    sourceUrl: item.url,
    publishedAt: item.publishedAt?.toISOString() ?? "",
    summary: item.summary ?? "",
    bullets: item.bullets,
    content: item.content ?? "",
    imageUrl: item.imageUrl ?? undefined,
    category: item.categories[0] ?? undefined,
    aiScore: item.score,
  }
}

export async function GET() {
  const startTime = Date.now()

  const overview = await prisma.dailyOverview.findFirst({
    orderBy: { date: "desc" },
  })

  if (!overview) {
    return NextResponse.json(
      { success: false, error: "No daily data available" },
      { status: 404 }
    )
  }

  // 查询关联的 items
  const allItemIds = [...overview.spotlightIds, ...overview.itemIds]
  const items = await prisma.item.findMany({
    where: { id: { in: allItemIds } },
  })

  const itemMap = new Map(items.map((i) => [i.id, i]))
  const spotlightArticles = overview.spotlightIds
    .map((id) => itemMap.get(id))
    .filter(Boolean)
    .map(toArticle)
  const recommendedArticles = overview.itemIds
    .filter((id) => !overview.spotlightIds.includes(id))
    .map((id) => itemMap.get(id))
    .filter(Boolean)
    .map(toArticle)

  // 查询快讯
  const newsFlashes = await prisma.newsFlash.findMany({
    where: { dailyDate: overview.date },
    orderBy: [{ createdAt: "desc" }, { time: "desc" }],
    take: 12,
  })

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        date: overview.date,
        summary: overview.summary,
      },
      spotlightArticles,
      recommendedArticles,
      newsFlashes: newsFlashes.map((f) => ({
        id: f.id,
        time: f.time,
        text: f.text,
      })),
    },
    meta: {
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
    },
  })
}
```

**Step 2: Commit**

```bash
git add app/app/api/daily/route.ts
git commit -m "refactor: simplify daily API to read-only from database"
```

---

## Task 7: 简化 `/api/weekly` 为纯查询

**Files:**
- Modify: `app/app/api/weekly/route.ts`

**Step 1: 重写 weekly 路由**

```typescript
// app/app/api/weekly/route.ts
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toArticle(item: {
  id: string
  title: string
  sourceName: string
  url: string
  publishedAt: Date | null
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  score: number
}) {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName,
    sourceUrl: item.url,
    publishedAt: item.publishedAt?.toISOString() ?? "",
    summary: item.summary ?? "",
    bullets: item.bullets,
    content: item.content ?? "",
    imageUrl: item.imageUrl ?? undefined,
    category: item.categories[0] ?? undefined,
    aiScore: item.score,
  }
}

export async function GET() {
  const startTime = Date.now()

  const report = await prisma.weeklyReport.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      timelineEvents: {
        orderBy: { order: "asc" },
      },
    },
  })

  if (!report) {
    return NextResponse.json(
      { success: false, error: "No weekly data available" },
      { status: 404 }
    )
  }

  // 收集所有 timeline events 的 itemIds
  const allItemIds = report.timelineEvents.flatMap((e) => e.itemIds)
  const items = await prisma.item.findMany({
    where: { id: { in: allItemIds } },
  })
  const itemMap = new Map(items.map((i) => [i.id, i]))

  // 按评分排序获取 deep dives
  const sortedItems = items.sort((a, b) => b.score - a.score).slice(0, 5)
  const deepDives = sortedItems.map(toArticle)

  return NextResponse.json({
    success: true,
    data: {
      hero: {
        weekNumber: report.weekNumber,
        headline: report.headline,
        subheadline: report.subheadline ?? "",
        editorial: report.editorial ?? "",
      },
      timelineEvents: report.timelineEvents.map((e) => ({
        id: e.id,
        date: e.date,
        dayLabel: e.dayLabel,
        title: e.title,
        summary: e.summary,
        itemIds: e.itemIds,
      })),
      deepDives,
    },
    meta: {
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
    },
  })
}
```

**Step 2: Commit**

```bash
git add app/app/api/weekly/route.ts
git commit -m "refactor: simplify weekly API to read-only from database"
```

---

## Task 8: 实现定时任务调度器

**Files:**
- Create: `src/scheduler/index.ts`
- Create: `src/scheduler/types.ts`
- Create: `src/scheduler/runner.ts`

**Step 1: 创建类型定义**

```typescript
// src/scheduler/types.ts
export type JobHandler = () => Promise<void>

export interface JobConfig {
  cron: string
  description: string
  enabled: boolean
  handler: JobHandler
}

export interface SchedulerState {
  lastRun: Record<string, string>
}
```

**Step 2: 创建调度器核心**

```typescript
// src/scheduler/runner.ts
import { CronJob } from "cron"
import type { JobConfig } from "./types"
import { createLogger } from "../utils/logger"

const logger = createLogger("scheduler")

const jobs = new Map<string, CronJob>()

export function registerJob(name: string, config: JobConfig): void {
  if (!config.enabled) {
    logger.info(`Job ${name} is disabled, skipping`)
    return
  }

  const job = new CronJob(
    config.cron,
    async () => {
      logger.info(`Running job: ${name}`, { description: config.description })
      try {
        const start = Date.now()
        await config.handler()
        logger.info(`Job ${name} completed`, { durationMs: Date.now() - start })
      } catch (error) {
        logger.error(`Job ${name} failed`, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    null,
    false,
    "Asia/Shanghai"
  )

  jobs.set(name, job)
  logger.info(`Registered job: ${name}`, { cron: config.cron })
}

export function startScheduler(): void {
  logger.info("Starting scheduler")
  for (const [name, job] of jobs) {
    job.start()
    logger.info(`Started job: ${name}`)
  }
}

export function stopScheduler(): void {
  logger.info("Stopping scheduler")
  for (const [name, job] of jobs) {
    job.stop()
    logger.info(`Stopped job: ${name}`)
  }
}
```

**Step 3: 创建入口文件**

```typescript
// src/scheduler/index.ts
export * from "./types"
export * from "./runner"
```

**Step 4: Commit**

```bash
git add src/scheduler/
git commit -m "feat: add scheduler module"
```

---

## Task 9: 实现日报生成任务

**Files:**
- Create: `src/scheduler/jobs/daily-report.ts`

**Step 1: 创建日报生成任务**

```typescript
// src/scheduler/jobs/daily-report.ts
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import YAML from "yaml"
import type { JobHandler } from "../types"
import { prisma } from "@/lib/prisma"
import { createAiClient } from "../../ai/providers"
import { buildDailyBriefOverviewPrompt } from "../../ai/prompts-daily-brief"
import { createLogger } from "../../utils/logger"

const logger = createLogger("jobs:daily-report")

interface DailyConfig {
  packs: "all" | string[]
  maxItems: number
  maxSpotlight: number
  sort: "ranked" | "recent"
  enableOverview: boolean
}

async function loadDailyConfig(): Promise<DailyConfig> {
  const path = resolve(process.cwd(), "config/reports/daily.yaml")
  const content = await readFile(path, "utf8")
  const parsed = YAML.parse(content) as { daily: DailyConfig }
  return parsed.daily
}

export const dailyReportJob: JobHandler = async () => {
  const config = await loadDailyConfig()
  const today = new Date()
  const dateStr = today.toISOString().split("T")[0]
  const dayLabel = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()]

  logger.info("Generating daily report", { date: dateStr, config })

  // 检查是否已存在
  const existing = await prisma.dailyOverview.findUnique({
    where: { date: dateStr },
  })

  if (existing) {
    logger.info("Daily report already exists", { date: dateStr })
    return
  }

  // 查询 items
  const packFilter = config.packs === "all" ? {} : { packId: { in: config.packs } }
  const since = new Date(today)
  since.setHours(0, 0, 0, 0)

  const items = await prisma.item.findMany({
    where: {
      ...packFilter,
      fetchedAt: { gte: since },
    },
    orderBy: config.sort === "ranked"
      ? [{ score: "desc" }, { fetchedAt: "desc" }]
      : [{ fetchedAt: "desc" }],
    take: config.maxItems,
  })

  if (items.length === 0) {
    logger.warn("No items found for daily report")
    return
  }

  // 分离 spotlight
  const spotlightIds = items.slice(0, config.maxSpotlight).map((i) => i.id)
  const itemIds = items.map((i) => i.id)

  // 生成概述
  let summary = ""
  if (config.enableOverview) {
    const aiClient = await createAiClient()
    if (aiClient) {
      const titles = items.slice(0, 10).map((i) => i.title).join("\n")
      const prompt = buildDailyBriefOverviewPrompt(titles, dateStr)
      summary = await aiClient.generateText(prompt)
    }
  }

  // 保存日报
  await prisma.dailyOverview.create({
    data: {
      date: dateStr,
      dayLabel,
      summary,
      itemIds,
      spotlightIds,
    },
  })

  logger.info("Daily report created", { date: dateStr, itemCount: items.length })
}
```

**Step 2: Commit**

```bash
git add src/scheduler/jobs/daily-report.ts
git commit -m "feat: add daily report generation job"
```

---

## Task 10: 实现周报生成任务

**Files:**
- Create: `src/scheduler/jobs/weekly-report.ts`

**Step 1: 创建周报生成任务**

```typescript
// src/scheduler/jobs/weekly-report.ts
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import YAML from "yaml"
import type { JobHandler } from "../types"
import { prisma } from "@/lib/prisma"
import { createAiClient } from "../../ai/providers"
import { createLogger } from "../../utils/logger"

const logger = createLogger("jobs:weekly-report")

interface WeeklyConfig {
  days: number
  maxTimelineEvents: number
  maxDeepDives: number
  enableEditorial: boolean
}

async function loadWeeklyConfig(): Promise<WeeklyConfig> {
  const path = resolve(process.cwd(), "config/reports/weekly.yaml")
  const content = await readFile(path, "utf8")
  const parsed = YAML.parse(content) as { weekly: WeeklyConfig }
  return parsed.weekly
}

export const weeklyReportJob: JobHandler = async () => {
  const config = await loadWeeklyConfig()
  const today = new Date()

  // 检查今天是否是周一
  if (today.getDay() !== 1) {
    logger.info("Not Monday, skipping weekly report")
    return
  }

  // 计算周数
  const startOfYear = new Date(today.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(
    ((today.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )
  const weekStr = `Week ${weekNumber}`

  // 检查是否已存在
  const existing = await prisma.weeklyReport.findFirst({
    where: { weekNumber: weekStr },
  })

  if (existing) {
    logger.info("Weekly report already exists", { weekNumber: weekStr })
    return
  }

  logger.info("Generating weekly report", { weekNumber: weekStr, config })

  // 查询过去7天的日报
  const since = new Date(today)
  since.setDate(since.getDate() - config.days)

  const dailyOverviews = await prisma.dailyOverview.findMany({
    where: { date: { gte: since.toISOString().split("T")[0] } },
    orderBy: { date: "asc" },
  })

  if (dailyOverviews.length === 0) {
    logger.warn("No daily overviews found for weekly report")
    return
  }

  // 收集所有 itemIds
  const allItemIds = new Set<string>()
  for (const daily of dailyOverviews) {
    daily.itemIds.forEach((id) => allItemIds.add(id))
  }

  // 查询 items
  const items = await prisma.item.findMany({
    where: { id: { in: Array.from(allItemIds) } },
    orderBy: { score: "desc" },
  })

  // 生成 timeline events
  const timelineEvents = dailyOverviews.slice(0, config.maxTimelineEvents).map((daily, index) => {
    const dailyItems = items.filter((i) => daily.itemIds.includes(i.id))
    const topItem = dailyItems[0]

    return {
      date: daily.date.slice(5).replace("-", "/"),
      dayLabel: daily.dayLabel,
      title: topItem?.title ?? "无重大事件",
      summary: daily.summary.slice(0, 100),
      order: index,
      itemIds: daily.spotlightIds.length > 0 ? daily.spotlightIds : daily.itemIds.slice(0, 3),
    }
  })

  // 生成 editorial
  let editorial = ""
  if (config.enableEditorial) {
    const aiClient = await createAiClient()
    if (aiClient) {
      const summaries = dailyOverviews.map((d) => d.summary).join("\n\n")
      const prompt = `基于以下7天的日报概述，生成一段周报社论（200-300字），总结本周科技领域的主要趋势和亮点：

${summaries}

只输出社论内容，不要其他内容。`
      editorial = await aiClient.generateText(prompt)
    }
  }

  // 生成 headline
  const aiClient = await createAiClient()
  let headline = `${today.getFullYear()}年${today.getMonth() + 1}月第${Math.ceil(today.getDate() / 7)}周`
  if (aiClient) {
    const prompt = `基于以下标题，生成一个简短的周报标题（5-10字）：

${items.slice(0, 5).map((i) => i.title).join("\n")}

只输出标题，不要其他内容。`
    headline = await aiClient.generateText(prompt)
  }

  // 保存周报
  const report = await prisma.weeklyReport.create({
    data: {
      weekNumber: weekStr,
      headline,
      subheadline: `${today.getFullYear()}年${today.getMonth() + 1}月第${Math.ceil(today.getDate() / 7)}周 · ${since.toISOString().split("T")[0]} — ${today.toISOString().split("T")[0]}`,
      editorial,
    },
  })

  // 保存 timeline events
  await prisma.timelineEvent.createMany({
    data: timelineEvents.map((e) => ({
      ...e,
      weeklyReportId: report.id,
    })),
  })

  logger.info("Weekly report created", { weekNumber: weekStr, eventCount: timelineEvents.length })
}
```

**Step 2: Commit**

```bash
git add src/scheduler/jobs/weekly-report.ts
git commit -m "feat: add weekly report generation job"
```

---

## Task 11: 前端适配新 API 字段

**Files:**
- Modify: `app/lib/api-client.ts`
- Modify: `app/lib/types.ts`

**Step 1: 更新 Article 类型**

```typescript
// app/lib/types.ts
export type Article = {
  id: string
  title: string
  source: string
  sourceUrl: string
  publishedAt: string
  summary: string
  bullets: string[]
  content: string
  imageUrl?: string
  category?: string
  aiScore?: number
  isBookmarked?: boolean  // 改名
}
```

**Step 2: 更新 mapItemToArticle**

```typescript
// app/lib/api-client.ts
export function mapItemToArticle(item: ItemData): Article {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName || item.source.type,
    sourceUrl: item.canonicalUrl || item.url,
    publishedAt: item.publishedAt || item.fetchedAt,
    summary: item.summary || item.snippet || "",
    bullets: item.bullets || [],
    content: item.content || "",
    imageUrl: item.imageUrl ?? undefined,
    category: item.categories?.[0] ?? undefined,
    aiScore: item.score,
    isBookmarked: item.isBookmarked,
  }
}
```

**Step 3: 更新收藏相关 API 调用**

```typescript
// app/lib/api-client.ts

// 更新 fetchSavedItems
export async function fetchBookmarks(): Promise<Article[]> {
  const response = await fetchApi<SavedItemsData>("/api/bookmarks")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.items.map(mapItemToArticle)
}

// 更新 saveItem
export async function addBookmark(id: string): Promise<{ success: boolean; bookmarkedAt?: string }> {
  const response = await fetchApi<{ bookmarkedAt: string }>(`/api/bookmarks/${id}`, {
    method: "POST",
  })

  return {
    success: response.success,
    bookmarkedAt: response.data?.bookmarkedAt,
  }
}

// 更新 unsaveItem
export async function removeBookmark(id: string): Promise<{ success: boolean }> {
  const response = await fetchApi<unknown>(`/api/bookmarks/${id}`, {
    method: "DELETE",
  })

  return {
    success: response.success,
  }
}
```

**Step 4: Commit**

```bash
git add app/lib/api-client.ts app/lib/types.ts
git commit -m "feat: adapt frontend to new API fields and bookmark naming"
```

---

## 执行顺序

1. Task 1: 配置文件 (无依赖)
2. Task 2: Prisma Schema (无依赖)
3. Task 3: AI Prompt (无依赖)
4. Task 4: `/api/items` (依赖 Task 2)
5. Task 5: `/api/bookmarks` (依赖 Task 2, Task 4)
6. Task 6: `/api/daily` (依赖 Task 2)
7. Task 7: `/api/weekly` (依赖 Task 2)
8. Task 8: 调度器 (无依赖)
9. Task 9: 日报任务 (依赖 Task 1, Task 3, Task 8)
10. Task 10: 周报任务 (依赖 Task 1, Task 3, Task 8, Task 9)
11. Task 11: 前端适配 (依赖 Task 4, Task 5, Task 6, Task 7)

---

## 注意事项

1. **数据库迁移** - Task 2 会生成迁移文件，需要确保迁移正确执行
2. **Mock 数据移除** - Task 6, 7 会移除对 mock-data.ts 的依赖
3. **向后兼容** - 前端 Task 11 需要在所有 API 改造完成后进行
4. **定时任务依赖** - Task 9, 10 需要 cron 库，确保安装
