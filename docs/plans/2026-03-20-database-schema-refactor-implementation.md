# 数据库 Schema 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构数据库 schema，修复 ID 格式、移除冗余字段、拆分配置表、添加前端展示

**Architecture:** 分 6 个阶段实施，每个阶段独立可回滚。低风险任务优先，高风险 ID 迁移放在后期。

**Tech Stack:** Prisma ORM, PostgreSQL (Supabase), Next.js API Routes, React Components

---

## 阶段 1: 移除 Spotlight 功能

### Task 1.1: 修改 Prisma Schema - 移除 spotlightIds

**Files:**
- Modify: `prisma/schema.prisma:113-124` (DailyOverview model)
- Modify: `prisma/schema.prisma:213-227` (DailyReportConfig model)

**Step 1: 修改 DailyOverview 模型**

```prisma
model DailyOverview {
  id           String   @id @default(cuid())
  date         String   @unique
  dayLabel     String
  summary      String   @db.Text

  itemIds      String[]  // 移除 spotlightIds

  createdAt    DateTime @default(now())
}
```

**Step 2: 修改 DailyReportConfig 模型**

```prisma
model DailyReportConfig {
  id                  String   @id @default("default")

  packs               String   @default("all")
  maxItems            Int      @default(20)
  // 移除: maxSpotlight
  sort                String   @default("ranked")

  enableOverview      Boolean  @default(true)

  newsFlashesEnabled  Boolean  @default(true)
  newsFlashesMaxCount Int      @default(12)

  updatedAt DateTime @updatedAt
}
```

**Step 3: 生成迁移**

Run: `pnpm prisma migrate dev --name remove-spotlight-fields`
Expected: Migration created successfully

**Step 4: 应用迁移到 Supabase**

Run: `pnpm prisma db push`
Expected: Database schema updated

---

### Task 1.2: 修改日报生成逻辑

**Files:**
- Modify: `src/reports/daily.ts`

**Step 1: 更新接口定义**

```typescript
// 移除 maxSpotlight
export interface DailyGenerateConfig {
  maxItems: number;
}

const DEFAULT_CONFIG: DailyGenerateConfig = {
  maxItems: 20,
};

// 移除 spotlightCount
export interface DailyGenerateResult {
  date: string;
  itemCount: number;
}
```

**Step 2: 移除 spotlight 逻辑**

在 `generateDailyReport` 函数中：

```typescript
// 移除这些行:
// const { maxItems, maxSpotlight } = mergedConfig;
// const spotlightItems = items.slice(0, maxSpotlight);
// const spotlightIds = spotlightItems.map((i) => i.id);

// 保留:
const { maxItems } = mergedConfig;
const itemIds = items.map((i) => i.id);

// upsert 中移除 spotlightIds:
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

// 返回中移除 spotlightCount:
return {
  date,
  itemCount: items.length,
};
```

**Step 3: 运行构建验证**

Run: `pnpm build`
Expected: Build succeeds with no errors

---

### Task 1.3: 修改周报生成逻辑

**Files:**
- Modify: `src/reports/weekly.ts:134-144`

**Step 1: 移除 spotlightIds 临时数据**

```typescript
// 修改前:
dailyOverviews = Array.from(itemsByDate.entries()).map(([d, items]) => ({
  id: `temp-${d}`,
  createdAt: new Date(),
  date: d,
  dayLabel: formatDayLabel(new Date(d)),
  summary: "",
  itemIds: items.slice(0, maxItemsPerDay).map((i) => i.id),
  spotlightIds: items.slice(0, 2).map((i) => i.id),  // 移除这行
}));

// 修改后:
dailyOverviews = Array.from(itemsByDate.entries()).map(([d, items]) => ({
  id: `temp-${d}`,
  createdAt: new Date(),
  date: d,
  dayLabel: formatDayLabel(new Date(d)),
  summary: "",
  itemIds: items.slice(0, maxItemsPerDay).map((i) => i.id),
}));
```

**Step 2: 运行构建验证**

Run: `pnpm build`
Expected: Build succeeds

---

### Task 1.4: 修改 CLI 命令

**Files:**
- Modify: `src/cli/commands/daily.ts:46-48`

