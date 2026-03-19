# 全栈重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 一次性完成目录重构、数据层改造、文档更新

**Architecture:** Next.js 16 App Router → 根目录 app/，数据层 Prisma + Supabase，移除 mock，重写文档

**Tech Stack:** Next.js 16, Prisma, Supabase, pnpm, TypeScript

---

## Phase 1: 目录结构重构

### Task 1.1: 更新 tsconfig.json paths

**Files:**
- Modify: `tsconfig.json`

**Step 1: 更新 paths 配置**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Step 2: 验证 TypeScript**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add tsconfig.json && git commit -m "chore: update tsconfig paths for root-level imports"
```

---

### Task 1.2: 移动 app/app/* 到 app/

**Files:**
- Move: `app/app/api/` → `app/api/`
- Move: `app/app/layout.tsx` → `app/layout.tsx`
- Move: `app/app/page.tsx` → `app/page.tsx`
- Move: `app/app/globals.css` → `app/globals.css`
- Delete: `app/app/` 目录

**Step 1: 移动文件**

```bash
mv app/app/api app/api
mv app/app/layout.tsx app/layout.tsx
mv app/app/page.tsx app/page.tsx
mv app/app/globals.css app/globals.css
rmdir app/app
```

**Step 2: 验证构建**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor: move Next.js App Router to root app/ directory"
```

---

### Task 1.3: 移动 components, hooks, lib 到根目录

**Files:**
- Move: `app/components/` → `components/`
- Move: `app/hooks/` → `hooks/`
- Move: `app/lib/` → `lib/`

**Step 1: 移动目录**

```bash
mv app/components components
mv app/hooks hooks
mv app/lib lib
rm -rf app/next-env.d.ts app/tsconfig.json 2>/dev/null || true
```

**Step 2: 验证构建**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor: move components, hooks, lib to root level"
```

---

### Task 1.4: 最终目录结构验证

**Files:**
- N/A (验证任务)

**Step 1: 列出最终结构**

```bash
ls -la app/ components/ hooks/ lib/
```

**Step 2: 完整构建验证**

```bash
pnpm build
```

**Step 3: Commit (如有清理)**

```bash
git add -A && git commit -m "chore: cleanup after directory restructure" || echo "Clean"
```

---

## Phase 2: 数据层改造

### Task 2.1: 创建配置文件目录和 schema 定义

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

**Step 4: 创建类型定义**

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
  maxDeepDives: number
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

**Step 5: 创建配置加载器**

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

### Task 2.2: 调整 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 修改 Item 模型**

在 Item 模型中添加/修改字段：

```prisma
/// 内容条目表 - 存储所有抓取的内容
model Item {
  id           String   @id @default(cuid())    // 主键，CUID 格式
  title        String                          // 文章标题
  url          String                          // 原始 URL
  canonicalUrl String                          // 规范化 URL（去重用）
  snippet      String?  @db.Text               // 原始摘要片段（来自 RSS/爬取）
  sourceId     String                          // 关联的来源 ID
  sourceName   String                          // 来源显示名（如 "TechCrunch"）
  sourceType   String                          // 来源类型（rss/json-feed/x-home 等）
  packId       String?                         // 所属 Pack ID（可选）
  publishedAt  DateTime?                       // 文章发布时间
  fetchedAt    DateTime @default(now())        // 抓取时间
  author       String?                         // 作者名称

  // === AI 增强字段 ===
  summary      String?  @db.Text               // AI 生成的 100-150 字概述
  bullets      String[]                        // AI 生成的 3-5 个核心要点
  content      String?  @db.Text               // 提取的完整正文内容
  imageUrl     String?                         // 封面图片 URL
  categories   String[]                        // AI 生成的分类标签
  score        Float   @default(5.0)           // 综合评分（1-10）
  scoresJson   String?  @db.Text               // 评分明细 JSON（各维度分数）
  metadataJson String?  @db.Text               // 原始元数据 JSON

  // === 关联关系 ===
  source       Source      @relation(fields: [sourceId], references: [id])
  bookmarks    Bookmark[]                        // 被收藏记录
  newsFlashes  NewsFlash[]                       // 关联的快讯

  createdAt    DateTime @default(now())       // 记录创建时间
  updatedAt    DateTime @updatedAt            // 记录更新时间

  @@index([sourceId])                         // 按来源查询优化
  @@index([fetchedAt])                        // 按抓取时间查询优化
  @@index([score])                            // 按评分排序优化
}
```

**Step 2: 重命名 SavedItem 为 Bookmark**

```prisma
/// 收藏表 - 用户收藏的内容
model Bookmark {
  id            String   @id @default(cuid())
  itemId        String                          // 关联的内容条目 ID
  bookmarkedAt  DateTime @default(now())        // 收藏时间

  item          Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId])                            // 每个条目只能收藏一次
}
```

**Step 3: 修改 DailyOverview 添加关联字段**

```prisma
/// 日报概述表 - 每日生成的日报
model DailyOverview {
  id           String   @id @default(cuid())
  date         String   @unique               // 日期（如 "2026-03-20"）
  dayLabel     String                          // 星期显示（如 "星期四"）
  summary      String   @db.Text              // AI 生成的日报概述

  itemIds      String[]                        // 当天日报包含的条目 ID 列表
  spotlightIds String[]                        // 精选/置顶的条目 ID 列表

  createdAt    DateTime @default(now())
}
```

**Step 4: 修改 TimelineEvent 添加关联字段**

```prisma
/// 时间线事件表 - 周报中的每日事件
model TimelineEvent {
  id              String   @id @default(cuid())
  weeklyReportId  String                          // 所属周报 ID
  date            String                          // 日期（如 "03/20"）
  dayLabel        String                          // 星期（如 "周四"）
  title           String                          // 事件标题
  summary         String   @db.Text              // 事件摘要
  order           Int      @default(0)           // 排序顺序

  itemIds         String[]                        // 关联的条目 ID 列表

  weeklyReport    WeeklyReport @relation(fields: [weeklyReportId], references: [id], onDelete: Cascade)

  @@index([weeklyReportId])                     // 按周报查询优化
}
```

**Step 5: 修改 NewsFlash 添加 dailyDate**

```prisma
/// 快讯表 - 短消息/快讯
model NewsFlash {
  id        String   @id @default(cuid())
  time      String                          // 显示时间（如 "09:30"）
  text      String   @db.Text               // 快讯内容
  itemId    String?                         // 关联的内容条目 ID（可选）
  dailyDate String?                         // 关联的日报日期（如 "2026-03-20"）

  item      Item?    @relation(fields: [itemId], references: [id])

  createdAt DateTime @default(now())
}
```

**Step 6: 生成迁移**

```bash
npx prisma migrate dev --name refactor-data-layer
```

**Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: update prisma schema for data layer refactor"
```

