# 全流程诊断运行计划

## Context

用户要求对生产数据库执行完整的诊断流程，涵盖：数据收集 → AI增强 → 落库 → 日报生成 → 周报生成 → API验证 → 页面内容验证。

## 执行步骤（参考）

### Step 0: 前置检查

```bash
# 确认环境
cat .env | grep -E "DIAGNOSTICS_ENV|DATABASE_URL"

# 确认 dev server 运行中
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# 确认数据库可连接
npx tsx scripts/diagnostics.ts reports --config-only
```

### Step 1: 静态检查

```bash
pnpm check && pnpm build
```

预期：TypeScript 检查通过，构建成功。

### Step 2: 只读诊断（collection + reports --config-only）

```bash
npx tsx scripts/diagnostics.ts collection
npx tsx scripts/diagnostics.ts reports --config-only
```

预期：所有只读断言通过，无 blocking FAIL。

### Step 3: 全流程写操作（full --allow-write --confirm-production）

这是核心步骤，将依次执行：

1. **Collection Stage**: 触发 `POST /api/cron/collect`，收集所有配置的 RSS/Twitter 来源（滚动 24h 窗口）
2. **Normalize & Filter**: 对收集的原始数据进行标准化、pack 过滤（mustInclude/exclude）、去重
3. **Storage**: 将处理后的 items/tweets 写入数据库（候选池）
4. **Daily Report**: 从候选池读取 Items + Tweets -> 构建 ReportCandidate -> 4 阶段运行时评分 -> 截取 top N -> AI 聚类 -> 持久化（`DailyOverview` + `DigestTopic`）
5. **Weekly Report**: 生成本周周报（`WeeklyReport` + `WeeklyPick`）
6. **API Verification**: 验证各 API 端点返回正确数据

```bash
npx tsx scripts/diagnostics.ts full --allow-write --confirm-production --verbose
```

预计耗时：10-15 分钟（取决于源数量和 AI 增强延迟）

### Step 4: API 端点验证

验证以下 API 有正确响应：

```bash
# 日报 API
curl -s "http://localhost:3000/api/daily" | jq '.success, .data.date, (.data.topics | length)'
curl -s "http://localhost:3000/api/daily?date=$(date -u +%Y-%m-%d)" | jq '.success, .data.topics[0]'

# 周报 API
curl -s "http://localhost:3000/api/weekly" | jq '.success, .data.weekNumber'
curl -s "http://localhost:3000/api/weekly?week=$(date -u +%Y-W%V)" | jq '.success'

# 空数据边界
curl -s "http://localhost:3000/api/daily?date=2099-01-01" | jq '.success, .data.topics'
curl -s "http://localhost:3000/api/weekly?week=2099-W01" | jq '.success, .data'
```

### Step 5: 页面内容验证（playwriter skill）

使用 `playwriter` skill 验证页面渲染：

1. 日报页面: `http://localhost:3000/daily`
2. 周报页面: `http://localhost:3000/weekly`

验证内容：
- 页面正常加载（无 500/404）
- 日报有主题分类（≥1 个 DigestTopic）
- 周报有精选推荐（≥1 个 WeeklyPick）
- 无 console error

### Step 6: 完整性检查

运行 integrity assertions 验证数据一致性：

```bash
npx tsx scripts/diagnostics.ts reports --config-only
```

检查：
- F-01: DigestTopic FK 无孤儿记录
- F-03: WeeklyPick FK 无孤儿记录
- F-04: topicCount 与实际 topics 数量一致
- F-05: 周报 pick items ⊆ 日报 topic items
- F-06: 引用 items 的 title/url/sourceId 非空
- F-07: 引用 tweets 的 text/authorHandle/url 非空

---

## 字段校验标准

### 1. Item 字段校验标准

Item 是采集管道的持久化候选池（candidate pool）。Legacy enhancement-result 字段（score, bullets, categories, imageUrl）已移除；评分由日报阶段运行时计算。