**Step 1: 移除 spotlightCount 输出**

```typescript
// 修改前:
console.log(`Daily report generated for ${date}:`);
console.log(`  Items: ${result.itemCount}`);
console.log(`  Spotlight: ${result.spotlightCount}`);

// 修改后:
console.log(`Daily report generated for ${date}:`);
console.log(`  Items: ${result.itemCount}`);
```

---

### Task 1.5: 修改配置 schema

**Files:**
- Modify: `src/config/reports-schema.ts:1-11`
- Modify: `config/reports/daily.yaml`

**Step 1: 更新 TypeScript 接口**

```typescript
export interface DailyReportConfig {
  packs: "all" | string[]
  maxItems: number
  // 移除: maxSpotlight: number
  sort: "ranked" | "recent"
  enableOverview: boolean
  newsFlashes: {
    enabled: boolean
    maxCount: number
  }
}
```

**Step 2: 更新 YAML 配置**

```yaml
# config/reports/daily.yaml
daily:
  packs: all
  maxItems: 20
  # 移除: maxSpotlight: 3
  sort: ranked
  enableOverview: true
  newsFlashes:
    enabled: true
    maxCount: 12
```

---

### Task 1.6: 修改日报 API 路由

**Files:**
- Modify: `app/api/daily/route.ts`

**Step 1: 简化 API 响应结构**

```typescript
// 修改无日报数据时的响应:
if (!overview) {
  return NextResponse.json({
    success: true,
    data: {
      overview: null,
      articles: items.map(toArticle),  // 合并，不再区分
      newsFlashes: [],
    },
    // ...
  })
}

// 修改有日报数据时的查询和处理:
const items = await prisma.item.findMany({
  where: { id: { in: overview.itemIds } },
});

const itemMap = new Map(items.map((i) => [i.id, i]))
const articles = overview.itemIds
  .map((id) => itemMap.get(id))
  .filter((item): item is NonNullable<typeof item> => item !== undefined)
  .map(toArticle)

// 修改响应:
return NextResponse.json({
  success: true,
  data: {
    overview: {
      date: overview.date,
      summary: overview.summary,
    },
    articles,  // 合并后的文章列表
    newsFlashes: newsFlashes.map((f) => ({
      id: f.id,
      time: f.time,
      text: f.text,
    })),
  },
  // ...
})
```

---

### Task 1.7: 修改 API 客户端类型

**Files:**
- Modify: `lib/api-client.ts:96-101`

**Step 1: 更新 DailyData 接口**

```typescript
// 修改前:
interface DailyData {
  overview: DailyOverview
  spotlightArticles: Article[]
  recommendedArticles: Article[]
  newsFlashes: NewsFlash[]
}

// 修改后:
interface DailyData {
  overview: DailyOverview | null
  articles: Article[]  // 合并
  newsFlashes: NewsFlash[]
}
```

---

### Task 1.8: 修改日报前端组件

**Files:**
- Modify: `components/daily-page.tsx:145-148`

**Step 1: 更新数据处理**

```typescript
// 修改前:
if (dailyData) {
  setOverview(dailyData.overview)
  // Merge spotlight + recommended articles
  setArticles([...dailyData.spotlightArticles, ...dailyData.recommendedArticles])
}

// 修改后:
if (dailyData) {
  setOverview(dailyData.overview)
  setArticles(dailyData.articles)  // 直接使用合并后的列表
}
```

---

### Task 1.9: 阶段 1 提交

Run: `pnpm build`
Expected: Build succeeds

```bash
git add -A
git commit -m "refactor: remove spotlight feature from daily reports

- Remove spotlightIds from DailyOverview model
- Remove maxSpotlight from DailyReportConfig model
- Merge spotlightArticles and recommendedArticles into single articles list
- Update API, client, and frontend components
"
```

---

## 阶段 2: Settings 表重构

### Task 2.1: 创建 ProviderConfig 模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加 ProviderConfig 模型**

在 Settings 模型后添加：

```prisma
model ProviderConfig {
  id          String   @id @default(cuid())
  provider    String   @unique  // anthropic, gemini, openai
  model       String
  baseUrl     String?
  apiKeyRef   String?  // 环境变量引用
  extraConfig String?  @db.Text

  updatedAt DateTime @updatedAt
}
```

