# X/Twitter 独立 Pipeline + 专用页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 X/Twitter 从现有 Item/Source/Pack 体系中完全剥离，建立独立的数据模型、Pipeline、API 和前端页面。

**Architecture:** 新建 Tweet/TweetBookmark/XPageConfig 三张表，X 独立 cron 直接调用 bird CLI adapter 收集数据并写入 Tweet 表。前端 `/x` 路由作为独立页面，在侧边栏「社交」分组下导航。主 pipeline 完全移除 x-* 相关逻辑。

**Tech Stack:** Next.js 16 App Router, Prisma ORM, Supabase PostgreSQL, shadcn/ui, SWR, Tailwind CSS

---

## Task 1: Prisma Schema — 新增 Tweet / TweetBookmark / XPageConfig

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾添加三个新模型**

在 `prisma/schema.prisma` 文件末尾（最后一个 `}` 之后）添加:

```prisma
model Tweet {
  id               String          @id @default(cuid())
  tweetId          String          @unique
  tab              String
  text             String          @db.Text
  url              String
  expandedUrl      String?
  publishedAt      DateTime?       @db.Timestamptz
  fetchedAt        DateTime        @default(now()) @db.Timestamptz
  authorHandle     String
  authorName       String?
  authorId         String?
  conversationId   String?
  likeCount        Int             @default(0)
  replyCount       Int             @default(0)
  retweetCount     Int             @default(0)
  summary          String?         @db.Text
  bullets          String[]
  categories       String[]
  score            Float           @default(5.0)
  mediaJson        String?         @db.Text
  quotedTweetJson  String?         @db.Text
  threadJson       String?         @db.Text
  parentJson       String?         @db.Text
  articleJson      String?         @db.Text
  bookmarks        TweetBookmark[]
  createdAt        DateTime        @default(now()) @db.Timestamptz
  updatedAt        DateTime        @updatedAt @db.Timestamptz

  @@index([tab])
  @@index([fetchedAt])
  @@index([score])
}

model TweetBookmark {
  id           String   @id @default(cuid())
  tweetId      String   @unique
  bookmarkedAt DateTime @default(now()) @db.Timestamptz
  tweet        Tweet    @relation(fields: [tweetId], references: [id], onDelete: Cascade)

  @@index([bookmarkedAt])
}

model XPageConfig {
  tab             String   @unique
  enabled         Boolean  @default(true)
  birdMode        String
  count           Int      @default(20)
  fetchAll        Boolean  @default(false)
  maxPages        Int?
  authTokenEnv    String?
  ct0Env          String?
  listsJson       String?  @db.Text
  filterPrompt    String?  @db.Text
  enrichEnabled   Boolean  @default(true)
  enrichScoring   Boolean  @default(true)
  enrichKeyPoints Boolean  @default(true)
  enrichTagging   Boolean  @default(true)
  timeWindow      String   @default("week")
  sortOrder       String   @default("ranked")
  updatedAt       DateTime @updatedAt @db.Timestamptz
}
```

- [ ] **Step 2: 推送 schema 到数据库**

Run: `pnpm exec prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: 生成 Prisma Client**

Run: `pnpm exec prisma generate`
Expected: 成功生成，无错误

- [ ] **Step 4: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Tweet, TweetBookmark, XPageConfig models"
```

---

## Task 2: 前端类型 + 工具函数

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/tweet-utils.ts`

- [ ] **Step 1: 在 lib/types.ts 添加 Tweet 类型**

在 `lib/types.ts` 文件末尾添加:

```typescript
export type Tweet = {
  id: string
  tweetId: string
  tab: string
  text: string
  url: string
  expandedUrl?: string
  publishedAt: string
  fetchedAt: string
  authorHandle: string
  authorName?: string
  likeCount: number
  replyCount: number
  retweetCount: number
  summary?: string
  bullets: string[]
  categories: string[]
  score?: number
  isBookmarked?: boolean
  media?: Array<{ type: string; url: string; previewUrl?: string }>
  quotedTweet?: {
    id: string
    text: string
    authorHandle: string
    authorName?: string
    likeCount: number
    replyCount: number
    retweetCount: number
  }
  thread?: Array<{ id?: string; text?: string; author?: string }>
  parent?: { id?: string; text?: string; author?: string }
  article?: { title: string; url?: string; previewText?: string }
}

export type XTab = "bookmarks" | "likes" | "home" | "lists"

export type XPageConfigData = {
  tab: string
  enabled: boolean
  birdMode: string
  count: number
  fetchAll: boolean
  maxPages?: number
  authTokenEnv?: string
  ct0Env?: string
  listsJson?: string
  filterPrompt?: string
  enrichEnabled: boolean
  enrichScoring: boolean
  enrichKeyPoints: boolean
  enrichTagging: boolean
  timeWindow: string
  sortOrder: string
}
```

- [ ] **Step 2: 创建 lib/tweet-utils.ts**

```typescript
export function formatEngagement(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  }
  return num.toString()
}
```

- [ ] **Step 3: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/tweet-utils.ts
git commit -m "feat: add Tweet type and tweet utility functions"
```

---

