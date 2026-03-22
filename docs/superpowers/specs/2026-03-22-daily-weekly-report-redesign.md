# 日报与周报系统重构设计

**日期**: 2026-03-22
**状态**: Draft

## 背景

本项目的核心目标是应对 AI 时代的信息过载，利用 AI 去除无价值信息、合并重复内容。当前日报仅按分数排序列出条目，缺乏聚合分析和深度提炼。本次重构将日报/周报改造为 AI 驱动的信息摘要，对内容进行分析、合并、提炼。

### 核心变更

1. **日报**: 从逐条展示 → AI 话题聚合摘要
2. **数据源**: Item 表 + Tweet 表（tab=home/lists）；bookmark/like 不纳入（已是筛选过的内容）
3. **可配置 AI Pipeline**: 用户可自定义关键词黑名单、每一步 AI prompt
4. **周报**: 从时间线 + 深度阅读 → AI 深度总结 + 精选推荐（基于日报引用的数据）
5. **移除快讯**: AI 已承担摘要功能，不再需要单独的快讯清单

## 数据模型

### 修改的模型

#### DailyOverview

```prisma
model DailyOverview {
  id            String   @id @default(cuid())
  date          String   @unique              // YYYY-MM-DD
  dayLabel      String                        // "3月22日"
  topicCount    Int      @default(0)          // 话题条目数量
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  // 错误记录
  errorMessage  String?                       // Pipeline 错误信息
  errorSteps    String[]                      // 失败的步骤列表，如 ["topicClustering"]

  // 关联
  topics        DigestTopic[]
  picks         DailyPick[]
}
```

**移除字段**: `summary`（不再有独立的整体概要）、`itemIds`（由 DigestTopic 引用替代）

#### WeeklyReport

```prisma
model WeeklyReport {
  id            String   @id @default(cuid())
  weekNumber    String   @unique              // "2026-W12"
  editorial     String                        // AI 深度周总结（500-1000字）
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  // 错误记录
  errorMessage  String?                       // Pipeline 错误信息
  errorSteps    String[]                      // 失败的步骤列表

  // 关联
  picks         WeeklyPick[]
}
```

**移除字段**: `headline`、`subheadline`（editorial 已足够）
**移除关联**: `TimelineEvent[]`（由 DigestTopic 方式替代）

#### DailyReportConfig

```prisma
model DailyReportConfig {
  id                 String   @id @default(cuid())

  // 数据源配置
  packs              String[]                // 数据源 Pack
  maxItems           Int      @default(50)   // 最大收集条目数
  minScore           Int      @default(0)    // 最低分数阈值

  // 过滤配置
  keywordBlacklist   String[]                // 关键词黑名单
  filterPrompt       String?                 // AI 过滤 prompt（可选，关键词黑名单之外的额外过滤）

  // AI Prompt 配置（null 时使用系统默认值）
  topicPrompt        String?                 // 话题聚类 prompt
  topicSummaryPrompt String?                 // 话题总结 prompt
  pickReasonPrompt   String?                 // 精选推荐理由 prompt

  // 精选配置
  pickCount          Int      @default(3)    // 今日精选数量
}
```

**移除字段**: `sort`、`enableOverview`、`newsFlashesEnabled`、`newsFlashesMaxCount`

#### WeeklyReportConfig

```prisma
model WeeklyReportConfig {
  id                 String   @id @default(cuid())

  // 数据源配置
  days               Int      @default(7)    // 覆盖天数

  // AI Prompt 配置（null 时使用系统默认值）
  editorialPrompt    String?                 // 深度周总结 prompt
  pickReasonPrompt   String?                 // 精选推荐理由 prompt

  // 精选配置
  pickCount          Int      @default(6)    // 周报精选数量
}
```

**移除字段**: `maxTimelineEvents`、`maxDeepDives`、`enableEditorial`

### 新增模型

#### DigestTopic（话题聚合条目）

```prisma
model DigestTopic {
  id          String        @id @default(cuid())
  dailyId     String
  daily       DailyOverview @relation(fields: [dailyId], references: [id], onDelete: Cascade)

  order       Int                           // 展示顺序
  title       String                        // 话题标题，如 "AI 领域动态"
  summary     String                        // AI 生成的话题总结
  itemIds     String[]                      // 引用的 Item ID 列表
  tweetIds    String[]                      // 引用的 Tweet ID 列表
  createdAt   DateTime      @default(now()) @db.Timestamptz
}
```

#### DailyPick（今日精选）

```prisma
model DailyPick {
  id          String        @id @default(cuid())
  dailyId     String
  daily       DailyOverview @relation(fields: [dailyId], references: [id], onDelete: Cascade)

  order       Int                           // 展示顺序
  itemId      String                        // 引用的 Item ID（仅 Item，不含 Tweet）
  reason      String                        // AI 推荐理由
  createdAt   DateTime      @default(now()) @db.Timestamptz
}
```