| 字段 | 类型 | 必填 | 校验规则 | 为 Null 的原因 |
|------|------|------|----------|----------------|
| `id` | String | 是 | `cuid()` 生成，全局唯一 | — |
| `title` | String | 是 | 非空字符串 | — |
| `url` | String | 是 | 非空，符合 URL 格式，`@unique` 唯一索引 | — |
| `sourceId` | String | 是 | 必须关联到存在的 Source 记录 | — |
| `sourceName` | String | 是 | 非空字符串 | — |
| `sourceType` | String | 是 | 非空字符串（如 "rss", "twitter"） | — |
| `publishedAt` | DateTime | 否 | ISO 8601 格式 | RSS 源未提供发布时间，或收集时解析失败 |
| `fetchedAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |
| `author` | String | 否 | 可空字符串 | RSS 源未提供作者信息 |
| `summary` | String | 否 | 可空，`@db.Text`，内容为原文摘要或 AI 生成 | AI 增强未完成，或 RSS 源无摘要内容 |
| `content` | String | 否 | 可空，`@db.Text` 类型 | RSS 源仅提供摘要，未提供全文 |
| `metadataJson` | String | 否 | 可空，JSON 字符串格式 | 无扩展元数据，或解析失败 |
| `packId` | String | 否 | 可空，关联到 Pack 记录 | 采集时未匹配到 pack |
| `createdAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |
| `updatedAt` | DateTime | 是 | ISO 8601 格式，自动更新 | — |

**索引**: `@unique([url])`, `@index([sourceId])`, `@index([fetchedAt])`, `@index([publishedAt])`, `@index([packId])`

### 2. Tweet 字段校验标准

| 字段 | 类型 | 必填 | 校验规则 | 为 Null 的原因 |
|------|------|------|----------|----------------|
| `id` | String | 是 | `cuid()` 生成，全局唯一 | — |
| `tweetId` | String | 是 | Twitter 原始 ID，`@unique` 唯一 | — |
| `tab` | String | 是 | 仅限 "home" 或 "lists" | — |
| `text` | String | 是 | 非空，推文正文，`@db.Text` | — |
| `url` | String | 是 | 非空，符合 Twitter URL 格式 | — |
| `expandedUrl` | String | 否 | 可空，符合 URL 格式 | Twitter 未提供展开 URL，或媒体链接无需展开 |
| `publishedAt` | DateTime | 否 | ISO 8601 格式 | Twitter API 未返回发布时间，或解析失败 |
| `fetchedAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |
| `authorHandle` | String | 是 | 非空，带 @ 前缀（如 "@xxx"） | — |
| `authorName` | String | 否 | 可空，作者显示名 | Twitter API 未返回显示名（已停用账号等） |
| `authorId` | String | 否 | 可空，Twitter user ID | Twitter API 未返回用户 ID |
| `conversationId` | String | 否 | 可空，对话 ID | 非回复推文，无对话上下文 |
| `likeCount` | Int | 是 | 默认 `0`，≥ 0 | — |
| `replyCount` | Int | 是 | 默认 `0`，≥ 0 | — |
| `retweetCount` | Int | 是 | 默认 `0`，≥ 0 | — |
| `summary` | String | 否 | 可空，AI 生成的摘要 | AI 增强未完成 |
| `mediaJson` | String | 否 | 可空，JSON 字符串 | 推文无媒体附件（图片/视频/动画） |
| `quotedTweetJson` | String | 否 | 可空，JSON 字符串 | 非引用推文 |
| `threadJson` | String | 否 | 可空，JSON 字符串 | 非线程推文 |
| `parentJson` | String | 否 | 可空，JSON 字符串 | 非回复推文 |
| `articleJson` | String | 否 | 可空，JSON 字符串 | 推文无文章卡片展示 |
| `createdAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |
| `updatedAt` | DateTime | 是 | ISO 8601 格式，自动更新 | — |

**索引**: `@index([tab])`, `@index([fetchedAt])`, `@index([authorHandle])`, `@index([publishedAt])`

### 3. DigestTopic 字段校验标准

