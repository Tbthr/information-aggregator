# 日报与周报系统重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将日报/周报从逐条展示改造为 AI 话题聚合摘要系统，支持用户自定义过滤和 prompt 配置。

**Architecture:** 多步骤 AI Pipeline 架构。日报 5 步（收集→过滤→聚类→总结+精选→持久化），周报 3 步（收集→深度总结→精选+持久化）。所有 prompt 可通过设置页面自定义。前端重写日报/周报展示，新增报告设置页面。

**Tech Stack:** Next.js 16 App Router, Prisma ORM, Supabase PostgreSQL, SWR, shadcn/ui, Tailwind CSS

**Spec 文档:** `docs/superpowers/specs/2026-03-22-daily-weekly-report-redesign.md`

---

## 文件结构总览

### 修改的文件

| 文件 | 职责 | 变更内容 |
|------|------|----------|
| `prisma/schema.prisma` | 数据库模型 | 重构 DailyOverview/WeeklyReport/Config 模型，新增 DigestTopic/DailyPick/WeeklyPick，删除 TimelineEvent/NewsFlash |
| `src/ai/prompts-reports.ts` | 报告 AI prompt | 重写所有 prompt 函数，新增话题聚类/总结/精选理由 prompt |
| `src/reports/daily.ts` | 日报生成逻辑 | 重写为 5 步 pipeline |
| `src/reports/weekly.ts` | 周报生成逻辑 | 重写为 3 步 pipeline |
| `app/api/daily/route.ts` | 日报 GET API | 返回 DigestTopic[] + DailyPick[] |
| `app/api/weekly/route.ts` | 周报 GET API | 返回 editorial + WeeklyPick[] |
| `app/api/cron/daily/route.ts` | 日报 cron | 传入 DailyReportConfig |
| `app/api/cron/weekly/route.ts` | 周报 cron | 传入 WeeklyReportConfig，延迟 5 分钟 |
| `hooks/use-api.ts` | 数据获取 hooks | 重写 useDaily，新增 useWeekly、useReportSettings |
| `lib/types.ts` | 前端类型定义 | 更新报告相关类型 |
| `lib/api-client.ts` | API 客户端 | 删除 fetchNewsFlashes，更新报告相关类型 |
| `components/daily-page.tsx` | 日报页面 | 重写为话题聚合 + 精选展示 |
| `components/weekly-page.tsx` | 周报页面 | 重写为 editorial + 精选展示，改用 SWR |
| `vercel.json` | Cron 配置 | 周报 cron 改为 23:05 UTC |

### 新建的文件

| 文件 | 职责 |
|------|------|
| `app/api/settings/reports/route.ts` | 报告设置 GET/PUT API |
| `components/report-settings-page.tsx` | 报告设置页面 |

### 删除的文件

| 文件 | 原因 |
|------|------|
| `app/api/news-flashes/route.ts` | NewsFlash 功能移除 |

---

## Task 1: Prisma Schema 重构

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 备份当前 schema，然后修改 DailyOverview 模型**

将 `DailyOverview` 模型（约 lines 41-48）替换为：

```prisma
model DailyOverview {
  id            String   @id @default(cuid())
  date          String   @unique
  dayLabel      String
  topicCount    Int      @default(0)
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  errorMessage  String?
  errorSteps    String[]

  topics        DigestTopic[]
  picks         DailyPick[]
}
```

- [ ] **Step 2: 修改 WeeklyReport 模型**

将 `WeeklyReport` 模型（约 lines 161-169）替换为：

```prisma
model WeeklyReport {
  id            String   @id @default(cuid())
  weekNumber    String   @unique
  editorial     String?
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  errorMessage  String?
  errorSteps    String[]

  picks         WeeklyPick[]
}
```

- [ ] **Step 3: 修改 DailyReportConfig 模型**

将 `DailyReportConfig` 模型（约 lines 50-59）替换为：

```prisma
model DailyReportConfig {
  id                 String   @id @default("default")

  packs              String[]
  maxItems           Int      @default(50)
  minScore           Int      @default(0)

  keywordBlacklist   String[]
  filterPrompt       String?

  topicPrompt        String?
  topicSummaryPrompt String?
  pickReasonPrompt   String?

  pickCount          Int      @default(3)

  createdAt          DateTime @default(now()) @db.Timestamptz
  updatedAt          DateTime @updatedAt @db.Timestamptz
}
```

- [ ] **Step 4: 修改 WeeklyReportConfig 模型**

将 `WeeklyReportConfig` 模型（约 lines 171-178）替换为：

```prisma
model WeeklyReportConfig {
  id                 String   @id @default("default")

  days               Int      @default(7)

  editorialPrompt    String?
  pickReasonPrompt   String?

  pickCount          Int      @default(6)

  createdAt          DateTime @default(now()) @db.Timestamptz
  updatedAt          DateTime @updatedAt @db.Timestamptz
}
```

- [ ] **Step 5: 删除 TimelineEvent 和 NewsFlash 模型，新增 DigestTopic/DailyPick/WeeklyPick**

删除 `TimelineEvent`（约 lines 147-159）和 `NewsFlash`（约 lines 93-101）。

在 `DailyOverview` 模型之后新增：

```prisma
model DigestTopic {
  id          String        @id @default(cuid())
  dailyId     String
  daily       DailyOverview @relation(fields: [dailyId], references: [id], onDelete: Cascade)

  order       Int
  title       String
  summary     String
  itemIds     String[]
  tweetIds    String[]
  createdAt   DateTime      @default(now()) @db.Timestamptz

  @@index([dailyId])
}

model DailyPick {
  id          String        @id @default(cuid())
  dailyId     String
  daily       DailyOverview @relation(fields: [dailyId], references: [id], onDelete: Cascade)

  order       Int
  itemId      String?
  tweetId     String?
  reason      String
  createdAt   DateTime      @default(now()) @db.Timestamptz

  @@index([dailyId])
}

model WeeklyPick {
  id          String        @id @default(cuid())
  weeklyId    String
  weekly      WeeklyReport  @relation(fields: [weeklyId], references: [id], onDelete: Cascade)

  order       Int
  itemId      String
  reason      String
  createdAt   DateTime      @default(now()) @db.Timestamptz

  @@index([weeklyId])
}
```

- [ ] **Step 6: 清理 Item 模型中的 NewsFlash 关联**

从 `Item` 模型中删除 `newsFlashes NewsFlash[]` 行。

- [ ] **Step 7: 执行 `pnpm exec prisma db push` 同步数据库**

Run: `pnpm exec prisma db push`