#### WeeklyPick（本周深度阅读）

```prisma
model WeeklyPick {
  id          String        @id @default(cuid())
  weeklyId    String
  weekly      WeeklyReport  @relation(fields: [weeklyId], references: [id], onDelete: Cascade)

  order       Int                           // 展示顺序
  itemId      String                        // 引用的 Item ID
  reason      String                        // AI 推荐理由：为什么值得深入阅读
  createdAt   DateTime      @default(now()) @db.Timestamptz
}
```

### 删除的模型

- `TimelineEvent` — 由 DigestTopic 方式替代
- `NewsFlash` — 不再需要

## 日报生成 Pipeline

**触发时间**: 每天 23:00 UTC（北京时间 07:00），覆盖过去 24 小时数据。

### Step 1: 数据收集

- 查询 `Item` 表中 `publishedAt` 在过去 24 小时内的记录
- 查询 `Tweet` 表中 `publishedAt` 在过去 24 小时内且 `tab` ∈ ('home', 'lists') 的记录
- 合并为统一数据流
- 输出: `RawItem[]` + `RawTweet[]`

### Step 2: 关键词过滤（本地，无 AI 调用）

- 读取 `DailyReportConfig.keywordBlacklist`
- 过滤掉 title/text 中包含黑名单关键词的内容
- 过滤掉 score < minScore 的 Item
- 若配置了 `filterPrompt`，可选执行 AI 预过滤（高级功能）
- 输出: `FilteredItem[]` + `FilteredTweet[]`

### Step 3: AI 话题聚类

- 构建聚类 prompt（可通过 `topicPrompt` 自定义）
- 传入过滤后的 Item/Tweet（仅 title + summary，截断控制 token）
- AI 将所有内容分成 5-10 个话题
- 输出 JSON: `{ topics: [{ title, itemIndexes, tweetIndexes }] }`
- 输出: `TopicCluster[]`

### Step 4a: 话题总结（可并行）

- 对每个 `TopicCluster`，获取关联 Item/Tweet 的完整内容
- 构建总结 prompt（可通过 `topicSummaryPrompt` 自定义）
- AI 为每个话题生成综合总结
- 各话题可并行处理（并发控制）
- 输出: `DigestTopic[]`（title + summary + itemIds + tweetIds）

### Step 4b: 今日精选

- 从未被话题覆盖的高分 Item 中选取
- 按 score 排序，取 top `pickCount`（默认 3）
- AI 为每篇生成推荐理由（可通过 `pickReasonPrompt` 自定义）
- 确保精选与话题条目内容不重复
- 输出: `DailyPick[]`（itemId + reason）

### Step 5: 持久化

- Upsert `DailyOverview`（date, topicCount）
- 删除该日期旧的 `DigestTopic` / `DailyPick`
- 批量创建新的 `DigestTopic[]` + `DailyPick[]`

### Token 成本估算

假设每天 50 条 Item + 30 条 Tweet = 80 条内容：
- Step 3（聚类）: ~8K input + ~1K output
- Step 4a（7 个话题）: ~21K input + ~3.5K output
- Step 4b（3 篇精选）: ~3K input + ~1.5K output
- **总计**: ~32K input + ~6K output，约 $0.05-0.10/天

## 周报生成 Pipeline

**触发时间**: 每周日 23:00 UTC，覆盖过去 7 天数据。

### Step 1: 数据收集

- 查询最近 7 篇 `DailyOverview`
- 收集所有 `DigestTopic` 引用的 `itemIds` + `tweetIds`（去重）
- 获取对应的 Item + Tweet 完整数据（title, summary, content, score, categories）
- 收集 `DigestTopic.summary` 作为上下文
- 输出: `WeekContext { dailyOverviews, items[], tweets[], topicSummaries[] }`

### Step 2: AI 深度总结

- 构建深度总结 prompt（可通过 `editorialPrompt` 自定义）
- 传入所有话题摘要 + 高分 Item 的详细内容
- AI 生成有深度的周总结（500-1000 字）
- Prompt 要点：识别跨日趋势、分析关键转折点和深层含义
- 输出: `editorial` 文本

### Step 3: 周报精选 + 持久化

- 按 score 排序，取 top `pickCount`（默认 6）
- AI 为每篇生成"为什么值得深入阅读"的理由（可通过 `pickReasonPrompt` 自定义）
- 确保精选覆盖不同话题领域，内容不重复
- Upsert `WeeklyReport` + `WeeklyPick[]`

## 错误处理与降级

### 日报 Pipeline