**Step 2: 修改 Settings 模型**

```prisma
model Settings {
  id            String   @id @default("default")

  provider      String   @default("anthropic")  // 移除 default 前缀
  batchSize     Int      @default(3)
  concurrency   Int      @default(1)

  maxRetries    Int      @default(3)
  initialDelay  Int      @default(1000)
  maxDelay      Int      @default(30000)
  backoffFactor Float    @default(2.0)

  // 移除: anthropicConfig, geminiConfig, openaiConfig

  updatedAt DateTime @updatedAt
}
```

**Step 3: 生成并应用迁移**

Run: `pnpm prisma migrate dev --name refactor-settings-add-provider-config`
Expected: Migration created

---

### Task 2.2: 创建数据迁移脚本

**Files:**
- Create: `scripts/migrate-provider-config.ts`

**Step 1: 编写迁移脚本**

```typescript
/**
 * 将 Settings 中的 provider 配置迁移到 ProviderConfig 表
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface OldSettings {
  anthropicConfig: string | null;
  geminiConfig: string | null;
  openaiConfig: string | null;
}

async function migrate() {
  console.log("Starting provider config migration...");

  // 1. 读取旧配置
  const settings = await prisma.$queryRaw<OldSettings[]>`
    SELECT "anthropicConfig", "geminiConfig", "openaiConfig"
    FROM "Settings"
    WHERE id = 'default'
  `;

  if (!settings.length) {
    console.log("No settings found, skipping migration");
    return;
  }

  const { anthropicConfig, geminiConfig, openaiConfig } = settings[0];

  // 2. 迁移 anthropic 配置
  if (anthropicConfig) {
    const config = JSON.parse(anthropicConfig);
    await prisma.providerConfig.upsert({
      where: { provider: "anthropic" },
      create: {
        provider: "anthropic",
        model: config.model || "claude-3-sonnet",
        baseUrl: config.baseUrl,
        apiKeyRef: config.authToken ? "${ANTHROPIC_API_KEY}" : null,
      },
      update: {
        model: config.model || "claude-3-sonnet",
        baseUrl: config.baseUrl,
      },
    });
    console.log("Migrated anthropic config");
  }

  // 3. 迁移 gemini 配置
  if (geminiConfig) {
    const config = JSON.parse(geminiConfig);
    await prisma.providerConfig.upsert({
      where: { provider: "gemini" },
      create: {
        provider: "gemini",
        model: config.model || "gemini-pro",
        baseUrl: config.baseUrl,
        apiKeyRef: "${GEMINI_API_KEY}",
      },
      update: {
        model: config.model || "gemini-pro",
        baseUrl: config.baseUrl,
      },
    });
    console.log("Migrated gemini config");
  }

  // 4. 迁移 openai 配置
  if (openaiConfig) {
    const config = JSON.parse(openaiConfig);
    await prisma.providerConfig.upsert({
      where: { provider: "openai" },
      create: {
        provider: "openai",
        model: config.model || "gpt-4",
        baseUrl: config.baseUrl,
        apiKeyRef: "${OPENAI_API_KEY}",
      },
      update: {
        model: config.model || "gpt-4",
        baseUrl: config.baseUrl,
      },
    });
    console.log("Migrated openai config");
  }

  console.log("Provider config migration completed!");
  await prisma.$disconnect();
}

migrate().catch(console.error);
```

**Step 2: 运行迁移脚本**

Run: `npx tsx scripts/migrate-provider-config.ts`
Expected: Migration completed successfully

---

### Task 2.3: 更新 AI Provider 代码

**Files:**
- Modify: `src/ai/providers.ts` (或相关文件)

**Step 1: 查找并更新 loadSettings 函数**

需要找到加载 AI 配置的代码，更新为从 ProviderConfig 表读取。

```typescript
// 示例修改:
export async function loadSettings() {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  const providerConfig = await prisma.providerConfig.findUnique({
    where: { provider: settings?.provider || "anthropic" },
  });

  if (!settings || !providerConfig) {
    return null;
  }

  return {
    provider: settings.provider,
    batchSize: settings.batchSize,
    concurrency: settings.concurrency,
    model: providerConfig.model,
    baseUrl: providerConfig.baseUrl,
    // ...
  };
}
```