> **重要**: 如果 `db push` 失败（数据冲突），使用 `prisma migrate dev --name report-redesign` 代替。`packs` 字段类型从 `String` 变为 `String[]` 可能需要手动迁移。

- [ ] **Step 8: 运行 `pnpm check` 确认无类型错误**

Run: `pnpm check`

此时预期会有类型错误（引用了已删除的模型），这是正常的，后续 task 会修复。

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: restructure prisma schema for report redesign"
```

---

## Task 2: 清理已删除模型的代码引用

**Files:**
- Delete: `app/api/news-flashes/route.ts`
- Modify: `lib/types.ts`
- Modify: `lib/api-client.ts`

- [ ] **Step 1: 删除 NewsFlash API 路由**

删除 `app/api/news-flashes/route.ts` 文件。

- [ ] **Step 2: 更新 lib/types.ts**

读取 `lib/types.ts`。执行以下变更：
1. 删除 `NewsFlash` 类型（约 lines 40-44）
2. 删除 `TimelineEvent` 类型（约 lines 46-52）
3. 将 `DailyOverview` 类型（约 lines 62-65）替换为：

```typescript
export type DigestTopic = {
  id: string
  order: number
  title: string
  summary: string
  itemIds: string[]
  tweetIds: string[]
}

export type DailyPick = {
  id: string
  order: number
  itemId: string | null
  tweetId: string | null
  reason: string
}

export type DailyReportData = {
  date: string
  dayLabel: string
  topicCount: number
  errorMessage?: string | null
  errorSteps?: string[] | null
  topics: DigestTopic[]
  picks: DailyPick[]
}
```

4. 将 `WeeklyReport` 类型（约 lines 67-72）替换为：

```typescript
export type WeeklyPick = {
  id: string
  order: number
  itemId: string
  reason: string
}

export type WeeklyReportData = {
  weekNumber: string
  editorial: string | null
  errorMessage?: string | null
  errorSteps?: string[] | null
  picks: WeeklyPick[]
}
```

- [ ] **Step 3: 更新 lib/api-client.ts**

读取 `lib/api-client.ts`。执行以下变更：
1. 删除 `fetchNewsFlashes()` 函数（约 lines 261-269）
2. 更新 `fetchDailyOverview()` 的返回类型为 `DailyReportData | null`
3. 更新 `fetchWeeklyReport()` 的返回类型为 `WeeklyReportData | null`

- [ ] **Step 4: 运行 `pnpm check` 确认类型**

Run: `pnpm check`

此时 `app/api/daily/route.ts`、`app/api/weekly/route.ts`、`src/reports/`、`components/` 等文件仍会有错误，后续 task 修复。

- [ ] **Step 5: Commit**

```bash
git add app/api/news-flashes/ lib/types.ts lib/api-client.ts
git commit -m "refactor: remove NewsFlash/TimelineEvent code and update types"
```

---

## Task 3: 重写报告 AI Prompts

**Files:**
- Modify: `src/ai/prompts-reports.ts`

- [ ] **Step 1: 重写 prompts-reports.ts**

将 `src/ai/prompts-reports.ts` 完全重写。保留文件中的 import 结构，替换所有 prompt 构建和解析函数：

```typescript
import type { Item, Tweet } from "@prisma/client"

// ============================================================
// Types
// ============================================================

export interface TopicClusterItem {
  title: string
  summary: string
  type: "item" | "tweet"
  index: number
}

export interface TopicCluster {
  title: string
  itemIndexes: number[]
  tweetIndexes: number[]
}

export interface TopicClusteringResult {
  topics: TopicCluster[]
}

export interface TopicSummaryResult {
  summary: string
}

export interface PickReasonResult {
  reason: string
}

export interface EditorialResult {
  editorial: string
}

// ============================================================
// Default Prompts
// ============================================================

export const DEFAULT_TOPIC_PROMPT = `你是一位专业的信息分析师。请将以下内容列表按照话题进行聚类分组。

要求：
1. 分成 5-10 个话题
2. 每个话题内的内容应该高度相关
3. 每条内容只能属于一个话题
4. 不要遗漏重要内容
5. 话题标题简洁有力（中文，10字以内）

请以 JSON 格式输出：
{
  "topics": [
    {
      "title": "话题标题",
      "itemIndexes": [0, 1, 2],
      "tweetIndexes": []
    }
  ]
}`

export const DEFAULT_TOPIC_SUMMARY_PROMPT = `你是一位专业的信息分析师。请为以下话题下的内容生成一段综合总结。

要求：
1. 总结应该提炼核心信息和关键趋势
2. 200-400字
3. 用中文撰写
4. 不要简单罗列，要综合分析

请直接输出总结文本，不要包含 JSON 格式或额外标记。`

export const DEFAULT_PICK_REASON_PROMPT = `你是一位专业的内容策展人。请说明为什么这篇文章值得阅读。

要求：
1. 50-100字
2. 突出文章的独特价值或重要信息
3. 用中文撰写

请直接输出推荐理由，不要包含 JSON 格式。`

export const DEFAULT_FILTER_PROMPT = `你是一位信息过滤专家。请根据以下规则判断哪些内容值得保留。

请以 JSON 格式输出：
{
  "keep": [0, 2, 5],
  "discard": [1, 3, 4]
}

keep 和 discard 中的数字是原始内容列表的索引。`

export const DEFAULT_EDITORIAL_PROMPT = `你是一位资深的行业分析师。请基于本周各日的话题摘要和重点文章，撰写一篇有深度的周总结。

要求：
1. 500-1000字
2. 识别跨日趋势和关键转折点
3. 分析本周最重要的事件及其影响
4. 用中文撰写
5. 使用编辑语调，避免过于技术化

请直接输出周总结文本。`

export const DEFAULT_WEEKLY_PICK_REASON_PROMPT = `你是一位资深的内容策展人。请说明为什么这篇文章值得在本周深入阅读。

要求：
1. 80-150字
2. 说明文章的深度价值和对读者的意义
3. 用中文撰写

请直接输出推荐理由。`

export const DEFAULT_DAILY_PICK_REASON_PROMPT = DEFAULT_PICK_REASON_PROMPT

// ============================================================
// Topic Clustering (Step 3)
// ============================================================

export function buildTopicClusteringPrompt(
  items: TopicClusterItem[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_TOPIC_PROMPT
  const contentList = items
    .map((item, i) => `[${i}] [${item.type === "item" ? "文章" : "推文"}] ${item.title}\n    ${item.summary}`)
    .join("\n\n")

  return `${systemPrompt}\n\n---\n\n以下是需要分类的内容列表：\n\n${contentList}`
}

export function parseTopicClusteringResult(text: string): TopicClusteringResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI response does not contain valid JSON for topic clustering")
  const parsed = JSON.parse(jsonMatch[0])
  return parsed as TopicClusteringResult
}