---

### Task 2.3: 实现 AI 增强统一 Prompt

**Files:**
- Modify: `src/ai/prompts-enrichment.ts`
- Modify: `src/ai/types.ts`

**Step 1: 更新 AI 类型定义**

```typescript
// src/ai/types.ts
export interface UnifiedEnrichmentResult {
  summary: string
  bullets: string[]
  categories: string[]
}
```

**Step 2: 修改 buildComprehensiveEnrichmentPrompt**

```typescript
// src/ai/prompts-enrichment.ts
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

### Task 2.4: 改造 `/api/items` 返回完整字段

**Files:**
- Modify: `app/api/items/_lib.ts`
- Modify: `app/api/items/types.ts`

**Step 1: 更新 ItemData 类型**

```typescript
// app/api/items/types.ts
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

```typescript
// app/api/items/_lib.ts
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
git add app/api/items/_lib.ts app/api/items/types.ts
git commit -m "feat: extend ItemData with AI enrichment fields"
```

---

### Task 2.5: 重命名收藏接口 `/api/bookmarks`

**Files:**
- Create: `app/api/bookmarks/route.ts`
- Create: `app/api/bookmarks/[id]/route.ts`
- Modify: `app/api/items/_lib.ts`
- Delete: `app/api/items/saved/route.ts`
- Delete: `app/api/items/[id]/save/route.ts`

**Step 1: 创建 `/api/bookmarks` GET 路由**

```typescript
// app/api/bookmarks/route.ts
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
// app/api/bookmarks/[id]/route.ts
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
rm -rf app/api/items/saved
rm -rf app/api/items/[id]/save
```

**Step 5: Commit**

```bash
git add app/api/bookmarks/ app/api/items/_lib.ts
git add -A
git commit -m "refactor: rename saved items to bookmarks"
```

---

### Task 2.6: 简化 `/api/daily` 为纯查询

**Files:**
- Modify: `app/api/daily/route.ts`

**Step 1: 重写 daily 路由**