| 字段 | 类型 | 必填 | 校验规则 | 为 Null 的原因 |
|------|------|------|----------|----------------|
| `id` | String | 是 | `cuid()` 生成，全局唯一 | — |
| `dailyId` | String | 是 | 必须关联到存在的 DailyOverview 记录 | — |
| `order` | Int | 是 | ≥ 0，表示话题排序顺序 | — |
| `title` | String | 是 | 非空字符串，中文 10 字以内（AI 聚类生成） | — |
| `summary` | String | 是 | 非空字符串，200-400 字（AI 生成） | — |
| `itemIds` | String[] | 是 | 非空数组，元素为 Item ID | 由 AI 聚类决定，至少有一个非空 |
| `tweetIds` | String[] | 是 | 非空数组，元素为 Tweet ID | 由 AI 聚类决定，至少有一个非空 |
| `createdAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |

**校验规则**:
- `title`: 非空，中文 10 字以内
- `summary`: 非空，200-400 字
- `itemIds` 和 `tweetIds` 至少有一个非空
- 所有 `itemIds` 必须存在于 Item 表
- 所有 `tweetIds` 必须存在于 Tweet 表

**索引**: `@index([dailyId])`

### 4. DailyOverview 字段校验标准

| 字段 | 类型 | 必填 | 校验规则 | 为 Null 的原因 |
|------|------|------|----------|----------------|
| `id` | String | 是 | `cuid()` 生成，全局唯一 | — |
| `date` | String | 是 | "YYYY-MM-DD" 格式，`@unique` 唯一 | — |
| `dayLabel` | String | 是 | "YYYY年M月D日 W" 格式（如 "2026年3月27日 星期五"） | — |
| `topicCount` | Int | 是 | 默认 `0`，必须与 `topics.length` 一致 | — |
| `createdAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |
| `updatedAt` | DateTime | 是 | ISO 8601 格式，自动更新 | — |
| `errorMessage` | String | 否 | 可空，记录失败步骤的错误信息 | 无错误步骤时为空 |
| `errorSteps` | Json | 否 | 可空数组，记录失败的阶段名 | 无错误步骤时为空 |

**校验规则**:
- `topicCount === topics.length`（F-04 完整性检查）
- `date` 唯一，不重复
- 若有错误，`errorMessage` 应包含 "部分步骤失败" 或 "数据收集失败"

**索引**: `@index([topicCount])`

### 5. WeeklyReport 字段校验标准

| 字段 | 类型 | 必填 | 校验规则 | 为 Null 的原因 |
|------|------|------|----------|----------------|
| `id` | String | 是 | `cuid()` 生成，全局唯一 | — |
| `weekNumber` | String | 是 | "YYYY-Wxx" 格式（如 "2026-W13"），`@unique` 唯一 | — |
| `editorial` | String | 否 | 可空，编辑点评（AI 生成） | AI 编辑点评生成失败时为 null，此时拼接所有 topic summaries 作为 fallback；若本周无数据则为 "本周无引用文章" |
| `createdAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |
| `updatedAt` | DateTime | 是 | ISO 8601 格式，自动更新 | — |
| `errorMessage` | String | 否 | 可空，记录失败步骤的错误信息 | 无错误步骤时为空 |
| `errorSteps` | Json | 否 | 可空数组，记录失败的阶段名 | 无错误步骤时为空 |

**校验规则**:
- `weekNumber` 唯一，不重复
- `editorial` 非空白字符串（trim 后）
- 若无数据，`editorial` 可为空，此时 `picks` 应为空数组

### 6. WeeklyPick 字段校验标准

| 字段 | 类型 | 必填 | 校验规则 | 为 Null 的原因 |
|------|------|------|----------|----------------|
| `id` | String | 是 | `cuid()` 生成，全局唯一 | — |
| `weeklyId` | String | 是 | 必须关联到存在的 WeeklyReport 记录 | — |
| `order` | Int | 是 | ≥ 0，表示精选排序顺序 | — |
| `itemId` | String | 是 | 必须关联到存在的 Item 记录 | — |
| `reason` | String | 是 | 非空字符串，推荐理由（AI 生成） | AI 推荐理由生成失败时，使用 `item.summary` 作为 fallback |
| `createdAt` | DateTime | 是 | ISO 8601 格式，默认 `now()` | — |

**校验规则**:
- `itemId` 必须存在于 Item 表（F-03 完整性检查）
- `reason` 非空（trim 后）
- `weeklyId` 必须关联到存在的 WeeklyReport

**索引**: `@index([weeklyId])`

### 7. 完整性校验清单（F 系列）

| 代码 | 校验项 | 校验逻辑 |
|------|--------|----------|
| F-01 | DigestTopic FK 无孤儿 | 所有 `topic.itemIds` 存在于 Item 表；所有 `topic.tweetIds` 存在于 Tweet 表 |
| F-03 | WeeklyPick FK 无孤儿 | 所有 `pick.itemId` 存在于 Item 表 |
| F-04 | topicCount 准确性 | 所有 `DailyOverview.topicCount === topics.length` |
| F-05 | 周报 item 来源 | 周报 `picks[].itemId` ⊆ 日报 `topics[].itemIds` |
| F-06 | Item 字段完整性 | 所有被引用的 Item 的 `title/url/sourceId` 非空 |
| F-07 | Tweet 字段完整性 | 所有被引用的 Tweet 的 `text/authorHandle/url` 非空 |

### 8. 空值发现时的处理流程

当完整性检查发现非空字段为 `null` 时，按以下流程处理：

**Step 1: 现场汇报**

在诊断报告中记录：
```
[FAIL] <校验项> - <字段名> 为 null
  - 记录 ID: <id>
  - 预期原因: <根据上表格中该字段的"为 Null 的原因">逐一核对
  - 当前状态: <实际业务场景描述>