## Task 3: 清理主 Pipeline 中的 X 相关代码

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/adapters/registry.ts`
- Modify: `app/api/cron/collect/route.ts`

- [ ] **Step 1: 从 SourceType 移除 x-***

在 `src/types/index.ts` 中，将 `CANONICAL_SOURCE_TYPES` 中的 x-* 条目移除:

```typescript
export const CANONICAL_SOURCE_TYPES = [
  "rss", "json-feed", "website", "hn", "reddit", "github-trending",
] as const;
```

- [ ] **Step 2: 从 ADAPTER_FAMILIES 移除 x 系列**

在 `src/adapters/registry.ts` 中，移除 `ADAPTER_FAMILIES` 数组中的 x 相关条目。如果移除后数组为空，保留空数组 `export const ADAPTER_FAMILIES: AdapterFamily[] = []`。

- [ ] **Step 3: 清理 collect/route.ts 中的 x 相关 import 和逻辑**

在 `app/api/cron/collect/route.ts` 中:
- 移除 `collectXBirdSource` 相关的 import（如果有直接引用）
- 确保 `buildAdapters` 不再返回 x-* 适配器（由于 registry 已清理，这应该自动生效）
- 如果有针对 x-* sourceType 的特殊处理逻辑，一并移除

- [ ] **Step 3b: 检查 src/adapters/build-adapters.ts**

检查 `src/adapters/build-adapters.ts` 是否引用了 `ADAPTER_FAMILIES` 或直接注册了 x-* 适配器。由于 Task 3 Step 2 已清理 `ADAPTER_FAMILIES`，此文件应该自动不再返回 x-* 适配器。如果该文件有其他 x-* 硬编码，一并移除。

- [ ] **Step 4: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误（如果 x-bird.ts 仍被 import，需要同时移除）

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/adapters/registry.ts app/api/cron/collect/route.ts
git commit -m "refactor: remove X/Twitter from main pipeline"
```

---

## Task 4: Tweet 归档模块 (upsert-tweet-prisma)

**Files:**
- Create: `src/archive/upsert-tweet-prisma.ts`

- [ ] **Step 1: 创建 Tweet 归档函数**

```typescript
import { prisma } from "../../lib/prisma";

const BATCH_SIZE = 100;

export interface TweetArchiveResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
  newTweetIds: string[];
}

interface RawTweetData {
  tweetId: string;
  tab: string;
  text: string;
  url: string;
  expandedUrl?: string;
  publishedAt?: string;
  authorHandle: string;
  authorName?: string;
  authorId?: string;
  conversationId?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  mediaJson?: string;
  quotedTweetJson?: string;
  threadJson?: string;
  parentJson?: string;
  articleJson?: string;
}

export function parseRawItemsToTweetData(items: Array<{
  id: string;
  title: string;
  url: string;
  fetchedAt?: string;
  metadataJson?: string;
  author?: string;
  content?: string;
  publishedAt?: string;
}>, tab: string): RawTweetData[] {
  return items.map((item) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = item.metadataJson ? JSON.parse(item.metadataJson) : {};
    } catch {}

    return {
      tweetId: metadata.tweetId as string || item.id,
      tab,
      text: item.content || item.title,
      url: item.url,
      expandedUrl: (metadata.expandedUrl || metadata.canonicalHints?.expandedUrl) as string | undefined,
      publishedAt: item.publishedAt,
      authorHandle: metadata.authorName as string || item.author || "",
      authorName: metadata.authorName as string | undefined,
      authorId: metadata.authorId as string | undefined,
      conversationId: metadata.conversationId as string | undefined,
      likeCount: metadata.engagement?.reactions as number | undefined,
      replyCount: metadata.engagement?.comments as number | undefined,
      retweetCount: metadata.engagement?.score as number | undefined,
      mediaJson: metadata.media ? JSON.stringify(metadata.media) : undefined,
      quotedTweetJson: metadata.quote || metadata.quotedTweet ? JSON.stringify(metadata.quote || metadata.quotedTweet) : undefined,
      threadJson: metadata.thread ? JSON.stringify(metadata.thread) : undefined,
      parentJson: metadata.parent ? JSON.stringify(metadata.parent) : undefined,
      articleJson: metadata.article ? JSON.stringify(metadata.article) : undefined,
    };
  });
}

export async function archiveTweets(
  items: RawTweetData[],
): Promise<TweetArchiveResult> {
  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newTweetIds: [] };
  }

  const existingTweets = await prisma.tweet.findMany({
    where: { tweetId: { in: items.map((i) => i.tweetId) } },
    select: { tweetId: true, id: true },
  });

  const existingMap = new Map(existingTweets.map((t) => [t.tweetId, t.id]));
  const newItems = items.filter((i) => !existingMap.has(i.tweetId));
  const updateItems = items.filter((i) => existingMap.has(i.tweetId));

  // Batch insert new tweets
  for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
    const batch = newItems.slice(i, i + BATCH_SIZE);
    await prisma.tweet.createMany({
      data: batch.map((item) => ({
        tweetId: item.tweetId,
        tab: item.tab,
        text: item.text,
        url: item.url,
        expandedUrl: item.expandedUrl,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        authorHandle: item.authorHandle,
        authorName: item.authorName,
        authorId: item.authorId,
        conversationId: item.conversationId,
        likeCount: item.likeCount ?? 0,
        replyCount: item.replyCount ?? 0,
        retweetCount: item.retweetCount ?? 0,
        mediaJson: item.mediaJson,
        quotedTweetJson: item.quotedTweetJson,
        threadJson: item.threadJson,
        parentJson: item.parentJson,
        articleJson: item.articleJson,
      })),
      skipDuplicates: true,
    });
  }

  // Batch update existing tweets (refresh engagement + fetchedAt)
  for (let i = 0; i < updateItems.length; i += BATCH_SIZE) {
    const batch = updateItems.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((item) => {
        const existingId = existingMap.get(item.tweetId)!;
        return prisma.tweet.update({
          where: { id: existingId },
          data: {
            tab: item.tab,
            likeCount: item.likeCount ?? 0,
            replyCount: item.replyCount ?? 0,
            retweetCount: item.retweetCount ?? 0,
            mediaJson: item.mediaJson,
            quotedTweetJson: item.quotedTweetJson,
            threadJson: item.threadJson,
            parentJson: item.parentJson,
            articleJson: item.articleJson,
          },
        });
      }),
    );
  }

  // Get new tweet IDs
  const newTweetRecords = newItems.length > 0
    ? await prisma.tweet.findMany({
        where: { tweetId: { in: newItems.map((i) => i.tweetId) } },
        select: { id: true },
      })
    : [];

  return {
    newCount: newItems.length,
    updateCount: updateItems.length,
    totalCount: items.length,
    newTweetIds: newTweetRecords.map((t) => t.id),
  };
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/archive/upsert-tweet-prisma.ts
git commit -m "feat: add tweet archive module with upsert dedup"
```

