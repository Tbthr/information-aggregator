# 全栈重构设计文档

## 概述

本次重构包含三个核心任务，按顺序执行：

1. **目录结构重构** — 修复 `app/app/` 嵌套导致的 URL 问题
2. **数据层改造** — 改造数据爬取、解析、AI 增强逻辑及后端 API
3. **文档更新** — 重写过时文档，反映当前 Next.js 架构

---

## Phase 1: 目录结构重构

### 当前结构（问题）

```
app/
├── app/           # Next.js App Router (嵌套!)
│   ├── api/       # → /app/api/* (错误)
│   ├── page.tsx   # → /app (错误)
│   └── ...
├── components/
├── hooks/
└── lib/
```

### 目标结构

```
information-aggregator/
├── app/              # Next.js App Router (根目录)
│   ├── api/          # → /api/*
│   ├── daily/        # → /daily
│   ├── weekly/       # → /weekly
│   ├── layout.tsx
│   └── page.tsx      # → /
├── components/       # React 组件
├── hooks/            # React hooks
├── lib/              # 前端工具库
├── src/              # 后端代码（保持不变）
├── prisma/           # 数据库 schema
└── config/           # 配置文件
```

### 改动清单

| 操作 | 文件/目录 |
|------|-----------|
| 移动 | `app/app/*` → `app/*` |
| 移动 | `app/components/` → `components/` |
| 移动 | `app/hooks/` → `hooks/` |
| 移动 | `app/lib/` → `lib/` |
| 删除 | 空的 `app/app/` 目录 |
| 更新 | 所有 import 路径 |

### tsconfig.json 更新

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Phase 2: 数据层改造

### 数据流架构

```
┌─────────────────────────────────────────────────────────┐
│                 定时任务调度器                           │
│  config/scheduler.yaml                                  │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    数据获取层                            │
│  所有 enabled sources 并发获取                          │
│  - 支持增量：使用 source 提供的增量参数                  │
│  - 不支持增量：查库获取最新一条，过滤已存在的            │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    数据处理流水线                        │
│  normalize → dedupe → enrich → rank                     │
│  AI 增强：summary + bullets + categories                │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    持久化层                              │
│  Item / Source / SourceHealth / Pack                    │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    视图层（按配置）                       │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐                    │
│  │ 日报视图    │    │ 周报视图    │                    │
│  │ daily.yaml  │    │ weekly.yaml │                    │
│  │             │    │             │                    │
│  │ 筛选 pack   │    │ 检查时间    │                    │
│  │ 聚合/排序   │    │ 7天聚合     │                    │
│  │ 生成概述    │    │ 生成社论    │                    │
│  └──────┬──────┘    └──────┬──────┘                    │
│         ↓                  ↓                           │
│  DailyOverview        WeeklyReport                     │
│  NewsFlash            TimelineEvent                     │
└─────────────────────────────────────────────────────────┘
```

**关键点**：
1. **数据获取与视图分离** — 先获取所有数据，再按配置生成视图
2. **周报定时检查** — 每次运行时检查是否需要生成新周报（如每周一）
3. **日报与 Item 关联** — DailyOverview 记录 itemIds，周报基于此聚合

### 配置文件设计

#### 定时任务 `config/scheduler.yaml`

```yaml
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

#### 日报配置 `config/reports/daily.yaml`

```yaml
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

#### 周报配置 `config/reports/weekly.yaml`

```yaml
weekly:
  days: 7
  maxTimelineEvents: 10
  maxDeepDives: 5
  enableEditorial: true
```

### AI 增强流程

#### 输出结构

```typescript
interface AiEnrichmentOutput {
  summary: string      // 100-150字概述
  bullets: string[]    // 3-5个核心要点
  categories: string[] // 1-3个分类标签
}
```

#### 统一 Prompt

```markdown
请分析以下文章，生成结构化的增强数据。

## 输入
标题：{title}
正文：{content}

## 输出要求
请以 JSON 格式输出，包含以下字段：

1. **summary** (string): 100-150字概述，提炼核心观点
2. **bullets** (string[]): 3-5个核心要点，每个不超过50字
3. **categories** (string[]): 1-3个最合适的分类标签，自行判断

## 输出格式
```json
{
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "categories": ["...", "..."]
}
```

只输出 JSON，不要其他内容。
```

### API 接口改造

#### 接口字段对照表

| 接口 | 前端需求字段 | 状态 |
|------|-------------|------|
| `/api/items` | id, title, source, sourceUrl, publishedAt, summary, bullets, content, imageUrl, categories, aiScore, isBookmarked | 扩展字段 |
| `/api/bookmarks` | 同上（收藏列表） | 重命名 + 扩展 |
| `/api/daily` | overview, spotlightArticles, recommendedArticles, newsFlashes | 移除 mock |
| `/api/weekly` | hero, timelineEvents, deepDives | 移除 mock |
| `/api/news-flashes` | id, time, text, itemId | 小调整 |

#### 收藏接口重命名

| 当前 | 改为 |
|------|------|
| `/api/items/saved` | `/api/bookmarks` |
| `POST /api/items/:id/save` | `POST /api/bookmarks/:id` |
| `DELETE /api/items/:id/save` | `DELETE /api/bookmarks/:id` |