```typescript
// app/api/daily/route.ts
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
  try {
    const startTime = Date.now()

    const overview = await prisma.dailyOverview.findFirst({
      orderBy: { date: "desc" },
    })

    if (!overview) {
      // 无日报数据时，返回空数据（不是 mock）
      const items = await prisma.item.findMany({
        orderBy: [{ score: "desc" }, { fetchedAt: "desc" }],
        take: 6,
      })

      return NextResponse.json({
        success: true,
        data: {
          overview: null,
          spotlightArticles: items.slice(0, 2).map(toArticle),
          recommendedArticles: items.slice(2).map(toArticle),
          newsFlashes: [],
        },
        meta: {
          timing: {
            generatedAt: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
          },
        },
      })
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
  } catch (error) {
    console.error("Error in /api/daily:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load daily data" },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add app/api/daily/route.ts
git commit -m "refactor: simplify daily API to read-only from database"
```

---

### Task 2.7: 简化 `/api/weekly` 为纯查询

**Files:**
- Modify: `app/api/weekly/route.ts`

**Step 1: 重写 weekly 路由**

```typescript
// app/api/weekly/route.ts
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
  try {
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
      // 无周报数据时返回空
      return NextResponse.json({
        success: true,
        data: {
          hero: null,
          timelineEvents: [],
          deepDives: [],
        },
        meta: {
          timing: {
            generatedAt: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
          },
        },
      })
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
  } catch (error) {
    console.error("Error in /api/weekly:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load weekly data" },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add app/api/weekly/route.ts
git commit -m "refactor: simplify weekly API to read-only from database"
```

---

### Task 2.8: 简化 `/api/news-flashes` 为纯查询

**Files:**
- Modify: `app/api/news-flashes/route.ts`

**Step 1: 重写 news-flashes 路由**

```typescript
// app/api/news-flashes/route.ts
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const startTime = Date.now()
    const flashes = await prisma.newsFlash.findMany({
      orderBy: [{ createdAt: "desc" }, { time: "desc" }],
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: {
        newsFlashes: flashes.map((flash) => ({
          id: flash.id,
          time: flash.time,
          text: flash.text,
          itemId: flash.itemId,
        })),
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/news-flashes:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load news flashes" },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add app/api/news-flashes/route.ts
git commit -m "refactor: remove mock fallback from news-flashes API"
```

---

### Task 2.9: 删除 mock-data.ts

**Files:**
- Delete: `lib/mock-data.ts`

**Step 1: 确认无依赖**

```bash
grep -r "mock-data" app/ components/ hooks/ lib/ 2>/dev/null || echo "No mock-data imports found"
```

**Step 2: 删除文件**

```bash
rm lib/mock-data.ts
```

**Step 3: 验证构建**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: remove mock-data.ts"
```

---

### Task 2.10: 前端适配新 API 字段

**Files:**
- Modify: `lib/api-client.ts`
- Modify: `lib/types.ts`

**Step 1: 更新 Article 类型**

```typescript
// lib/types.ts
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
  isBookmarked?: boolean
}
```

**Step 2: 更新 mapItemToArticle**

```typescript
// lib/api-client.ts
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
// lib/api-client.ts

export async function fetchBookmarks(): Promise<Article[]> {
  const response = await fetchApi<SavedItemsData>("/api/bookmarks")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.items.map(mapItemToArticle)
}

export async function addBookmark(id: string): Promise<{ success: boolean; bookmarkedAt?: string }> {
  const response = await fetchApi<{ bookmarkedAt: string }>(`/api/bookmarks/${id}`, {
    method: "POST",
  })

  return {
    success: response.success,
    bookmarkedAt: response.data?.bookmarkedAt,
  }
}

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
git add lib/api-client.ts lib/types.ts
git commit -m "feat: adapt frontend to new API fields and bookmark naming"
```

---

## Phase 3: 文档更新

### Task 3.1: 创建 API 数据格式文档

**Files:**
- Create: `docs/api-data-formats.md`

**Step 1: 创建文档**

```markdown
# API Data Formats Reference

## Common Response Structure

\`\`\`typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    timing?: {
      generatedAt: string
      latencyMs: number
    }
    pagination?: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  }
}
\`\`\`

## Items API

### GET /api/items

Query: `packs`, `sources`, `sourceTypes`, `window`, `page`, `pageSize`, `sort`, `search`

Response: `{ success, data: { items, sources }, meta }`

## Daily API

### GET /api/daily

Response: `{ success, data: { overview, spotlightArticles, recommendedArticles, newsFlashes }, meta }`

## Weekly API

### GET /api/weekly

Response: `{ success, data: { hero, timelineEvents, deepDives }, meta }`

## Bookmarks API

### GET /api/bookmarks
### POST /api/bookmarks/:id
### DELETE /api/bookmarks/:id
```