---

### Task 2.4: 创建 ProviderConfig API

**Files:**
- Create: `app/api/provider-configs/route.ts`

**Step 1: 实现 CRUD API**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET: 获取所有 provider 配置
export async function GET() {
  try {
    const configs = await prisma.providerConfig.findMany({
      orderBy: { provider: "asc" },
    })

    // 隐藏敏感信息
    const safeConfigs = configs.map((c) => ({
      id: c.id,
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
      hasApiKey: !!c.apiKeyRef,
    }))

    return NextResponse.json({ success: true, data: safeConfigs })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch provider configs" },
      { status: 500 }
    )
  }
}

// PUT: 更新 provider 配置
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { provider, model, baseUrl, apiKeyRef } = body

    const config = await prisma.providerConfig.upsert({
      where: { provider },
      create: { provider, model, baseUrl, apiKeyRef },
      update: { model, baseUrl, apiKeyRef },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update provider config" },
      { status: 500 }
    )
  }
}
```

---

### Task 2.5: 阶段 2 提交

Run: `pnpm build`
Expected: Build succeeds

```bash
git add -A
git commit -m "refactor: split Settings into Settings + ProviderConfig

- Create ProviderConfig table for AI provider settings
- Migrate existing provider configs from Settings JSON fields
- Remove default prefix from Settings fields
- Add ProviderConfig API endpoints
"
```

---

## 阶段 3: Item.packId 继承逻辑

### Task 3.1: 修改 Item 创建逻辑

**Files:**
- Modify: `src/fetcher/` 下的相关文件 (需要查找 Item.create 调用)

**Step 1: 查找 Item 创建位置**

Run: `grep -r "prisma.item.create" src/`

**Step 2: 添加 packId 继承**

```typescript
// 修改前:
const item = await prisma.item.create({
  data: {
    id,
    title,
    url,
    sourceId,
    sourceName,
    sourceType,
    // packId 缺失
  }
})

// 修改后:
// 先获取 source 的 packId
const source = await prisma.source.findUnique({
  where: { id: sourceId },
  select: { packId: true }
})

const item = await prisma.item.create({
  data: {
    id,
    title,
    url,
    sourceId,
    sourceName,
    sourceType,
    packId: source?.packId,  // 从 source 继承
  }
})
```

---

### Task 3.2: 阶段 3 提交

Run: `pnpm build`
Expected: Build succeeds

```bash
git add -A
git commit -m "fix: inherit packId from source when creating items"
```

---

## 阶段 4: Item.id 迁移到 cuid

### Task 4.1: 添加 URL 唯一索引

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加 URL 唯一约束**

```prisma
model Item {
  id           String   @id @default(cuid())
  url          String
  canonicalUrl String
  // ...
  @@unique([url])  // 添加 URL 唯一索引
}
```

**Step 2: 生成迁移**

Run: `pnpm prisma migrate dev --name add-item-url-unique`

---

### Task 4.2: 创建 Item ID 迁移脚本

**Files:**
- Create: `scripts/migrate-item-ids.ts`

**Step 1: 编写迁移脚本**

```typescript
/**
 * 将 Item.id 从 URL 格式迁移到 cuid 格式
 * 同时更新所有关联表
 */