**字段名调整**：

| 当前 | 改为 |
|------|------|
| `savedItems` | `bookmarks` |
| `savedAt` | `bookmarkedAt` |
| `saved` | `isBookmarked` |

### 数据库 Schema 变更

#### 主要变更

1. **Item 表** — 新增 `sourceName`，`category` 改为 `categories` (String[])
2. **SavedItem → Bookmark** — 表名和字段重命名
3. **DailyOverview** — 新增 `itemIds`, `spotlightIds` (String[])
4. **TimelineEvent** — 新增 `itemIds` (String[])
5. **NewsFlash** — 新增 `dailyDate` (String?)

#### 完整 Schema

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

/// 数据来源表 - 定义所有数据源
model Source {
  id          String   @id                    // 来源标识（如 "tc-main"）
  type        String                          // 来源类型（rss/json-feed/x-home 等）
  name        String                          // 显示名称（如 "TechCrunch"）
  url         String?                         // 来源 URL（RSS feed 地址等）
  description String?                         // 来源描述
  enabled     Boolean  @default(true)         // 是否启用抓取
  configJson  String?  @db.Text               // 来源特定配置 JSON
  packId      String?                         // 所属 Pack ID

  pack        Pack?    @relation(fields: [packId], references: [id])
  items       Item[]                          // 抓取的内容条目
  health      SourceHealth?                   // 来源健康状态

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

/// 来源健康状态表 - 跟踪数据源的运行状态
model SourceHealth {
  id                  String   @id @default(cuid())
  sourceId            String   @unique           // 关联的来源 ID（唯一）
  lastSuccessAt       DateTime?                  // 最后成功抓取时间
  lastFailureAt       DateTime?                  // 最后失败时间
  lastError           String?  @db.Text          // 最后错误信息
  consecutiveFailures Int      @default(0)       // 连续失败次数

  source              Source   @relation(fields: [sourceId], references: [id])
  updatedAt           DateTime @updatedAt
}

/// Pack 表 - 数据源分组
model Pack {
  id          String   @id                    // Pack 标识（如 "tech-news"）
  name        String                          // Pack 名称（如 "科技资讯聚合"）
  description String?                         // Pack 描述
  policyJson  String?  @db.Text               // Pack 策略配置 JSON（过滤规则等）

  sources     Source[]                        // Pack 包含的数据源

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

/// 收藏表 - 用户收藏的内容
model Bookmark {
  id            String   @id @default(cuid())
  itemId        String                          // 关联的内容条目 ID
  bookmarkedAt  DateTime @default(now())        // 收藏时间

  item          Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId])                            // 每个条目只能收藏一次
}

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

/// 周报表 - 每周生成的周报
model WeeklyReport {
  id            String   @id @default(cuid())
  weekNumber    String                          // 周数（如 "Week 12"）
  headline      String                          // 周报标题
  subheadline   String?  @db.Text               // 副标题（日期范围等）
  editorial     String?  @db.Text               // AI 生成的周报社论

  timelineEvents TimelineEvent[]                 // 周报时间线事件

  createdAt     DateTime @default(now())
}

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

/// 自定义视图表（保持不变）
model CustomView {
  id          String   @id
  name        String                          // 视图名称
  icon        String                          // 图标标识
  description String?                         // 视图描述

  items       CustomViewItem[]                 // 视图包含的条目

  createdAt   DateTime @default(now())
}

/// 自定义视图条目关联表（保持不变）
model CustomViewItem {
  id      String   @id @default(cuid())
  viewId  String                          // 所属视图 ID
  itemId  String                          // 关联的条目 ID
  order   Int      @default(0)           // 排序顺序

  view    CustomView @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@unique([viewId, itemId])              // 同一视图内条目不重复
  @@index([viewId])
}
```

---

## Phase 3: 文档更新

### 文件变更清单

| 文件 | 操作 |
|------|------|
| `AGENTS.md` | 重写 |
| `README.md` | 重写 |
| `TEST.md` | 删除（内容融合到 AGENTS.md）|
| `docs/api-data-formats.md` | 新建 |

### AGENTS.md 结构

1. 项目架构概述 — Next.js App Router + Prisma + Supabase
2. 目录结构说明
3. 开发规范 — 代码风格、Git 工作流、测试要求
4. 测试流程 — `pnpm build` / `pnpm lint` / 前端验证
5. AI 协作指南 — 任务拆分原则、代码审查要求

### README.md 结构

1. 项目简介
2. 快速开始 — 环境要求、安装依赖、配置环境变量
3. 功能特性
4. 前端入口 — `/`, `/daily`, `/weekly`, `/saved`
5. 配置说明
6. 部署指南

---

## 风险评估

| 风险 | 缓解措施 |
|------|----------|
| import 路径遗漏 | 构建验证 + TypeScript 检查 |
| 数据库迁移失败 | 备份数据，测试迁移脚本 |
| Vercel 部署失败 | 更新 vercel.json 配置 |
| 空态 UI 不完善 | 确认空态组件已实现 |
| Mock 数据移除导致前端报错 | 确保空数组返回，前端处理空态 |