---

## Task 5: Tweet AI 增强模块 (enrich-tweet-prisma)

**Files:**
- Create: `src/archive/enrich-tweet-prisma.ts`

- [ ] **Step 1: 创建 Tweet enrichment 函数**

```typescript
import { prisma } from "../../lib/prisma";
import type { AiClient } from "../ai/types";
import { createLogger } from "../utils/logger";

const logger = createLogger("enrich-tweet");

export interface TweetEnrichResult {
  successCount: number;
  failCount: number;
  totalCount: number;
}

export interface TweetEnrichConfig {
  scoring: boolean;
  keyPoints: boolean;
  tagging: boolean;
  filterPrompt?: string;
}

export async function enrichTweets(
  tweetIds: string[],
  aiClient: AiClient,
  config: TweetEnrichConfig,
): Promise<TweetEnrichResult> {
  if (tweetIds.length === 0) {
    return { successCount: 0, failCount: 0, totalCount: 0 };
  }

  const tweets = await prisma.tweet.findMany({
    where: { id: { in: tweetIds } },
    select: { id: true, text: true, url: true, authorHandle: true },
  });

  let successCount = 0;
  let failCount = 0;

  for (const tweet of tweets) {
    try {
      const updates: Record<string, unknown> = {};

      if (config.scoring) {
        const score = await aiClient.scoreWithContent(
          `Tweet by @${tweet.authorHandle}`,
          tweet.text,
          tweet.url,
        ).catch(() => null);
        if (score !== null) updates.score = score;
      }

      if (config.keyPoints) {
        const summary = await aiClient.summarizeContent(
          `Tweet by @${tweet.authorHandle}`,
          tweet.text,
          150,
        ).catch(() => null);
        if (summary) updates.summary = summary;

        const bullets = await aiClient.extractKeyPoints(
          `Tweet by @${tweet.authorHandle}`,
          tweet.text,
          5,
        ).catch(() => null);
        if (bullets) updates.bullets = bullets;
      }

      if (config.tagging) {
        const categories = await aiClient.generateTags(
          `Tweet by @${tweet.authorHandle}`,
          tweet.text,
          3,
        ).catch(() => null);
        if (categories) updates.categories = categories;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.tweet.update({
          where: { id: tweet.id },
          data: updates,
        });
      }

      successCount++;
    } catch (err) {
      failCount++;
      logger.error(`Failed to enrich tweet ${tweet.id}:`, err);
    }
  }

  return { successCount, failCount, totalCount: tweets.length };
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/archive/enrich-tweet-prisma.ts
git commit -m "feat: add tweet AI enrichment module"
```

---

## Task 6: X 独立 Cron Job

**Files:**
- Create: `app/api/cron/collect-x/route.ts`
- Modify: `vercel.json`

**IMPORTANT**: Task 7 (X Adapter 兼容性修复) 应在 Task 6 之前执行。由于 Task 3 已从 SourceType 移除 x-*，x-bird.ts 的类型可能不兼容。先执行 Task 7 确保 `collectXBirdSource` 可正常 import，再创建 cron route。

- [ ] **Step 1: 创建 X cron route**

创建 `app/api/cron/collect-x/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { collectXBirdSource } from "../../../../src/adapters/x-bird";
import { parseRawItemsToTweetData, archiveTweets } from "../../../../src/archive/upsert-tweet-prisma";
import { enrichTweets } from "../../../../src/archive/enrich-tweet-prisma";
import { createAiClient } from "../../../../src/ai/providers";
import { prisma } from "../../../../lib/prisma";
import { createLogger } from "../../../../src/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const logger = createLogger("cron-collect-x");

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  runAfterJob("collect-x", async () => {
    try {
      const configs = await prisma.xPageConfig.findMany({
        where: { enabled: true },
      });

      if (configs.length === 0) {
        logger.info("No enabled X configs found");
        return;
      }

      const aiClient = createAiClient();
      let totalCollected = 0;
      let totalNew = 0;
      const allNewTweetIds: string[] = [];

      for (const config of configs) {
        try {
          let sources: Array<{ type: string; id: string; url: string; configJson: string }> = [];

          if (config.tab === "lists" && config.listsJson) {
            // Lists tab: create a source per list
            const lists: Array<{ listId: string; name?: string }> = JSON.parse(config.listsJson);
            sources = lists.map((list) => ({
              type: "x-list",
              id: `x-list-${list.listId}`,
              url: `https://x.com/i/lists/${list.listId}`,
              configJson: JSON.stringify({
                birdMode: "list",
                listId: list.listId,
                count: config.count,
                fetchAll: config.fetchAll,
                maxPages: config.maxPages,
                authTokenEnv: config.authTokenEnv,
                ct0Env: config.ct0Env,
              }),
            }));
          } else {
            sources = [{
              type: `x-${config.birdMode}`,
              id: `x-${config.tab}`,
              url: "https://x.com",
              configJson: JSON.stringify({
                birdMode: config.birdMode,
                count: config.count,
                fetchAll: config.fetchAll,
                maxPages: config.maxPages,
                authTokenEnv: config.authTokenEnv,
                ct0Env: config.ct0Env,
              }),
            }];
          }

          for (const source of sources) {
            try {
              const rawItems = await collectXBirdSource(source as never);
              const tweetData = parseRawItemsToTweetData(rawItems, config.tab);
              const result = await archiveTweets(tweetData);
              totalCollected += result.totalCount;
              totalNew += result.newCount;
              allNewTweetIds.push(...result.newTweetIds);
              logger.info(`[${config.tab}] Collected ${result.totalCount}, new ${result.newCount}`);
            } catch (err) {
              logger.error(`[${config.tab}] Collection failed:`, err);
            }
          }
        } catch (err) {
          logger.error(`[${config.tab}] Tab processing failed:`, err);
        }
      }

      // Enrich new tweets
      if (aiClient && allNewTweetIds.length > 0) {
        const mainConfig = configs.find((c) => c.enrichEnabled);
        if (mainConfig) {
          const result = await enrichTweets(allNewTweetIds, aiClient, {
            scoring: mainConfig.enrichScoring,
            keyPoints: mainConfig.enrichKeyPoints,
            tagging: mainConfig.enrichTagging,
            filterPrompt: mainConfig.filterPrompt ?? undefined,
          });
          logger.info(`Enriched ${result.successCount}/${result.totalCount} tweets`);
        }
      }

      logger.info(`Total: collected ${totalCollected}, new ${totalNew}`);
    } catch (err) {
      logger.error("X cron job failed:", err);
    }
  });

  return NextResponse.json({ success: true, message: "X collect job started" }, { status: 202 });
}
```

- [ ] **Step 2: 注册 X cron 到 vercel.json**

在 `vercel.json` 的 `crons` 数组中添加:

```json
{ "path": "/api/cron/collect-x", "schedule": "0 */30 * * * *" }
```

- [ ] **Step 3: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误（注意 `collectXBirdSource` 的参数类型可能需要 `as never` 绕过，因为 Source 类型已移除 x-*。如果编译失败，需要在 Task 7 中处理 adapter 兼容性）

- [ ] **Step 4: Build 验证**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/collect-x/route.ts vercel.json
git commit -m "feat: add X/Twitter independent cron job"
```

