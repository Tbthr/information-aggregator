# 数据层改造设计文档

## 概述

前端改造后，数据表结构发生重大变更，需要同步改造数据爬取、解析、AI 增强逻辑，以及后端 API 接口，确保满足前端展示需求。

## 一、数据流架构

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

## 二、配置文件设计

### 2.1 定时任务配置 `config/scheduler.yaml`

```yaml
scheduler:
  jobs:
    # 数据获取与处理（高频）
    fetch-and-process:
      cron: "0 */30 * * * *"
      description: "获取所有 enabled sources 数据，处理并持久化"
      enabled: true

    # 日报生成（每天）
    daily-report:
      cron: "0 30 6 * * *"
      description: "根据 daily.yaml 配置生成日报"
      enabled: true

    # 周报生成（周一）
    weekly-report:
      cron: "0 0 7 * * 1"
      description: "根据 weekly.yaml 配置生成周报"
      enabled: true
```

### 2.2 日报配置 `config/reports/daily.yaml`

```yaml
daily:
  # 数据源选择
  packs: all  # 或 ["tech-news", "github", "karpathy-picks"]

  # 条目控制
  maxItems: 20
  maxSpotlight: 3

  # 排序策略
  sort: ranked  # ranked | recent

  # AI 功能
  enableOverview: true

  # 快讯配置
  newsFlashes:
    enabled: true
    maxCount: 12
```

### 2.3 周报配置 `config/reports/weekly.yaml`

```yaml
weekly:
  # 时间范围
  days: 7

  # 聚合输出
  maxTimelineEvents: 10
  maxDeepDives: 5

  # AI 功能
  enableEditorial: true
```

## 三、AI 增强流程重新设计

### 3.1 AI 输出结构

```typescript
interface AiEnrichmentOutput {
  // 100-150字概述，用于卡片展示
  summary: string

  // 3-5个核心要点，用于要点列表
  bullets: string[]

  // 1-3个分类标签，AI 自行判断
  categories: string[]

  // 评分（可选，基于完整内容）
  score?: number
}
```

### 3.2 统一 Prompt 模板

**内容增强** `config/prompts/enrich.md`：

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
​```json
{
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "categories": ["...", "..."]
}
​```

只输出 JSON，不要其他内容。
```

## 四、API 接口改造

### 4.1 接口字段对照表

| 接口 | 前端需求字段 | 需要修改 |
|------|-------------|---------|
| `/api/items` | id, title, source, sourceUrl, publishedAt, summary, bullets, content, imageUrl, categories, aiScore, isBookmarked | ✅ 扩展字段 |
| `/api/bookmarks` | 同上（收藏列表） | ✅ 重命名 + 扩展字段 |
| `/api/daily` | overview, spotlightArticles, recommendedArticles, newsFlashes | ✅ 移除 mock，从 DB 读取 |
| `/api/weekly` | hero, timelineEvents, deepDives | ✅ 移除 mock，从 DB 读取 |
| `/api/news-flashes` | id, time, text, itemId | ⚠️ 小调整 |
| `/api/views` | id, name, icon, description, itemCount | ⚠️ 检查 |
| `/api/packs` | id, name, description, sourceCount | ⚠️ 检查 |
| `/api/sources` | id, type, name, url, enabled, packId, health | ⚠️ 检查 |

### 4.2 收藏接口重命名

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

### 4.3 日报/周报接口简化

**`/api/daily`**：
```typescript
// 只查询，不生成
export async function GET() {
  const overview = await prisma.dailyOverview.findFirst({
    orderBy: { date: 'desc' }
  })

  if (!overview) {
    return NextResponse.json({ success: false, error: 'No daily data' }, { status: 404 })
  }

  // 根据 itemIds 查询关联的 items
  const items = await prisma.item.findMany({
    where: { id: { in: overview.itemIds } }
  })

  return NextResponse.json({ success: true, data: { ...overview, items } })
}
```

**`/api/weekly`**：
```typescript
// 只查询，不生成
export async function GET() {
  const report = await prisma.weeklyReport.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { timelineEvents: true }
  })

  if (!report) {
    return NextResponse.json({ success: false, error: 'No weekly data' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: report })
}
```

## 五、数据库 Schema 调整

### 5.1 主要变更

1. **Item 表**
   - 新增 `sourceName` 字段
   - `category` 改为 `categories` (String[])
   - 确保 `summary`, `bullets`, `content`, `imageUrl` 字段存在

2. **SavedItem → Bookmark** 重命名
   - 表名: `SavedItem` → `Bookmark`
   - 字段: `savedAt` → `bookmarkedAt`

3. **DailyOverview 新增关联字段**
   - `itemIds`: String[] — 当天日报包含的 item IDs
   - `spotlightIds`: String[] — 精选 item IDs

4. **TimelineEvent 新增关联字段**
   - `itemIds`: String[] — 事件关联的 item IDs

5. **NewsFlash 新增字段**
   - `dailyDate`: String? — 关联的日报日期

### 5.2 完整 Schema

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

## 六、改造任务拆分

| # | 任务 | 优先级 | 依赖 |
|---|------|--------|------|
| 1 | 创建配置文件目录和 schema 定义 | P0 | - |
| 2 | 调整 Prisma Schema（字段新增/重命名） | P0 | - |
| 3 | 实现 AI 增强统一 Prompt 和解析逻辑 | P0 | 2 |
| 4 | 改造 `/api/items` 返回完整字段 | P0 | 2 |
| 5 | 重命名收藏接口 `/api/bookmarks` | P1 | 2 |
| 6 | 简化 `/api/daily` 为纯查询 | P1 | 2 |
| 7 | 简化 `/api/weekly` 为纯查询 | P1 | 2 |
| 8 | 实现定时任务调度器 | P1 | 1,3 |
| 9 | 实现日报生成任务 | P1 | 8 |
| 10 | 实现周报生成任务 | P1 | 8,9 |
| 11 | 前端适配新 API 字段 | P2 | 4,5,6,7 |

## 七、注意事项

1. **数据迁移** — Schema 变更需要生成迁移脚本，现有数据需兼容处理
2. **向后兼容** — API 改造期间保持旧接口可用，逐步切换
3. **前端样式不变** — 本次改造只调整数据层，前端 UI 保持现状