import { PrismaClient } from "@prisma/client";
import { cuid } from "@paralleldrive/cuid2";

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting Item ID migration...");

  // 1. 获取所有使用 URL 作为 ID 的 items
  const items = await prisma.item.findMany({
    where: {
      id: {
        startsWith: "http",
      },
    },
    select: { id: true },
  });

  console.log(`Found ${items.length} items with URL-based IDs`);

  // 2. 创建 ID 映射
  const idMap = new Map<string, string>();
  for (const item of items) {
    idMap.set(item.id, cuid());
  }

  // 3. 更新 Bookmark 表
  for (const [oldId, newId] of idMap) {
    await prisma.bookmark.updateMany({
      where: { itemId: oldId },
      data: { itemId: newId },
    });
  }
  console.log("Updated bookmarks");

  // 4. 更新 DailyOverview.itemIds
  const overviews = await prisma.dailyOverview.findMany();
  for (const overview of overviews) {
    const newItemIds = overview.itemIds.map((id) => idMap.get(id) || id);
    await prisma.dailyOverview.update({
      where: { id: overview.id },
      data: { itemIds: newItemIds },
    });
  }
  console.log("Updated daily overviews");

  // 5. 更新 TimelineEvent.itemIds
  const events = await prisma.timelineEvent.findMany();
  for (const event of events) {
    const newItemIds = event.itemIds.map((id) => idMap.get(id) || id);
    await prisma.timelineEvent.update({
      where: { id: event.id },
      data: { itemIds: newItemIds },
    });
  }
  console.log("Updated timeline events");

  // 6. 更新 Item 表 ID
  for (const [oldId, newId] of idMap) {
    await prisma.item.update({
      where: { id: oldId },
      data: { id: newId },
    });
  }
  console.log("Updated item IDs");

  console.log("Item ID migration completed!");
  await prisma.$disconnect();
}

migrate().catch(console.error);
```

**Step 2: 运行迁移**

Run: `npx tsx scripts/migrate-item-ids.ts`
Expected: Migration completed

---

### Task 4.3: 更新 Item 创建代码

**Files:**
- Modify: `src/fetcher/` 下的相关文件

**Step 1: 移除手动 ID 设置**

```typescript
// 修改前:
const item = await prisma.item.create({
  data: {
    id: url,  // 手动设置 URL 作为 ID
    // ...
  }
})

// 修改后:
const item = await prisma.item.create({
  data: {
    // id 由 Prisma 自动生成 cuid
    url,
    // ...
  }
})
```

---

### Task 4.4: 阶段 4 提交

Run: `pnpm build`
Expected: Build succeeds

```bash
git add -A
git commit -m "refactor: migrate Item.id from URL to cuid

- Add unique constraint on Item.url
- Migrate existing Item IDs to cuid format
- Update all related tables (Bookmark, DailyOverview, TimelineEvent)
- Remove manual ID assignment in Item creation
"
```

---

## 阶段 5: Source.id 迁移到 cuid

> ⚠️ **高风险操作**: 需要更新大量代码和数据

### Task 5.1: 添加 sourceId 别名字段

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 添加 slug 字段**

```prisma
model Source {
  id          String   @id @default(cuid())
  slug        String   @unique  // 旧的 ID 作为 slug 保留
  type        String
  name        String
  // ...

  @@index([slug])
}
```

---

### Task 5.2: 创建 Source ID 迁移脚本

**Files:**
- Create: `scripts/migrate-source-ids.ts`

**Step 1: 编写迁移脚本**

```typescript
/**
 * 将 Source.id 迁移到 cuid 格式
 * 保留旧 ID 作为 slug
 */

import { PrismaClient } from "@prisma/client";
import { cuid } from "@paralleldrive/cuid2";

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting Source ID migration...");

  // 1. 获取所有 sources
  const sources = await prisma.source.findMany({
    select: { id: true },
  });

  // 2. 为每个 source 创建新 ID 映射
  const idMap = new Map<string, string>();
  for (const source of sources) {
    // 如果 ID 已经是 cuid 格式，跳过
    if (source.id.length > 20) {
      continue;
    }
    idMap.set(source.id, cuid());
  }

  console.log(`Migrating ${idMap.size} sources`);

  // 3. 更新 Item.sourceId
  for (const [oldId, newId] of idMap) {
    await prisma.item.updateMany({
      where: { sourceId: oldId },
      data: { sourceId: newId },
    });
  }
  console.log("Updated items");

  // 4. 更新 SourceHealth.sourceId
  for (const [oldId, newId] of idMap) {
    await prisma.sourceHealth.updateMany({
      where: { sourceId: oldId },
      data: { sourceId: newId },
    });
  }
  console.log("Updated source health");

  // 5. 更新 Source 表 (设置 slug 和新 ID)
  for (const [oldId, newId] of idMap) {
    await prisma.source.update({
      where: { id: oldId },
      data: { id: newId, slug: oldId },
    });
  }
  console.log("Updated sources");

  console.log("Source ID migration completed!");
  await prisma.$disconnect();
}