---

## Task 7: X Adapter 兼容性修复 (MUST execute before Task 6)

**Files:**
- Modify: `src/adapters/x-bird.ts`

**NOTE**: 此任务必须在 Task 6 之前执行。Task 3 从 SourceType 移除了 x-*，可能导致 x-bird.ts 编译失败。

- [ ] **Step 1: 确保 x-bird adapter 可被 X cron 独立 import**

检查 `src/adapters/x-bird.ts` 的 import。如果它 import 了 `SourceType` 或其他已移除 x-* 的类型，需要修复。

关键点:
- `collectXBirdSource` 的参数类型是 `Source`（来自 `src/types/index.ts`）
- 由于 `SourceType` 已移除 x-*，但 `Source` 类型本身可能仍然通用
- 如果 `collectXBirdSource` 内部有 `as SourceType` 断言指向 x-*，需要改为 string 或移除断言

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit (如有变更)**

```bash
git add src/adapters/x-bird.ts
git commit -m "fix: update x-bird adapter for standalone usage"
```

---

## Task 8: Tweet API — 列表 + 收藏

**Files:**
- Create: `app/api/tweets/route.ts`
- Create: `app/api/tweet-bookmarks/route.ts`
- Create: `app/api/tweet-bookmarks/[id]/route.ts`

- [ ] **Step 1: 创建 Tweet 列表 API**

创建 `app/api/tweets/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "bookmarks";
  const window = searchParams.get("window") || "week";
  const sort = searchParams.get("sort") || "ranked";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const search = searchParams.get("search") || "";

  // Calculate time window
  const now = new Date();
  const windowMap: Record<string, number> = {
    today: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };
  const windowMs = windowMap[window] || windowMap.week;
  const since = new Date(now.getTime() - windowMs);

  // Build where clause
  const where: Record<string, unknown> = {
    tab,
    fetchedAt: { gte: since },
  };
  if (search) {
    where.OR = [
      { text: { contains: search, mode: "insensitive" } },
      { authorHandle: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }

  // Build order by
  const orderBy: Record<string, string> =
    sort === "engagement"
      ? { likeCount: "desc" }
      : sort === "recent"
        ? { fetchedAt: "desc" }
        : { score: "desc" };

  const [tweets, total] = await Promise.all([
    prisma.tweet.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { bookmarks: true },
    }),
    prisma.tweet.count({ where }),
  ]);

  // Get bookmark status
  const allBookmarks = await prisma.tweetBookmark.findMany({
    select: { tweetId: true },
  });
  const bookmarkedIds = new Set(allBookmarks.map((b) => b.tweetId));

  const items = tweets.map((t) => ({
    id: t.id,
    tweetId: t.tweetId,
    tab: t.tab,
    text: t.text,
    url: t.url,
    expandedUrl: t.expandedUrl,
    publishedAt: t.publishedAt?.toISOString(),
    fetchedAt: t.fetchedAt.toISOString(),
    authorHandle: t.authorHandle,
    authorName: t.authorName,
    likeCount: t.likeCount,
    replyCount: t.replyCount,
    retweetCount: t.retweetCount,
    summary: t.summary,
    bullets: t.bullets,
    categories: t.categories,
    score: t.score,
    isBookmarked: bookmarkedIds.has(t.id),
    media: t.mediaJson ? JSON.parse(t.mediaJson) : undefined,
    quotedTweet: t.quotedTweetJson ? JSON.parse(t.quotedTweetJson) : undefined,
    thread: t.threadJson ? JSON.parse(t.threadJson) : undefined,
    parent: t.parentJson ? JSON.parse(t.parentJson) : undefined,
    article: t.articleJson ? JSON.parse(t.articleJson) : undefined,
  }));

  return NextResponse.json({
    success: true,
    data: {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
}
```

- [ ] **Step 2: 创建 Tweet 收藏列表 API**