// ============================================================
// Topic Summary (Step 4a)
// ============================================================

export function buildTopicSummaryPrompt(
  topicTitle: string,
  contents: { title: string; summary: string; type: string }[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_TOPIC_SUMMARY_PROMPT
  const contentList = contents
    .map((c) => `- [${c.type === "item" ? "文章" : "推文"}] ${c.title}: ${c.summary}`)
    .join("\n")

  return `${systemPrompt}\n\n---\n\n话题：${topicTitle}\n\n该话题下的内容：\n${contentList}`
}

export function parseTopicSummaryResult(text: string): TopicSummaryResult {
  return { summary: text.trim() }
}

// ============================================================
// Pick Reason (Step 4b)
// ============================================================

export function buildPickReasonPrompt(
  title: string,
  summary: string,
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_DAILY_PICK_REASON_PROMPT
  return `${systemPrompt}\n\n---\n\n文章标题：${title}\n文章摘要：${summary}`
}

export function parsePickReasonResult(text: string): PickReasonResult {
  return { reason: text.trim() }
}

// ============================================================
// AI Filter (Step 2, optional)
// ============================================================

export function buildFilterPrompt(
  items: TopicClusterItem[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_FILTER_PROMPT
  const contentList = items
    .map((item, i) => `[${i}] [${item.type === "item" ? "文章" : "推文"}] ${item.title}\n    ${item.summary}`)
    .join("\n\n")

  return `${systemPrompt}\n\n---\n\n以下是需要过滤的内容列表：\n\n${contentList}`
}

export function parseFilterResult(text: string): { keep: number[]; discard: number[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI response does not contain valid JSON for filtering")
  return JSON.parse(jsonMatch[0])
}

// ============================================================
// Weekly Editorial (Step 2)
// ============================================================

export function buildEditorialPrompt(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  topItems: { title: string; summary: string; score: number }[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_EDITORIAL_PROMPT
  const topicSection = topicSummaries
    .map((t) => `【${t.date} ${t.dayLabel}】${t.title}: ${t.summary}`)
    .join("\n\n")
  const itemSection = topItems
    .map((item) => `- [${item.score}分] ${item.title}: ${item.summary}`)
    .join("\n")

  return `${systemPrompt}\n\n---\n\n本周话题摘要：\n\n${topicSection}\n\n本周高分文章：\n${itemSection}`
}

export function parseEditorialResult(text: string): EditorialResult {
  return { editorial: text.trim() }
}
```

- [ ] **Step 2: 运行 `pnpm check`**

Run: `pnpm check`

此时 `src/reports/daily.ts` 和 `src/reports/weekly.ts` 会因引用了旧的 prompt 函数而报错，后续 task 修复。

- [ ] **Step 3: Commit**

```bash
git add src/ai/prompts-reports.ts
git commit -m "refactor: rewrite report AI prompts for topic clustering pipeline"
```

---

## Task 4: 重写日报生成 Pipeline

**Files:**
- Modify: `src/reports/daily.ts`

- [ ] **Step 1: 重写 src/reports/daily.ts**

将 `src/reports/daily.ts` 完全重写为 5 步 pipeline：

```typescript
import { prisma } from "@/lib/prisma"
import type { Item, Tweet, DailyReportConfig } from "@prisma/client"
import type { AiClient } from "@/src/ai/types"
import { formatUtcDate, formatUtcDayLabel } from "@/lib/date-utils"
import {
  buildTopicClusteringPrompt,
  parseTopicClusteringResult,
  buildTopicSummaryPrompt,
  parseTopicSummaryResult,
  buildPickReasonPrompt,
  parsePickReasonResult,
  buildFilterPrompt,
  parseFilterResult,
  DEFAULT_TOPIC_PROMPT,
  DEFAULT_TOPIC_SUMMARY_PROMPT,
  DEFAULT_DAILY_PICK_REASON_PROMPT,
  DEFAULT_FILTER_PROMPT,
  type TopicClusterItem,
} from "@/src/ai/prompts-reports"

const SUMMARY_TRUNCATE_LENGTH = 500
const PARALLEL_CONCURRENCY = 3

export interface DailyGenerateResult {
  date: string
  topicCount: number
  errorSteps: string[]
}

// ============================================================
// Pipeline Steps
// ============================================================

/** Step 1: Collect items and tweets from the past 24 hours */
async function collectData(now: Date) {
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [items, tweets] = await Promise.all([
    prisma.item.findMany({
      where: { publishedAt: { gte: start, lte: now } },
      orderBy: { score: "desc" },
    }),
    prisma.tweet.findMany({
      where: {
        publishedAt: { gte: start, lte: now },
        tab: { in: ["home", "lists"] },
      },
    }),
  ])

  return { items, tweets }
}

/** Step 2: Filter by keyword blacklist and min score */
function filterContent(
  items: Item[],
  tweets: Tweet[],
  config: DailyReportConfig
): { filteredItems: Item[]; filteredTweets: Tweet[] } {
  const { keywordBlacklist, minScore } = config

  const matchesBlacklist = (text: string): boolean => {
    if (!keywordBlacklist.length) return false
    return keywordBlacklist.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))
  }

  const filteredItems = items.filter(
    (item) => (item.score ?? 0) >= minScore && !matchesBlacklist(item.title + " " + (item.summary ?? ""))
  )
  const filteredTweets = tweets.filter(
    (tweet) => !matchesBlacklist((tweet.text ?? "") + " " + (tweet.title ?? ""))
  )

  return { filteredItems, filteredTweets }
}

/** Step 2b: Optional AI pre-filter */
async function aiFilter(
  filteredItems: Item[],
  filteredTweets: Tweet[],
  config: DailyReportConfig,
  aiClient: AiClient
): Promise<{ items: Item[]; tweets: Tweet[] }> {
  if (!config.filterPrompt) return { items: filteredItems, tweets: filteredTweets }

  try {
    const allContent: TopicClusterItem[] = [
      ...filteredItems.map((item, i) => ({
        title: item.title,
        summary: (item.summary ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
        type: "item" as const,
        index: i,
      })),
      ...filteredTweets.map((tweet, i) => ({
        title: tweet.title ?? `@${tweet.authorHandle}`,
        summary: (tweet.text ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
        type: "tweet" as const,
        index: filteredItems.length + i,
      })),
    ]

    const prompt = buildFilterPrompt(allContent, config.filterPrompt)
    const result = await aiClient.generateText(prompt)
    const { keep } = parseFilterResult(result)

    const keptItems = filteredItems.filter((_, i) => keep.includes(i))
    const keptTweets = filteredTweets.filter((_, i) => keep.includes(filteredItems.length + i))
    return { items: keptItems, tweets: keptTweets }
  } catch {
    // AI filter failure → pass all through
    return { items: filteredItems, tweets: filteredTweets }
  }
}

/** Step 3: AI topic clustering */
async function topicClustering(
  items: Item[],
  tweets: Tweet[],
  aiClient: AiClient,
  config: DailyReportConfig
) {
  const contentList: TopicClusterItem[] = [
    ...items.map((item, i) => ({
      title: item.title,
      summary: (item.summary ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
      type: "item" as const,
      index: i,
    })),
    ...tweets.map((tweet, i) => ({
      title: tweet.title ?? `@${tweet.authorHandle}`,
      summary: (tweet.text ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
      type: "tweet" as const,
      index: items.length + i,
    })),
  ]

  const prompt = buildTopicClusteringPrompt(contentList, config.topicPrompt)
  const result = await aiClient.generateText(prompt)
  return parseTopicClusteringResult(result)
}

/** Step 4a: Generate summary for each topic (parallel) */
async function generateTopicSummaries(
  clusteringResult: ReturnType<typeof parseTopicClusteringResult>,
  items: Item[],
  tweets: Tweet[],
  aiClient: AiClient,
  config: DailyReportConfig
) {
  const { topics } = clusteringResult

  const results = []
  for (let i = 0; i < topics.length; i += PARALLEL_CONCURRENCY) {
    const batch = topics.slice(i, i + PARALLEL_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (topic) => {
        const topicItems = topic.itemIndexes
          .filter((idx) => idx < items.length)
          .map((idx) => items[idx])
        const topicTweets = topic.tweetIndexes
          .filter((idx) => idx >= items.length)
          .map((idx) => tweets[idx - items.length])

        const contents = [
          ...topicItems.map((item) => ({
            title: item.title,
            summary: (item.summary ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
            type: "item",
          })),
          ...topicTweets.map((tweet) => ({
            title: tweet.title ?? `@${tweet.authorHandle}`,
            summary: (tweet.text ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
            type: "tweet",
          })),
        ]

        if (contents.length === 0) return null

        const prompt = buildTopicSummaryPrompt(topic.title, contents, config.topicSummaryPrompt)
        const result = await aiClient.generateText(prompt)
        const parsed = parseTopicSummaryResult(result)

        return {
          title: topic.title,
          summary: parsed.summary,
          itemIds: topicItems.map((item) => item.id),
          tweetIds: topicTweets.map((tweet) => tweet.id),
        }
      })
    )

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value)
      }
    }
  }

  return results
}

/** Step 4b: Generate daily picks */
async function generateDailyPicks(
  items: Item[],
  tweets: Tweet[],
  topicCount: number,
  aiClient: AiClient,
  config: DailyReportConfig
) {
  const pickCount = config.pickCount ?? 3

  // Sort items by score, take top picks
  const sortedItems = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const picks: { itemId: string | null; tweetId: string | null; reason: string }[] = []

  for (const item of sortedItems.slice(0, pickCount)) {
    try {
      const prompt = buildPickReasonPrompt(item.title, item.summary ?? "", config.pickReasonPrompt)
      const result = await aiClient.generateText(prompt)
      const parsed = parsePickReasonResult(result)
      picks.push({ itemId: item.id, tweetId: null, reason: parsed.reason })
    } catch {
      // Fallback: use item summary as reason
      picks.push({ itemId: item.id, tweetId: null, reason: item.summary ?? "" })
    }
  }

  return picks
}

/** Step 5: Persist results */
async function persistResults(
  date: string,
  dayLabel: string,
  topics: { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[],
  picks: { itemId: string | null; tweetId: string | null; reason: string }[],
  errorMessage?: string,
  errorSteps?: string[]
) {
  // Upsert DailyOverview
  const overview = await prisma.dailyOverview.upsert({
    where: { date },
    create: {
      date,
      dayLabel,
      topicCount: topics.length,
      errorMessage,
      errorSteps: errorSteps ?? [],
    },
    update: {
      dayLabel,
      topicCount: topics.length,
      errorMessage,
      errorSteps: errorSteps ?? [],
    },
  })

  // Delete old topics and picks
  await prisma.digestTopic.deleteMany({ where: { dailyId: overview.id } })
  await prisma.dailyPick.deleteMany({ where: { dailyId: overview.id } })

  // Create new topics
  if (topics.length > 0) {
    await prisma.digestTopic.createMany({
      data: topics.map((topic, index) => ({
        dailyId: overview.id,
        order: index,
        title: topic.title,
        summary: topic.summary,
        itemIds: topic.itemIds,
        tweetIds: topic.tweetIds,
      })),
    })
  }

  // Create new picks
  if (picks.length > 0) {
    await prisma.dailyPick.createMany({
      data: picks.map((pick, index) => ({
        dailyId: overview.id,
        order: index,
        itemId: pick.itemId,
        tweetId: pick.tweetId,
        reason: pick.reason,
      })),
    })
  }

  return overview
}

// ============================================================
// Fallback: Category-based grouping when AI clustering fails
// ============================================================

function fallbackCategoryGrouping(items: Item[]): { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[] {
  const groups = new Map<string, Item[]>()

  for (const item of items) {
    const categories = item.categories ?? []
    const category = categories[0] ?? "其他"
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(item)
  }

  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    title: category,
    summary: groupItems[0].summary ?? "",
    itemIds: groupItems.map((item) => item.id),
    tweetIds: [],
  }))
}

// ============================================================
// Main Pipeline
// ============================================================

export async function generateDailyReport(
  now: Date,
  aiClient: AiClient
): Promise<DailyGenerateResult> {
  const date = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Load config
  let config = await prisma.dailyReportConfig.findUnique({ where: { id: "default" } })
  if (!config) {
    config = await prisma.dailyReportConfig.create({ data: { id: "default" } })
  }

  // Step 1: Collect data
  let items: Item[]
  let tweets: Tweet[]
  try {
    const result = await collectData(now)
    items = result.items
    tweets = result.tweets
  } catch {
    errorSteps.push("dataCollection")
    await persistResults(date, dayLabel, [], [], "数据收集失败", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Apply maxItems limit
  items = items.slice(0, config.maxItems ?? 50)

  // Step 2: Filter
  const { filteredItems, filteredTweets } = filterContent(items, tweets, config)

  // Step 2b: Optional AI filter
  let finalItems = filteredItems
  let finalTweets = filteredTweets
  if (config.filterPrompt) {
    const aiResult = await aiFilter(filteredItems, filteredTweets, config, aiClient)
    finalItems = aiResult.items
    finalTweets = aiResult.tweets
  }

  if (finalItems.length === 0 && finalTweets.length === 0) {
    await persistResults(date, dayLabel, [], [], "过去24小时无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 3: Topic clustering
  let topics: { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[] = []
  try {
    const clusteringResult = await topicClustering(finalItems, finalTweets, aiClient, config)

    // Step 4a: Topic summaries
    try {
      topics = await generateTopicSummaries(clusteringResult, finalItems, finalTweets, aiClient, config)
    } catch {
      errorSteps.push("topicSummary")
      // Fallback: use clustering titles with first item summary
      topics = clusteringResult.topics.map((topic) => ({
        title: topic.title,
        summary: topic.itemIndexes[0] !== undefined
          ? (finalItems[topic.itemIndexes[0]]?.summary ?? "")
          : "",
        itemIds: topic.itemIndexes.filter((i) => i < finalItems.length).map((i) => finalItems[i].id),
        tweetIds: topic.tweetIndexes
          .filter((i) => i >= finalItems.length)
          .map((i) => finalTweets[i - finalItems.length].id),
      }))
    }
  } catch {
    errorSteps.push("topicClustering")
    // Fallback: group by categories
    topics = fallbackCategoryGrouping(finalItems)
  }

  // Step 4b: Daily picks
  let picks: { itemId: string | null; tweetId: string | null; reason: string }[] = []
  try {
    picks = await generateDailyPicks(finalItems, finalTweets, topics.length, aiClient, config)
  } catch {
    errorSteps.push("pickReason")
  }

  // Step 5: Persist
  try {
    await persistResults(date, dayLabel, topics, picks, errorSteps.length > 0 ? "部分步骤失败" : undefined, errorSteps)
  } catch {
    errorSteps.push("persist")
  }

  return { date, topicCount: topics.length, errorSteps }
}
```

> **注意**: `AiClient` 接口（`src/ai/types.ts`）中需要确认是否有 `generateText(prompt: string): Promise<string>` 方法。如果没有，需要在 Task 5 中处理。检查现有 `AiClient` 接口中是否有类似方法（如 `chat()` 或 `complete()`）可以复用。

- [ ] **Step 2: 检查 AiClient 接口是否有 generateText 方法**

读取 `src/ai/types.ts`，确认 `AiClient` 接口的方法签名。如果不存在 `generateText`，需要调整为现有方法（如 `chat`）或新增接口方法。

- [ ] **Step 3: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add src/reports/daily.ts
git commit -m "feat: rewrite daily report generation as 5-step pipeline"
```

---

## Task 5: 确保 AiClient 接口兼容

**Files:**
- Modify: `src/ai/types.ts`（如需要）
- Modify: `src/ai/providers/` 下的具体实现（如需要）

- [ ] **Step 1: 读取 AiClient 接口**

读取 `src/ai/types.ts`，找到 `AiClient` 接口定义。确认是否有 `generateText(prompt: string): Promise<string>` 方法或等价方法。

- [ ] **Step 2: 如需新增方法，添加到接口和所有实现**

如果 `generateText` 不存在，在 `AiClient` 接口中新增：

```typescript
generateText(prompt: string): Promise<string>
```

然后在 `src/ai/providers/` 下的每个 client 实现（Anthropic、Gemini、OpenAI）中实现该方法。如果已有类似方法（如 `chat`），可以直接映射。

- [ ] **Step 3: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add src/ai/types.ts src/ai/providers/
git commit -m "feat: add generateText method to AiClient interface"
```

---

## Task 6: 重写周报生成 Pipeline

**Files:**
- Modify: `src/reports/weekly.ts`

- [ ] **Step 1: 重写 src/reports/weekly.ts**

将 `src/reports/weekly.ts` 完全重写为 3 步 pipeline：

```typescript
import { prisma } from "@/lib/prisma"
import type { Item, Tweet, WeeklyReportConfig } from "@prisma/client"
import type { AiClient } from "@/src/ai/types"
import { utcWeekNumber, beijingWeekRange } from "@/lib/date-utils"
import {
  buildEditorialPrompt,
  parseEditorialResult,
  buildPickReasonPrompt,
  parsePickReasonResult,
  DEFAULT_EDITORIAL_PROMPT,
  DEFAULT_WEEKLY_PICK_REASON_PROMPT,
} from "@/src/ai/prompts-reports"

export interface WeeklyGenerateResult {
  weekNumber: string
  pickCount: number
  errorSteps: string[]
}

// ============================================================
// Pipeline Steps
// ============================================================

/** Step 1: Collect data from daily reports */
async function collectData(config: WeeklyReportConfig) {
  const days = config.days ?? 7
  const dailyOverviews = await prisma.dailyOverview.findMany({
    orderBy: { date: "desc" },
    take: days,
    include: {
      topics: {
        orderBy: { order: "asc" },
      },
    },
  })

  if (dailyOverviews.length < 3) return null

  // Collect all referenced item IDs and tweet IDs
  const itemIdSet = new Set<string>()
  const tweetIdSet = new Set<string>()
  const topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[] = []

  for (const daily of dailyOverviews) {
    for (const topic of daily.topics) {
      for (const id of topic.itemIds) itemIdSet.add(id)
      for (const id of topic.tweetIds) tweetIdSet.add(id)
      topicSummaries.push({
        date: daily.date,
        dayLabel: daily.dayLabel,
        title: topic.title,
        summary: topic.summary,
      })
    }
  }

  const [items, tweets] = await Promise.all([
    itemIdSet.size > 0
      ? prisma.item.findMany({ where: { id: { in: Array.from(itemIdSet) } } })
      : [],
    tweetIdSet.size > 0
      ? prisma.tweet.findMany({ where: { id: { in: Array.from(tweetIdSet) } } })
      : [],
  ])

  return { dailyOverviews, items, tweets, topicSummaries }
}

/** Step 2: AI deep editorial */
async function generateEditorial(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  items: Item[],
  aiClient: AiClient,
  config: WeeklyReportConfig
): Promise<string> {
  // Sort topic summaries by date ascending
  const sortedSummaries = [...topicSummaries].sort((a, b) => a.date.localeCompare(b.date))

  // Get top items by score for context
  const topItems = [...items]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      summary: (item.summary ?? "").slice(0, 500),
      score: item.score ?? 0,
    }))

  const prompt = buildEditorialPrompt(sortedSummaries, topItems, config.editorialPrompt)
  const result = await aiClient.generateText(prompt)
  const parsed = parseEditorialResult(result)
  return parsed.editorial
}

/** Step 3: Weekly picks + persist */
async function generateWeeklyPicks(
  items: Item[],
  aiClient: AiClient,
  config: WeeklyReportConfig
) {
  const pickCount = config.pickCount ?? 6
  const sortedItems = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const picks: { itemId: string; reason: string }[] = []

  for (const item of sortedItems.slice(0, pickCount)) {
    try {
      const prompt = buildPickReasonPrompt(item.title, item.summary ?? "", config.pickReasonPrompt ?? DEFAULT_WEEKLY_PICK_REASON_PROMPT)
      const result = await aiClient.generateText(prompt)
      const parsed = parsePickReasonResult(result)
      picks.push({ itemId: item.id, reason: parsed.reason })
    } catch {
      picks.push({ itemId: item.id, reason: item.summary ?? "" })
    }
  }

  return picks
}

async function persistResults(
  weekNumber: string,
  editorial: string | null,
  picks: { itemId: string; reason: string }[],
  errorMessage?: string,
  errorSteps?: string[]
) {
  const report = await prisma.weeklyReport.upsert({
    where: { weekNumber },
    create: {
      weekNumber,
      editorial,
      errorMessage,
      errorSteps: errorSteps ?? [],
    },
    update: {
      editorial,
      errorMessage,
      errorSteps: errorSteps ?? [],
    },
  })

  // Delete old picks
  await prisma.weeklyPick.deleteMany({ where: { weeklyId: report.id } })

  // Create new picks
  if (picks.length > 0) {
    await prisma.weeklyPick.createMany({
      data: picks.map((pick, index) => ({
        weeklyId: report.id,
        order: index,
        itemId: pick.itemId,
        reason: pick.reason,
      })),
    })
  }

  return report
}

// ============================================================
// Main Pipeline
// ============================================================

export async function generateWeeklyReport(
  now: Date,
  aiClient: AiClient
): Promise<WeeklyGenerateResult> {
  const errorSteps: string[] = []

  // Calculate week number
  const weekRange = beijingWeekRange(now)
  const monday = weekRange.start
  const weekNumber = utcWeekNumber(monday)

  // Load config
  let config = await prisma.weeklyReportConfig.findUnique({ where: { id: "default" } })
  if (!config) {
    config = await prisma.weeklyReportConfig.create({ data: { id: "default" } })
  }

  // Step 1: Collect data
  const data = await collectData(config)
  if (!data) {
    return { weekNumber, pickCount: 0, errorSteps: ["insufficientDailyReports"] }
  }
  const { items, topicSummaries } = data

  if (items.length === 0) {
    await persistResults(weekNumber, "本周无引用文章", [], "无数据")
    return { weekNumber, pickCount: 0, errorSteps: [] }
  }

  // Step 2: Editorial
  let editorial: string | null = null
  try {
    editorial = await generateEditorial(topicSummaries, items, aiClient, config)
  } catch {
    errorSteps.push("editorial")
    // Fallback: concatenate topic summaries
    editorial = topicSummaries.map((t) => `【${t.title}】${t.summary}`).join("\n\n")
  }

  // Step 3: Weekly picks
  let picks: { itemId: string; reason: string }[] = []
  try {
    picks = await generateWeeklyPicks(items, aiClient, config)
  } catch {
    errorSteps.push("pickReason")
  }

  // Persist
  try {
    await persistResults(
      weekNumber,
      editorial,
      picks,
      errorSteps.length > 0 ? "部分步骤失败" : undefined,
      errorSteps
    )
  } catch {
    errorSteps.push("persist")
  }

  return { weekNumber, pickCount: picks.length, errorSteps }
}
```

- [ ] **Step 2: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 3: Commit**

```bash
git add src/reports/weekly.ts
git commit -m "feat: rewrite weekly report generation as 3-step pipeline"
```

---

## Task 7: 更新 Cron 路由

**Files:**
- Modify: `app/api/cron/daily/route.ts`
- Modify: `app/api/cron/weekly/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: 更新日报 cron 路由**

读取 `app/api/cron/daily/route.ts`。修改 POST handler：

```typescript
import { NextRequest, NextResponse } from "next/server"
import { verifyCronRequest, unauthorizedResponse } from "../_lib"
import { createAiClient } from "@/src/ai/providers"
import { generateDailyReport } from "@/src/reports/daily"

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  const aiClient = createAiClient()
  if (!aiClient) {
    return NextResponse.json({ error: "No AI client available" }, { status: 500 })
  }

  const result = await generateDailyReport(new Date(), aiClient)
  console.log(`[daily-cron] Generated report for ${result.date}: ${result.topicCount} topics, errors: ${result.errorSteps.join(",") || "none"}`)

  return NextResponse.json({ success: true, ...result })
}
```

- [ ] **Step 2: 更新周报 cron 路由**

读取 `app/api/cron/weekly/route.ts`。修改 POST handler：

```typescript
import { NextRequest, NextResponse } from "next/server"
import { verifyCronRequest, unauthorizedResponse } from "../_lib"
import { createAiClient } from "@/src/ai/providers"
import { generateWeeklyReport } from "@/src/reports/weekly"

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  const aiClient = createAiClient()
  if (!aiClient) {
    return NextResponse.json({ error: "No AI client available" }, { status: 500 })
  }

  const result = await generateWeeklyReport(new Date(), aiClient)
  console.log(`[weekly-cron] Generated report for ${result.weekNumber}: ${result.pickCount} picks, errors: ${result.errorSteps.join(",") || "none"}`)

  return NextResponse.json({ success: true, ...result })
}
```

- [ ] **Step 3: 更新 vercel.json 中周报 cron 时间**

将周报 cron 从 `0 0 23 * * 0` 改为 `0 5 23 * * 0`（延迟 5 分钟，避免与日报 cron 冲突）。

- [ ] **Step 4: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/daily/route.ts app/api/cron/weekly/route.ts vercel.json
git commit -m "refactor: update cron routes for new pipeline"
```

---

## Task 8: 重写日报和周报 GET API

**Files:**
- Modify: `app/api/daily/route.ts`
- Modify: `app/api/weekly/route.ts`

- [ ] **Step 1: 重写日报 GET API**

读取 `app/api/daily/route.ts`。重写为返回 `DigestTopic[]` + `DailyPick[]`：

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { success, error } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")

  // Find daily overview by date or latest
  const overview = await prisma.dailyOverview.findFirst({
    where: date ? { date } : undefined,
    orderBy: { date: "desc" },
    include: {
      topics: { orderBy: { order: "asc" } },
      picks: { orderBy: { order: "asc" } },
    },
  })

  if (!overview) {
    return success({
      date: date ?? null,
      dayLabel: null,
      topicCount: 0,
      topics: [],
      picks: [],
    })
  }

  return success({
    date: overview.date,
    dayLabel: overview.dayLabel,
    topicCount: overview.topicCount,
    errorMessage: overview.errorMessage,
    errorSteps: overview.errorSteps,
    topics: overview.topics.map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      summary: t.summary,
      itemIds: t.itemIds,
      tweetIds: t.tweetIds,
    })),
    picks: overview.picks.map((p) => ({
      id: p.id,
      order: p.order,
      itemId: p.itemId,
      tweetId: p.tweetId,
      reason: p.reason,
    })),
  })
}
```

- [ ] **Step 2: 重写周报 GET API**

读取 `app/api/weekly/route.ts`。重写为返回 `editorial` + `WeeklyPick[]`：

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { success, error } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const week = searchParams.get("week")

  // Find weekly report by week number or latest
  const report = await prisma.weeklyReport.findFirst({
    where: week ? { weekNumber: week } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      picks: { orderBy: { order: "asc" } },
    },
  })

  if (!report) {
    return success({
      weekNumber: week ?? null,
      editorial: null,
      picks: [],
    })
  }

  return success({
    weekNumber: report.weekNumber,
    editorial: report.editorial,
    errorMessage: report.errorMessage,
    errorSteps: report.errorSteps,
    picks: report.picks.map((p) => ({
      id: p.id,
      order: p.order,
      itemId: p.itemId,
      reason: p.reason,
    })),
  })
}
```

- [ ] **Step 3: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add app/api/daily/route.ts app/api/weekly/route.ts
git commit -m "refactor: rewrite daily/weekly GET APIs for new data structure"
```

---

## Task 9: 新增报告设置 API

**Files:**
- Create: `app/api/settings/reports/route.ts`

- [ ] **Step 1: 创建报告设置 API 路由**

创建 `app/api/settings/reports/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { success, error, parseBody } from "@/lib/api-response"
import { z } from "zod"

const dailyConfigSchema = z.object({
  packs: z.array(z.string()).optional(),
  maxItems: z.number().int().min(1).max(200).optional(),
  minScore: z.number().int().min(0).max(10).optional(),
  keywordBlacklist: z.array(z.string()).optional(),
  filterPrompt: z.string().nullable().optional(),
  topicPrompt: z.string().nullable().optional(),
  topicSummaryPrompt: z.string().nullable().optional(),
  pickReasonPrompt: z.string().nullable().optional(),
  pickCount: z.number().int().min(1).max(10).optional(),
})

const weeklyConfigSchema = z.object({
  days: z.number().int().min(7).max(28).refine((v) => v % 7 === 0, { message: "必须为 7 的倍数" }).optional(),
  editorialPrompt: z.string().nullable().optional(),
  pickReasonPrompt: z.string().nullable().optional(),
  pickCount: z.number().int().min(1).max(20).optional(),
})

const updateSchema = z.object({
  daily: dailyConfigSchema.optional(),
  weekly: weeklyConfigSchema.optional(),
})

async function ensureDefaultConfigs() {
  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  if (!daily) {
    await prisma.dailyReportConfig.create({ data: { id: "default" } })
  }
  if (!weekly) {
    await prisma.weeklyReportConfig.create({ data: { id: "default" } })
  }
}

export async function GET() {
  await ensureDefaultConfigs()

  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  return success({ daily, weekly })
}

export async function PUT(request: NextRequest) {
  const body = await parseBody(request)
  const validation = updateSchema.safeParse(body)

  if (!validation.success) {
    return error("参数校验失败", 400, validation.error.flatten())
  }

  const { daily: dailyUpdate, weekly: weeklyUpdate } = validation.data

  if (dailyUpdate) {
    await prisma.dailyReportConfig.upsert({
      where: { id: "default" },
      create: { id: "default", ...dailyUpdate },
      update: dailyUpdate,
    })
  }

  if (weeklyUpdate) {
    await prisma.weeklyReportConfig.upsert({
      where: { id: "default" },
      create: { id: "default", ...weeklyUpdate },
      update: weeklyUpdate,
    })
  }

  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  return success({ daily, weekly })
}
```

- [ ] **Step 2: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/reports/route.ts
git commit -m "feat: add report settings API (GET/PUT)"
```

---

## Task 10: 更新 SWR Hooks

**Files:**
- Modify: `hooks/use-api.ts`

- [ ] **Step 1: 重写 hooks/use-api.ts**

读取 `hooks/use-api.ts`。执行以下变更：

1. 删除旧的 `useDaily()` 函数
2. 新增 `useDaily(date?: string)` — 支持日期参数，SWR key 为 `/api/daily?date=${date}`
3. 新增 `useWeekly(week?: string)` — SWR key 为 `/api/weekly?week=${week}`
4. 新增 `useReportSettings()` — SWR key 为 `/api/settings/reports`
5. 保留现有的 `usePacks`、`useCustomViews`、`useBookmarks`

```typescript
import useSWR from "swr"
import type { DailyReportData, WeeklyReportData } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const swrOptions = {
  revalidateOnFocus: false as const,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
}

export function useDaily(date?: string) {
  const key = date ? `/api/daily?date=${date}` : "/api/daily"
  return useSWR<{ success: boolean; data: DailyReportData }>(key, fetcher, swrOptions)
}

export function useWeekly(week?: string) {
  const key = week ? `/api/weekly?week=${week}` : "/api/weekly"
  return useSWR<{ success: boolean; data: WeeklyReportData }>(key, fetcher, swrOptions)
}

export function useReportSettings() {
  return useSWR<{
    success: boolean
    data: { daily: Record<string, unknown>; weekly: Record<string, unknown> }
  }>("/api/settings/reports", fetcher, swrOptions)
}

// ... 保留现有的 usePacks, useCustomViews, useBookmarks
```

- [ ] **Step 2: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 3: Commit**

```bash
git add hooks/use-api.ts
git commit -m "refactor: rewrite SWR hooks for new report data structure"
```

---

## Task 11: 重写日报页面

**Files:**
- Modify: `components/daily-page.tsx`

- [ ] **Step 1: 重写 components/daily-page.tsx**

读取 `components/daily-page.tsx` 了解现有 shadcn/ui 组件用法，然后重写为新结构：

新页面结构：
- 顶部：日期导航（前一天/后一天按钮）
- 中间：话题摘要列表（DigestTopic 卡片，可展开参考链接）
- 底部：今日精选（DailyPick 列表，含分数和推荐理由）
- 使用 shadcn/ui 组件：`Card`、`Button`、`Badge`、`Collapsible`
- 使用 `useDaily(date)` hook 获取数据
- 话题条目的参考链接需要额外查询 Item/Tweet 的 title 和 url

> **注意**: 由于 DigestTopic 仅存储 itemIds/tweetIds，前端需要额外请求获取引用的 Item/Tweet 详情。可以：
> - 方案 A：在 `/api/daily` 中一并返回引用的 Item/Tweet 详情（推荐，减少前端请求）
> - 方案 B：前端额外请求 `/api/items?ids=...`
>
> 如果选择方案 A，需要在 Task 8 的 `/api/daily` GET handler 中增加 Item/Tweet 的查询和返回。

- [ ] **Step 2: 更新 `/api/daily` 返回引用详情**

如果选择了方案 A，修改 `app/api/daily/route.ts`，在查询 DailyOverview 时额外查询关联的 Item 和 Tweet：

在 `overview` 查询后增加：
```typescript
// Collect all referenced IDs
const itemIds = new Set<string>()
const tweetIds = new Set<string>()
for (const topic of overview.topics) {
  for (const id of topic.itemIds) itemIds.add(id)
  for (const id of topic.tweetIds) tweetIds.add(id)
}
for (const pick of overview.picks) {
  if (pick.itemId) itemIds.add(pick.itemId)
  if (pick.tweetId) tweetIds.add(pick.tweetId)
}

// Fetch referenced items and tweets
const [referencedItems, referencedTweets] = await Promise.all([
  itemIds.size > 0 ? prisma.item.findMany({ where: { id: { in: Array.from(itemIds) } } }) : [],
  tweetIds.size > 0 ? prisma.tweet.findMany({ where: { id: { in: Array.from(tweetIds) } } }) : [],
])

// Build lookup maps
const itemMap = new Map(referencedItems.map((item) => [item.id, item]))
const tweetMap = new Map(referencedTweets.map((tweet) => [tweet.id, tweet]))
```

在返回值中增加 `referencedItems` 和 `referencedTweets`。

同步更新 `lib/types.ts` 中的 `DailyReportData` 类型。

- [ ] **Step 3: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add components/daily-page.tsx app/api/daily/route.ts lib/types.ts
git commit -m "feat: rewrite daily page with topic digest and picks"
```

---

## Task 12: 重写周报页面

**Files:**
- Modify: `components/weekly-page.tsx`

- [ ] **Step 1: 重写 components/weekly-page.tsx**

读取 `components/weekly-page.tsx` 了解现有结构，然后重写为：

新页面结构：
- 顶部：周导航（上周/下周按钮）+ 周编号标题
- 中间：深度总结（AI editorial，排版为长文阅读）
- 底部：本周精选（WeeklyPick 列表，含分数、概要、推荐理由）
- 使用 shadcn/ui 组件：`Card`、`Button`、`Badge`
- 使用 `useWeekly(week)` hook 获取数据（替换手动 fetch）
- 类似日报，需要额外查询 WeeklyPick 引用的 Item 详情

- [ ] **Step 2: 更新 `/api/weekly` 返回引用详情**

类似 Task 11 的方案 A，修改 `app/api/weekly/route.ts` 增加 Item 查询。同步更新 `WeeklyReportData` 类型。

- [ ] **Step 3: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 4: Commit**

```bash
git add components/weekly-page.tsx app/api/weekly/route.ts lib/types.ts
git commit -m "feat: rewrite weekly page with editorial and curated picks"
```

---

## Task 13: 新建报告设置页面

**Files:**
- Create: `components/report-settings-page.tsx`

- [ ] **Step 1: 创建报告设置页面**

创建 `components/report-settings-page.tsx`，包含两个板块：

**日报配置板块**:
- 数据源 Pack 选择（多选 checkbox）
- 最大收集条目数（number input）
- 最低分数阈值（number input）
- 关键词黑名单（tag input：输入框 + 回车添加 + 标签可删除）
- 今日精选数量（number input）
- 4 个 AI Prompt textarea（每个带"恢复默认"按钮）：
  - 过滤 prompt（可选）
  - 话题聚类 prompt
  - 话题总结 prompt
  - 精选理由 prompt

**周报配置板块**:
- 覆盖天数（number input，校验 7 的倍数）
- 周报精选数量（number input）
- 2 个 AI Prompt textarea（每个带"恢复默认"按钮）：
  - 深度周总结 prompt
  - 精选理由 prompt

使用 `useReportSettings()` hook 获取和保存配置。保存时调用 `PUT /api/settings/reports`。

> **注意**: 默认 prompt 值需要从 `src/ai/prompts-reports.ts` 导入的常量获取。可以在设置页面中 import 这些常量作为默认值。

- [ ] **Step 2: 运行 `pnpm check`**

Run: `pnpm check`

- [ ] **Step 3: Commit**

```bash
git add components/report-settings-page.tsx
git commit -m "feat: add report settings page with configurable prompts"
```

---

## Task 14: 路由集成和最终验证

**Files:**
- Modify: 路由相关文件（app layout 或 sidebar）
- Modify: `lib/api-client.ts`（清理残留引用）

- [ ] **Step 1: 集成报告设置页面路由**

在应用路由中添加 `/settings/reports` 路由指向 `report-settings-page.tsx`。根据现有路由结构，可能需要修改 `app/` 目录下的 layout 或 page 文件。

- [ ] **Step 2: 清理 lib/api-client.ts 中的残留引用**

确认 `fetchDailyOverview` 和 `fetchWeeklyReport` 函数是否还被其他文件引用。如果已被 SWR hooks 替代，可以删除。

- [ ] **Step 3: 全局搜索清理**

搜索项目中所有对 `NewsFlash`、`TimelineEvent`、`newsFlashes`、`timelineEvents` 的引用，确认全部已清理。

```bash
grep -r "NewsFlash\|TimelineEvent\|newsFlash\|timelineEvent" --include="*.ts" --include="*.tsx" .
```

- [ ] **Step 4: 运行 `pnpm build` 确认构建成功**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate report settings page and clean up remaining references"
```