```

**Step 2: 根因判断**

若 Null 值不符合上表中该字段的"为 Null 的原因"中的任何一种情况，则判定为**业务代码缺陷**。

**Step 3: 代码缺陷分析（subagent-driven-development 两阶段 review）**

触发条件：判定为业务代码缺陷时

1. **第一阶段：深度分析**
   - 使用 `subagent-driven-development` skill
   - 启动 general-purpose subagent 对以下文件进行根因分析：
     - `src/reports/daily.ts` — 日报生成逻辑
     - `src/reports/weekly.ts` — 周报生成逻辑
     - `src/archive/enrich*.ts` — AI 增强逻辑
     - `src/pipeline/collect.ts` — 数据收集逻辑
   - 分析目标：该字段在哪个阶段应被赋值，代码中是否遗漏或条件判断错误
   - 根因定位后，将分析结果写入 `findings.md`

2. **第二阶段：修复验证**
   - 根据 `findings.md` 中的根因修复代码
   - 重新运行诊断，确认该字段不再出现意外 null
   - 修复内容同步更新到本表格的"为 Null 的原因"列（如有新发现）

---

## 关键文件

- `scripts/diagnostics.ts` — CLI 入口
- `src/diagnostics/runners/full.ts` — 全流程编排
- `src/diagnostics/collection/run-collection.ts` — 收集执行器
- `src/pipeline/collect.ts` — 采集管道（adapters -> RawItem）
- `src/pipeline/normalize.ts` — 标准化（RawItem -> NormalizedItem）
- `src/pipeline/filter-by-pack.ts` — Pack 过滤（mustInclude/exclude）
- `src/pipeline/dedupe-exact.ts` / `dedupe-near.ts` — 去重
- `src/pipeline/rank.ts` — 入库（NormalizedItem -> Item）
- `src/reports/report-candidate.ts` — Item/Tweet -> ReportCandidate 映射
- `src/reports/scoring/` — 运行时评分管道（4 阶段：base -> signal -> merge -> history penalty）
- `src/reports/daily.ts` — 日报生成
- `src/reports/weekly.ts` — 周报生成
- `src/diagnostics/reports/verify-daily.ts` — 日报断言
- `src/diagnostics/reports/verify-weekly.ts` — 周报断言
- `src/diagnostics/reports/verify-integrity.ts` — 完整性断言

---

## 风险控制

- 生产数据库已清空内容，可承受写操作
- `--confirm-production` 已配置，防止误操作
- `playwriter` skill 用于页面验证，不修改任何数据

---

## 重要经验

### AI 环境变量加载优先级

**问题**: `tsx` (Bash 工具) 不加载 `.env` 文件。Claude Code `settings.json` 中注入的系统级环境变量优先级高于 `.env`。

**正确启动方式**:

```bash
# 方式 1: env 前缀显式覆盖（推荐）
env "ANTHROPIC_MODEL=GLM-5" \
   "ANTHROPIC_API_KEYS=7152d6764d10401fa7e5882ec44d071d.OKXrmnwAgD1ZOcCp" \
   "ANTHROPIC_BASE_URLS=https://open.bigmodel.cn/api/anthropic" \
   pnpm dev

# 方式 2: dotenv run（用于 scripts）
npx dotenv run -- npx tsx scripts/diagnostics.ts ...
```

### dev server 重启必要性

修改 `src/` 下的代码后，Next.js Turbopack 会热更新。但修改 `node_modules` 依赖或环境变量后需要手动重启 dev server。