创建 `app/api/tweet-bookmarks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const bookmarks = await prisma.tweetBookmark.findMany({
    orderBy: { bookmarkedAt: "desc" },
    include: {
      tweet: {
        include: { bookmarks: true },
      },
    },
  });

  const items = bookmarks.map((b) => ({
    id: b.tweet.id,
    tweetId: b.tweet.tweetId,
    tab: b.tweet.tab,
    text: b.tweet.text,
    url: b.tweet.url,
    expandedUrl: b.tweet.expandedUrl,
    publishedAt: b.tweet.publishedAt?.toISOString(),
    fetchedAt: b.tweet.fetchedAt.toISOString(),
    authorHandle: b.tweet.authorHandle,
    authorName: b.tweet.authorName,
    likeCount: b.tweet.likeCount,
    replyCount: b.tweet.replyCount,
    retweetCount: b.tweet.retweetCount,
    summary: b.tweet.summary,
    bullets: b.tweet.bullets,
    categories: b.tweet.categories,
    score: b.tweet.score,
    isBookmarked: true,
    bookmarkedAt: b.bookmarkedAt.toISOString(),
    media: b.tweet.mediaJson ? JSON.parse(b.tweet.mediaJson) : undefined,
    quotedTweet: b.tweet.quotedTweetJson ? JSON.parse(b.tweet.quotedTweetJson) : undefined,
    thread: b.tweet.threadJson ? JSON.parse(b.tweet.threadJson) : undefined,
    parent: b.tweet.parentJson ? JSON.parse(b.tweet.parentJson) : undefined,
    article: b.tweet.articleJson ? JSON.parse(b.tweet.articleJson) : undefined,
  }));

  return NextResponse.json({
    success: true,
    data: { items, meta: { total: items.length } },
  });
}
```

- [ ] **Step 3: 创建 Tweet 收藏增删 API**

创建 `app/api/tweet-bookmarks/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Check tweet exists
  const tweet = await prisma.tweet.findUnique({ where: { id } });
  if (!tweet) {
    return NextResponse.json({ success: false, error: "Tweet not found" }, { status: 404 });
  }

  // Upsert bookmark (toggle-safe)
  const bookmark = await prisma.tweetBookmark.upsert({
    where: { tweetId: id },
    create: { tweetId: id },
    update: {},
  });

  return NextResponse.json({
    success: true,
    data: { bookmarkedAt: bookmark.bookmarkedAt.toISOString() },
  });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const deleted = await prisma.tweetBookmark.deleteMany({ where: { tweetId: id } });
  if (deleted.count === 0) {
    return NextResponse.json({ success: false, error: "Not bookmarked" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: { bookmarkedAt: null },
  });
}
```

- [ ] **Step 4: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add app/api/tweets/ app/api/tweet-bookmarks/
git commit -m "feat: add tweet list and bookmark APIs"
```

---

## Task 9: X 配置 API

**Files:**
- Create: `app/api/x-config/route.ts`

- [ ] **Step 1: 创建 X 配置 API**

创建 `app/api/x-config/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_CONFIGS = [
  { tab: "home", birdMode: "home" },
  { tab: "bookmarks", birdMode: "bookmarks" },
  { tab: "likes", birdMode: "likes" },
  { tab: "lists", birdMode: "list" },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");

  // Ensure default configs exist
  for (const dc of DEFAULT_CONFIGS) {
    const exists = await prisma.xPageConfig.findUnique({ where: { tab: dc.tab } });
    if (!exists) {
      await prisma.xPageConfig.create({ data: dc });
    }
  }

  if (tab) {
    const config = await prisma.xPageConfig.findUnique({ where: { tab } });
    if (!config) {
      return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: config });
  }

  const configs = await prisma.xPageConfig.findMany({ orderBy: { tab: "asc" } });
  return NextResponse.json({ success: true, data: configs });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const tab = body.tab;

  if (!tab) {
    return NextResponse.json({ success: false, error: "tab is required" }, { status: 400 });
  }

  const config = await prisma.xPageConfig.upsert({
    where: { tab },
    create: {
      tab,
      enabled: body.enabled ?? true,
      birdMode: body.birdMode || tab,
      count: body.count ?? 20,
      fetchAll: body.fetchAll ?? false,
      maxPages: body.maxPages,
      authTokenEnv: body.authTokenEnv,
      ct0Env: body.ct0Env,
      listsJson: body.listsJson,
      filterPrompt: body.filterPrompt,
      enrichEnabled: body.enrichEnabled ?? true,
      enrichScoring: body.enrichScoring ?? true,
      enrichKeyPoints: body.enrichKeyPoints ?? true,
      enrichTagging: body.enrichTagging ?? true,
      timeWindow: body.timeWindow ?? "week",
      sortOrder: body.sortOrder ?? "ranked",
    },
    update: {
      enabled: body.enabled,
      birdMode: body.birdMode,
      count: body.count,
      fetchAll: body.fetchAll,
      maxPages: body.maxPages,
      authTokenEnv: body.authTokenEnv,
      ct0Env: body.ct0Env,
      listsJson: body.listsJson,
      filterPrompt: body.filterPrompt,
      enrichEnabled: body.enrichEnabled,
      enrichScoring: body.enrichScoring,
      enrichKeyPoints: body.enrichKeyPoints,
      enrichTagging: body.enrichTagging,
      timeWindow: body.timeWindow,
      sortOrder: body.sortOrder,
    },
  });

  return NextResponse.json({ success: true, data: config });
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add app/api/x-config/
git commit -m "feat: add X page configuration API"
```

---

## Task 10: API Client 扩展

**Files:**
- Modify: `lib/api-client.ts`

- [ ] **Step 1: 在 api-client.ts 末尾添加 Tweet 相关函数**

```typescript
// ── Tweet API ──