**Step 2: Commit**

```bash
git add docs/api-data-formats.md && git commit -m "docs: add API data formats reference"
```

---

### Task 3.2: 重写 AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**Step 1: 写入新内容**

```markdown
# AI Agent Guide — Information Aggregator

## Project Overview

Information Aggregator 是一个基于 Next.js 16 的信息聚合平台，通过 Prisma + Supabase 存储数据，提供日报、周报、收藏等功能。

### Tech Stack

- **Frontend**: Next.js 16 App Router, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Prisma ORM, Supabase PostgreSQL
- **Package Manager**: pnpm

### Directory Structure

\`\`\`
information-aggregator/
├── app/              # Next.js App Router
│   ├── api/          # API Routes (/api/*)
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page (/)
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/              # Utilities (api-client, prisma, types)
├── src/              # Backend pipeline code
├── prisma/           # Database schema
└── config/           # YAML configuration files
\`\`\`

## Development Workflow

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build + TypeScript check |
| `pnpm lint` | ESLint check |

### Development Guidelines

1. **Type Safety**: All code must pass TypeScript checks
2. **Component Pattern**: Use shadcn/ui components when available
3. **API Client**: Use `@/lib/api-client` for all API calls

## Testing & Verification

### Build Verification

\`\`\`bash
pnpm build
\`\`\`

Expected: Build succeeds with no errors.

## API Reference

See `docs/api-data-formats.md` for complete API documentation.
```

**Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "docs: rewrite AGENTS.md for current Next.js architecture"
```

---

### Task 3.3: 重写 README.md

**Files:**
- Modify: `README.md`

**Step 1: 写入新内容**

```markdown
# Information Aggregator

一个现代化的信息聚合平台，帮助您高效管理和发现有价值的内容。

## 功能特性

- **日报视图** - 每日精选内容概览
- **周报视图** - 本周热点和深度分析
- **收藏功能** - 保存感兴趣的文章

## 快速开始

### 环境要求

- Node.js 20.19+ 或 22.12+
- pnpm 9+

### 安装

\`\`\`bash
pnpm install
cp .env.example .env
# 编辑 .env 填入数据库连接信息
\`\`\`

### 开发

\`\`\`bash
pnpm dev
\`\`\`

## 技术栈

- [Next.js 16](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Prisma](https://www.prisma.io/)
- [Supabase](https://supabase.com/)

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md && git commit -m "docs: rewrite README.md for users"
```

---

### Task 3.4: 删除 TEST.md

**Files:**
- Delete: `TEST.md`

**Step 1: 删除文件**

```bash
rm TEST.md
```

**Step 2: Commit**

```bash
git add -A && git commit -m "docs: remove TEST.md (content merged into AGENTS.md)"
```

---

## Phase 4: 最终验证

### Task 4.1: 最终构建验证

**Files:**
- N/A

**Step 1: 完整构建**

```bash
pnpm build
```

**Step 2: 验证路由**

```bash
ls .next/server/app/
```

Expected: `api/` directory, `page.js`, `layout.js` at root level

**Step 3: 总结报告**

- 目录重构: `app/app/` → `app/` ✓
- 数据层改造: API 纯真实数据 ✓
- 文档更新: README.md, AGENTS.md, TEST.md 已处理 ✓
- 构建: 通过 ✓

---

## 执行顺序总结

```
Phase 1 (无依赖):
  1.1 → 1.2 → 1.3 → 1.4

Phase 2 (依赖 Phase 1):
  2.1 (config) → 2.2 (schema) → 2.3 (ai) → 2.4 (items API) → 2.5 (bookmarks) → 2.6 (daily) → 2.7 (weekly) → 2.8 (news-flashes) → 2.9 (delete mock) → 2.10 (frontend)

Phase 3 (无依赖):
  3.1 → 3.2 → 3.3 → 3.4

Phase 4:
  4.1 (验证)
```

---

## 注意事项

1. **数据库迁移** — Task 2.2 会生成迁移文件，需要确保迁移正确执行
2. **Mock 数据移除** — Task 2.9 确保所有 API 不再依赖 mock
3. **向后兼容** — 前端 Task 2.10 需要在所有 API 改造完成后进行
4. **定时任务依赖** — 如需启用调度器，需安装 `cron` 库