| 步骤 | 失败处理 |
|------|----------|
| 数据收集 | 跳过当天日报生成，记录日志 |
| 关键词过滤 | 黑名单为空 → 全部通过 |
| AI 话题聚类 | 降级：按 categories 分组，每组取最高分 Item 的 title 作为话题标题 |
| 话题总结 | 单个话题失败 → 使用该话题下最高分 Item 的 summary 作为降级内容 |
| 精选理由生成 | 失败 → 直接展示 Item 的 summary，不显示推荐理由 |
| 持久化 | 重试 3 次，仍失败则设置 `errorMessage` + `errorSteps` |

### 周报 Pipeline

| 场景 | 处理 |
|------|------|
| 7 天内日报不足 3 篇 | 跳过周报生成 |
| AI editorial 生成失败 | 降级：拼接所有话题摘要 |
| 精选不足 6 篇 | 有多少展示多少 |

错误记录在 `errorMessage` 和 `errorSteps` 字段中，前端查看日报/周报时如有错误信息展示警告提示。

## 前端变更

### 日报页面 (`components/daily-page.tsx`)

**移除板块**: 概要卡片、FeedCard 列表、快讯列表

**新结构**:
- 日期导航: `← 前一天 | 后一天 →`
- 话题摘要板块: 5-10 个话题卡片，每个包含：
  - 话题标题（序号）
  - AI 综合总结
  - 可折叠的参考链接列表（文章标题 + 链接、Tweet 引用）
- 今日精选板块: top 3 文章，每篇包含：
  - 分数徽章
  - AI 概要
  - AI 推荐理由

**数据 Hook**: 扩展 `useDaily()` 返回 `{ topics: DigestTopic[], picks: DailyPick[], errorMessage?, errorSteps? }`

### 周报页面 (`components/weekly-page.tsx`)

**移除板块**: Hero（headline/subheadline/editorial）、时间线（按天事件）、Deep Dives

**新结构**:
- 周导航: `← 上周 | 下周 →`
- 周编号标题: "2026-W12"
- 深度总结板块: AI editorial（500-1000 字）
- 本周精选板块: top 6 文章，每篇包含：
  - 分数徽章
  - AI 概要
  - AI 推荐理由：为什么值得深入阅读

**数据获取**: 从手动 `useState`/`useEffect` 迁移到 SWR（符合项目规范）

### 报告设置页面（新建: `/settings/reports`）

**板块划分**:

1. **日报配置**
   - 数据源 Pack 选择（多选）
   - 最大收集条目数（数字输入）
   - 最低分数阈值（数字输入）
   - 关键词黑名单（标签输入，支持添加/删除）
   - 今日精选数量（数字输入）
   - AI Prompt 配置（每个 textarea 带"恢复默认"按钮）：
     - 过滤 prompt（可选）
     - 话题聚类 prompt
     - 话题总结 prompt
     - 精选理由 prompt

2. **周报配置**
   - 覆盖天数（数字输入）
   - 周报精选数量（数字输入）
   - AI Prompt 配置（每个 textarea 带"恢复默认"按钮）：
     - 深度周总结 prompt
     - 精选理由 prompt

**API**: `GET/PUT /api/settings/reports`

### API 路由变更

| 路由 | 变更 |
|------|------|
| `GET /api/daily?date=YYYY-MM-DD` | 返回 `{ topics: DigestTopic[], picks: DailyPick[], errorMessage?, errorSteps? }` |
| `GET /api/weekly?week=YYYY-WNN` | 返回 `{ weekNumber, editorial, picks: WeeklyPick[], errorMessage?, errorSteps? }` |
| `GET /api/settings/reports` | 新增：读取 DailyReportConfig + WeeklyReportConfig |
| `PUT /api/settings/reports` | 新增：保存 DailyReportConfig + WeeklyReportConfig |
| `POST /api/cron/daily` | 重写：执行新的 5 步 pipeline |
| `POST /api/cron/weekly` | 重写：执行新的 3 步 pipeline |

## 数据库迁移说明

**删除**:
- `TimelineEvent` 和 `NewsFlash` 表
- `DailyOverview.summary`、`DailyOverview.itemIds` 列
- `WeeklyReport.headline`、`WeeklyReport.subheadline` 列
- `DailyReportConfig` 中 `sort`、`enableOverview`、`newsFlashesEnabled`、`newsFlashesMaxCount` 列
- `WeeklyReportConfig` 中 `maxTimelineEvents`、`maxDeepDives`、`enableEditorial` 列

**新增**:
- `DigestTopic`、`DailyPick`、`WeeklyPick` 表
- `DailyOverview.topicCount`、`DailyOverview.errorMessage`、`DailyOverview.errorSteps` 列
- `WeeklyReport.errorMessage`、`WeeklyReport.errorSteps` 列
- 配置表中的 prompt 字段