export interface FetchTweetsParams {
  tab?: string
  window?: "today" | "week" | "month"
  sort?: "ranked" | "recent" | "engagement"
  page?: number
  pageSize?: number
  search?: string
}

export async function fetchTweets(params: FetchTweetsParams = {}): Promise<{
  items: Tweet[]
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
}> {
  const sp = new URLSearchParams();
  if (params.tab) sp.set("tab", params.tab);
  if (params.window) sp.set("window", params.window);
  if (params.sort) sp.set("sort", params.sort);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.search) sp.set("search", params.search);

  const res = await fetchApi<{ items: Tweet[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } }>(
    `/api/tweets?${sp.toString()}`,
  );
  return { items: res.data.items, pagination: res.data.pagination };
}

export async function fetchTweetBookmarks(): Promise<Tweet[]> {
  const res = await fetchApi<{ items: Tweet[] }>("/api/tweet-bookmarks");
  return res.data.items;
}

export async function addTweetBookmark(id: string): Promise<{ success: boolean; bookmarkedAt?: string }> {
  const res = await fetchApi<{ bookmarkedAt: string }>(`/api/tweet-bookmarks/${id}`, {
    method: "POST",
  });
  return { success: true, bookmarkedAt: res.data.bookmarkedAt };
}

export async function removeTweetBookmark(id: string): Promise<{ success: boolean }> {
  await fetchApi<null>(`/api/tweet-bookmarks/${id}`, { method: "DELETE" });
  return { success: true };
}

export async function fetchXConfig(tab?: string): Promise<XPageConfigData[]> {
  const sp = tab ? `?tab=${tab}` : "";
  const res = await fetchApi<XPageConfigData[] | XPageConfigData>(`/api/x-config${sp}`);
  return Array.isArray(res.data) ? res.data : [res.data];
}