migrate().catch(console.error);
```

---

### Task 5.3: 更新所有引用 Source.id 的代码

**Files:**
- Modify: `app/api/sources/route.ts`
- Modify: `app/api/sources/[id]/route.ts`
- Modify: `scripts/migrate-yaml-to-db.ts`
- 以及其他使用 Source.id 的文件

**Step 1: 查找所有引用**

Run: `grep -r "sourceId" app/ src/ --include="*.ts" --include="*.tsx"`

**Step 2: 更新 API 路由**

```typescript
// 支持 slug 和 id 两种查找方式
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const source = await prisma.source.findFirst({
    where: {
      OR: [
        { id: params.id },
        { slug: params.id },
      ],
    },
  });
  // ...
}
```

---

### Task 5.4: 阶段 5 提交

Run: `pnpm build`
Expected: Build succeeds

```bash
git add -A
git commit -m "refactor: migrate Source.id to cuid with slug fallback

- Add slug field to preserve old IDs
- Migrate existing Source IDs to cuid format
- Update all related tables and API routes
- Support both id and slug for lookup
"
```

---

## 阶段 6: AuthConfig 前端展示

### Task 6.1: 创建 AuthConfig API

**Files:**
- Create: `app/api/auth-config/route.ts`

**Step 1: 实现 API**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET
export async function GET() {
  try {
    const config = await prisma.authConfig.findUnique({
      where: { id: "default" },
    })

    if (!config) {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    // 隐藏敏感配置
    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        adapter: config.adapter,
        hasConfig: !!config.configJson,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch auth config" },
      { status: 500 }
    )
  }
}

// PUT
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { adapter, configJson } = body

    const config = await prisma.authConfig.upsert({
      where: { id: "default" },
      create: { id: "default", adapter, configJson },
      update: { adapter, configJson },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        adapter: config.adapter,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update auth config" },
      { status: 500 }
    )
  }
}
```

---

### Task 6.2: 创建 AuthConfig 前端组件

**Files:**
- Create: `components/auth-config-section.tsx`

**Step 1: 实现组件**

```typescript
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AuthConfigData {
  adapter: string
  hasConfig: boolean
}

export function AuthConfigSection() {
  const [config, setConfig] = useState<AuthConfigData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/auth-config")
        const data = await res.json()
        if (data.success) {
          setConfig(data.data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">认证配置</CardTitle>
      </CardHeader>
      <CardContent>
        {config ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">适配器:</span>
              <span className="font-mono text-sm">{config.adapter}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">配置状态:</span>
              <span className={config.hasConfig ? "text-green-600" : "text-muted-foreground"}>
                {config.hasConfig ? "已配置" : "无"}
              </span>
            </div>
            <Button variant="outline" size="sm" className="mt-2">
              编辑配置
            </Button>
          </div>
        ) : (
          <div className="text-muted-foreground">
            无认证配置
            <Button variant="outline" size="sm" className="ml-2">
              添加配置
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

### Task 6.3: 集成到配置页面

**Files:**
- Modify: `components/config-page.tsx`

**Step 1: 添加 AuthConfigSection**

```typescript
import { AuthConfigSection } from "./auth-config-section"

// 在 Pack 信息区域添加
<div className="space-y-4">
  {/* 现有的 Pack 信息 */}
  <AuthConfigSection />
</div>
```

---

### Task 6.4: 阶段 6 提交

Run: `pnpm build`
Expected: Build succeeds

```bash
git add -A
git commit -m "feat: add AuthConfig display and edit in Pack info page

- Create AuthConfig API endpoints
- Create AuthConfigSection component
- Integrate into config page
"
```

---

## 完成清单

| 阶段 | 任务 | 状态 |
|------|------|------|
| 1 | 移除 Spotlight 功能 | ⬜ |
| 2 | Settings 表重构 | ⬜ |
| 3 | Item.packId 继承 | ⬜ |
| 4 | Item.id 迁移 | ⬜ |
| 5 | Source.id 迁移 | ⬜ |
| 6 | AuthConfig 前端 | ⬜ |