export async function updateXConfig(config: Partial<XPageConfigData> & { tab: string }): Promise<XPageConfigData> {
  const res = await fetchApi<XPageConfigData>("/api/x-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.data;
}
```

注意: 需要在文件顶部添加 `Tweet` 和 `XPageConfigData` 的 import（从 `lib/types.ts`）。

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add lib/api-client.ts
git commit -m "feat: extend API client with tweet functions"
```

---

## Task 11: SWR Hooks

**Files:**
- Create: `hooks/use-x-config.ts`
- Create: `hooks/use-tweets.ts`

- [ ] **Step 1: 创建 use-x-config.ts**

```typescript
import useSWR from "swr";
import { fetchXConfig, updateXConfig } from "@/lib/api-client";
import type { XPageConfigData } from "@/lib/types";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  return json.data;
}

export function useXConfig(tab?: string) {
  const key = tab ? `/api/x-config?tab=${tab}` : "/api/x-config";

  const { data, error, isLoading, mutate } = useSWR<XPageConfigData[]>(
    key,
    (url: string) => fetcher<XPageConfigData[]>(url),
    { revalidateOnFocus: false, dedupingInterval: 5000 },
  );

  const update = async (config: Partial<XPageConfigData> & { tab: string }) => {
    await updateXConfig(config as Parameters<typeof updateXConfig>[0]);
    await mutate();
  };

  return { configs: data ?? [], error, loading: isLoading, update };
}
```

- [ ] **Step 2: 创建 use-tweets.ts**

```typescript
import { useState, useCallback, useMemo } from "react";
import { fetchTweets, addTweetBookmark, removeTweetBookmark } from "@/lib/api-client";
import type { Tweet } from "@/lib/types";

interface UseTweetsParams {
  tab?: string;
  window?: "today" | "week" | "month";
  sort?: "ranked" | "recent" | "engagement";
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export function useTweets(params: UseTweetsParams = {}) {
  const [items, setItems] = useState<Tweet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTweets(params);
      setItems(result.items);
      setTotal(result.pagination.total);
      setSavedIds(new Set(result.items.filter((i) => i.isBookmarked).map((i) => i.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tweets");
    } finally {
      setLoading(false);
    }
  }, [params.tab, params.window, params.sort, params.page, params.pageSize, params.searchQuery]);

  const toggleSave = useCallback(async (id: string) => {
    const isSaved = savedIds.has(id);
    try {
      if (isSaved) {
        await removeTweetBookmark(id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await addTweetBookmark(id);
        setSavedIds((prev) => new Set(prev).add(id));
      }
    } catch {
      // Silently fail for bookmark operations
    }
  }, [savedIds]);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { items, total, loading, error, refetch, toggleSave, isSaved };
}
```

- [ ] **Step 3: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add hooks/use-x-config.ts hooks/use-tweets.ts
git commit -m "feat: add SWR hooks for tweets and X config"
```

---

## Task 12: TweetCard 组件

**Files:**
- Create: `components/tweet-card.tsx`

- [ ] **Step 1: 创建 TweetCard 组件**

```typescript
"use client"

import { Heart, MessageCircle, Repeat2, Bookmark, ExternalLink } from "lucide-react"
import { formatEngagement } from "@/lib/tweet-utils"
import type { Tweet } from "@/lib/types"

interface TweetCardProps {
  tweet: Tweet
  isSaved: boolean
  onToggleSave: (id: string) => void
}

export function TweetCard({ tweet, isSaved, onToggleSave }: TweetCardProps) {
  return (
    <div className="border rounded-xl p-4 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {tweet.authorHandle[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">{tweet.authorName || tweet.authorHandle}</div>
            <div className="text-xs text-muted-foreground">@{tweet.authorHandle}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            {tweet.publishedAt ? new Date(tweet.publishedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{tweet.text}</div>

      {/* Quoted Tweet */}
      {tweet.quotedTweet && (
        <div className="border rounded-lg p-2.5 mb-3 bg-muted/50">
          <div className="font-medium text-xs text-muted-foreground mb-1">@{tweet.quotedTweet.authorHandle}</div>
          <div className="text-xs leading-relaxed line-clamp-3">{tweet.quotedTweet.text}</div>
          <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
            <span>❤ {formatEngagement(tweet.quotedTweet.likeCount)}</span>
            <span>💬 {formatEngagement(tweet.quotedTweet.replyCount)}</span>
            <span>🔁 {formatEngagement(tweet.quotedTweet.retweetCount)}</span>
          </div>
        </div>
      )}

      {/* Article Preview */}
      {tweet.article && (
        <a
          href={tweet.article.url || tweet.expandedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border rounded-lg p-2.5 mb-3 hover:bg-muted/50 transition-colors"
        >
          <div className="text-sm font-medium line-clamp-2">{tweet.article.title}</div>
          {tweet.article.previewText && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{tweet.article.previewText}</div>
          )}
        </a>
      )}

      {/* AI Section */}
      {(tweet.summary || (tweet.bullets && tweet.bullets.length > 0) || (tweet.categories && tweet.categories.length > 0)) && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 mb-3 border-l-3 border-l-blue-500">
          {tweet.summary && (
            <div>
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">AI 摘要</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{tweet.summary}</div>
            </div>
          )}
          {tweet.bullets && tweet.bullets.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">关键要点</div>
              {tweet.bullets.map((bullet, i) => (
                <div key={i} className="text-xs text-muted-foreground leading-relaxed">• {bullet}</div>
              ))}
            </div>
          )}
          {tweet.categories && tweet.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tweet.categories.map((cat) => (
                <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagement Bar */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground pt-2.5 border-t">
        <span className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          {formatEngagement(tweet.likeCount)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" />
          {formatEngagement(tweet.replyCount)}
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 className="w-3.5 h-3.5" />
          {formatEngagement(tweet.retweetCount)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onToggleSave(tweet.id)}
            className={`p-1 rounded-md transition-colors ${isSaved ? "text-blue-500" : "hover:bg-muted"}`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
          <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-muted transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add components/tweet-card.tsx
git commit -m "feat: add TweetCard component"
```

---

## Task 13: X Page 主组件

**Files:**
- Create: `components/x-page.tsx`

- [ ] **Step 1: 创建 XPage 组件**

```typescript
"use client"

import { useEffect, useState } from "react"
import { Search, ArrowUpDown, Settings, ChevronLeft, ChevronRight } from "lucide-react"
import { TweetCard } from "@/components/tweet-card"
import { useTweets } from "@/hooks/use-tweets"
import { useXConfig } from "@/hooks/use-x-config"
import type { XTab } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const TABS: Array<{ id: XTab; label: string }> = [
  { id: "bookmarks", label: "Bookmarks" },
  { id: "likes", label: "Likes" },
  { id: "home", label: "Home" },
  { id: "lists", label: "Lists" },
]

export function XPage() {
  const [activeTab, setActiveTab] = useState<XTab>("bookmarks")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"ranked" | "recent" | "engagement">("ranked")
  const [timeWindow, setTimeWindow] = useState<"today" | "week" | "month">("week")
  const [page, setPage] = useState(1)
  const [showConfig, setShowConfig] = useState(false)

  const { configs } = useXConfig()
  const { items, total, loading, refetch, toggleSave, isSaved } = useTweets({
    tab: activeTab,
    sort: sortOrder,
    window: timeWindow,
    page,
    pageSize: 20,
    searchQuery: searchQuery || undefined,
  })

  const totalPages = Math.ceil(total / 20)

  // Refetch when params change
  useEffect(() => {
    setPage(1)
  }, [activeTab, sortOrder, timeWindow])

  useEffect(() => {
    refetch()
  }, [refetch, activeTab, sortOrder, timeWindow, page, searchQuery])

  const currentConfig = configs.find((c) => c.tab === activeTab)
  const effectiveWindow = currentConfig?.timeWindow === "today" || currentConfig?.timeWindow === "month"
    ? currentConfig.timeWindow
    : timeWindow
  const effectiveSort = currentConfig?.sortOrder === "recent" || currentConfig?.sortOrder === "engagement"
    ? currentConfig.sortOrder
    : sortOrder

  return (
    <div className="flex flex-col h-full">
      {/* Tabs + Filters Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        {/* Pill Tabs */}
        <div className="flex bg-muted rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索推文..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 w-40 text-xs"
            />
          </div>
          <select
            value={effectiveWindow}
            onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
            className="h-7 px-2 text-xs border rounded-md bg-background"
          >
            <option value="today">今天</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
          </select>
          <select
            value={effectiveSort}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="h-7 px-2 text-xs border rounded-md bg-background"
          >
            <option value="ranked">AI 排序</option>
            <option value="recent">最新</option>
            <option value="engagement">互动量</option>
          </select>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="配置"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Config Panel (collapsible) */}
      {showConfig && (
        <div className="border-b p-4 bg-muted/30 text-xs text-muted-foreground">
          {currentConfig ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="font-medium text-foreground">状态:</span>{" "}
                {currentConfig.enabled ? "启用" : "禁用"}
              </div>
              <div>
                <span className="font-medium text-foreground">模式:</span> {currentConfig.birdMode}
              </div>
              <div>
                <span className="font-medium text-foreground">数量:</span> {currentConfig.count}
              </div>
              <div>
                <span className="font-medium text-foreground">Enrichment:</span>{" "}
                {currentConfig.enrichEnabled ? "启用" : "禁用"}
              </div>
              <div>
                <span className="font-medium text-foreground">AI 评分:</span>{" "}
                {currentConfig.enrichScoring ? "是" : "否"}
              </div>
              <div>
                <span className="font-medium text-foreground">AI 要点:</span>{" "}
                {currentConfig.enrichKeyPoints ? "是" : "否"}
              </div>
            </div>
          ) : (
            <div>加载配置中...</div>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无推文</div>
        ) : (
          items.map((tweet) => (
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              isSaved={isSaved(tweet.id)}
              onToggleSave={toggleSave}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add components/x-page.tsx
git commit -m "feat: add XPage main component"
```

---

## Task 14: X 路由页面

**Files:**
- Create: `app/x/page.tsx`

- [ ] **Step 1: 创建 X 路由页面**

```typescript
"use client"

import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { XPage } from "@/components/x-page"
import type { NavId } from "@/components/sidebar"

export default function XRoute() {
  const router = useRouter()

  const handleNav = (navId: NavId) => {
    switch (navId) {
      case "daily":
        router.push("/daily")
        break
      case "weekly":
        router.push("/weekly")
        break
      case "saved":
        router.push("/saved")
        break
      case "config":
        router.push("/config")
        break
      case "x":
        router.push("/x")
        break
      default:
        router.push("/")
    }
  }

  return (
    <AppLayout activeNav="x" onNav={handleNav}>
      {/* XPage 不需要 ReadingPanel，所以不接受 render props */}
      {() => <XPage />}
    </AppLayout>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add app/x/page.tsx
git commit -m "feat: add X route page"
```

---

## Task 15: 导航集成 — 侧边栏 + Topbar + handleNav

**Files:**
- Modify: `components/sidebar.tsx`
- Modify: `components/topbar.tsx`
- Modify: `app/page.tsx`
- Modify: `app/daily/page.tsx`
- Modify: `app/weekly/page.tsx`
- Modify: `app/saved/page.tsx`
- Modify: `app/config/page.tsx`

- [ ] **Step 1: 侧边栏添加「社交」分组**

在 `components/sidebar.tsx` 中:

1. 在 lucide-react import 中添加 `AtSign` 图标
2. 在 `EDITIONS` 常量之后添加社交导航:

```typescript
const SOCIAL_NAV = [
  { id: "x" as NavId, label: "X / Twitter", sublabel: "Social", icon: AtSign },
]
```

3. 在渲染导航项的 JSX 中，在「简报」section 之后、「我的视图」section 之前，添加「社交」section:

```tsx
{/* 社交 */}
{SOCIAL_NAV.map((item) => (
  <button
    key={item.id}
    onClick={() => onNav(item.id)}
    className={cn(
      "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
      activeNav === item.id
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:text-foreground",
      collapsed && "justify-center px-0"
    )}
    title={collapsed ? item.label : undefined}
  >
    <item.icon className="w-4 h-4 shrink-0" />
    {!collapsed && (
      <div className="text-left min-w-0">
        <div className="font-medium truncate">{item.label}</div>
      </div>
    )}
  </button>
))}
```

- [ ] **Step 2: Topbar 添加 X 页面标题**

在 `components/topbar.tsx` 的 `PAGE_TITLES` 对象中添加:

```typescript
x: { title: "X / Twitter", subtitle: "Social Feed" },
```

- [ ] **Step 3: 所有路由页面的 handleNav 添加 "x" case**

在以下 5 个文件的 `handleNav` switch 中，在 `case "config"` 之后、`default:` 之前添加:

```typescript
case "x":
  router.push("/x")
  break
```

文件列表:
- `app/page.tsx`
- `app/daily/page.tsx`
- `app/weekly/page.tsx`
- `app/saved/page.tsx`
- `app/config/page.tsx`
- `app/view/[id]/page.tsx`

- [ ] **Step 4: TypeScript 检查**

Run: `pnpm check`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add components/sidebar.tsx components/topbar.tsx app/page.tsx app/daily/page.tsx app/weekly/page.tsx app/saved/page.tsx app/config/page.tsx app/view/\[id\]/page.tsx
git commit -m "feat: integrate X page into sidebar, topbar, and navigation"
```

---

## Task 16: Build 验证 + 清理 + 数据库迁移

**Files:**
- Modify: `config/packs/` (删除 x-*.yaml)
- Database: 清理现有 x-* Item/Source 记录

- [ ] **Step 1: 删除 X 相关 YAML 配置文件**

```bash
rm config/packs/x-home.yaml config/packs/x-bookmarks.yaml config/packs/x-likes.yaml config/packs/x-lists.yaml
```

- [ ] **Step 2: 清理数据库中现有 X 数据**

按设计 spec 要求，先删 Item 再删 Source（避免外键约束报错）:

```sql
-- 先删除 x-* Item 记录
DELETE FROM "Item" WHERE "sourceType" IN ('x-home', 'x-list', 'x-bookmarks', 'x-likes');

-- 再删除 x-* Source 记录
DELETE FROM "Source" WHERE "type" IN ('x-home', 'x-list', 'x-bookmarks', 'x-likes');
```

可通过 Supabase Dashboard SQL Editor 或 pnpm exec prisma db execute 执行。

- [ ] **Step 3: Build 验证**

Run: `pnpm build`
Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add -u config/packs/
git commit -m "chore: remove X YAML config files, replaced by XPageConfig"
```

---

## Task 17: 前端视觉验证

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`

- [ ] **Step 2: 使用 playwriter 验证**

```
/playwriter
```

验证场景:
- 侧边栏「社交」分组显示 X / Twitter 入口
- 点击进入 /x 页面
- Tab 切换 (Bookmarks / Likes / Home / Lists) 正常
- 过滤栏（搜索、时间窗口、排序）可用
- TweetCard 展示正确（作者、正文、AI 要点、engagement、收藏按钮）
- 收藏 toggle 正常
- 跳转 X 原站链接正常
- 分页功能正常

- [ ] **Step 3: 清理 playwriter session**

```bash
playwriter session delete <id>
```
