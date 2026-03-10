# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 `run --view <view>` 查询入口输出 Markdown 或 JSON 结果。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer (cli/)                               │
│   aggregator.ts → parse-cli.ts → run-digest.ts / run-scan.ts               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Query Layer (query/)                             │
│   QuerySpec → resolveSelection() → runQuery() → QueryResult                │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                      │
          ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────────┐  ┌────────────────────────────────┐
│ Config Layer    │  │   Pipeline Layer    │  │   Views/Render Layer           │
│ (config/)       │  │   (pipeline/)       │  │   (views/, render/)            │
├─────────────────┤  ├─────────────────────┤  ├────────────────────────────────┤
│ • load.ts       │  │ • collect.ts        │  │ • registry.ts                  │
│ • validate.ts   │  │ • normalize.ts      │  │ • daily-brief.ts               │
│                 │  │ • dedupe-exact.ts   │  │ • item-list.ts                 │
│                 │  │ • dedupe-near.ts    │  │ • x-*.ts                       │
│                 │  │ • topic-match.ts    │  │ • digest.ts / json.ts          │
│                 │  │ • enrich.ts         │  │                                │
│                 │  │ • rank.ts           │  │                                │
│                 │  │ • cluster.ts        │  │                                │
└─────────────────┘  └─────────────────────┘  └────────────────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────┐  ┌─────────────────────────────────────────────────────────┐
│ Adapters Layer  │  │   DB Layer (db/)                                        │
│ (adapters/)     │  │   SQLite: sources, raw_items, normalized_items,        │
├─────────────────┤  │           clusters, runs, outputs, source_health       │
│ • rss.ts        │  └─────────────────────────────────────────────────────────┘
│ • json-feed.ts  │
│ • website.ts    │            ┌─────────────────────────────────────┐
│ • hn.ts         │            │   AI Layer (ai/) - Optional         │
│ • reddit.ts     │            │   • scoreCandidate()                │
│ • x-bird.ts     │            │   • summarizeCluster()              │
│ • custom-api.ts │            │   • narrateDigest()                 │
│ • github-*      │            └─────────────────────────────────────┘
│ • opml-rss.ts   │
│ • digest-feed.ts│
└─────────────────┘
```

### 核心数据流

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  QuerySpec   │───▶│ resolveSelection│───▶│  Selected Sources│
│ (CLI/Profile)│    │  (Profile+View) │    │   + TopicRule    │
└──────────────┘    └─────────────────┘    └────────┬─────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Collect Phase                              │
│  adapters[type](source) → RawItem[] → normalizeCollectedItem()   │
│  支持 14 种数据源类型: rss/json-feed/website/hn/reddit/          │
│  opml_rss/digest_feed/custom_api/github_trending/x_*             │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                      Normalize Phase                              │
│  RawItem → NormalizedItem                                        │
│  • resolveCanonicalUrl() - URL 规范化                            │
│  • normalizeTitle/Snippet() - 文本规范化                          │
│  • toBoundedEngagementScore() - 互动量归一化 (log scale)          │
│  • exactDedupKey = canonicalUrl                                  │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Dedupe Phase                              │
│  1. dedupeExact(): 按 canonicalUrl 去重                          │
│     - 内容类型优先级: article > digest_entry > community_post    │
│  2. dedupeNear(): 按标题相似度去重 (threshold=0.74)              │
│     - 同一日内、Jaccard 相似度 >= 74% 视为重复                    │
│     - 保留时间戳更新的条目                                        │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                       Enrich Phase                               │
│  toCandidates() → enrichCandidates()                             │
│  • scoreTopicMatch() - 关键词匹配评分                             │
│  • contentQualityAi - 可选 AI 质量评分                            │
│  • 计算 sourceWeightScore / freshnessScore                       │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Rank Phase                                │
│  rankCandidates() → finalScore                                   │
│  加权公式:                                                        │
│  finalScore = sourceWeight × 0.30   // 来源权重                   │
│             + freshness × 0.25      // 新鲜度                     │
│             + topicMatch × 0.25     // 主题相关性                 │
│             + engagement × 0.10     // 互动量                     │
│             + contentQualityAi × 0.1 // AI评分（可选）            │
│             - community_post ? 0.12 : 0  // 社区内容惩罚          │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                       Cluster Phase                              │
│  buildClusters() → Cluster[]                                     │
│  • 按标题相似度聚合相关内容 (threshold=0.74)                      │
│  • 每个簇选一个 canonicalItem + memberItemIds                     │
└───────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                   View/Render Phase                              │
│  buildViewModel(result, viewId) → ViewModel                      │
│  renderViewMarkdown(model, viewId) → Markdown/JSON               │
│                                                                  │
│  内置视图: item-list / daily-brief / x-bookmarks-analysis /      │
│           x-likes-analysis / x-longform-hot                      │
└───────────────────────────────────────────────────────────────────┘
```

## 技术实现原理

### 1. 数据采集适配器模式

每个数据源类型对应一个适配器，遵循统一的函数签名：

```typescript
type AdapterFn = (source: Source) => Promise<RawItem[]>;

interface CollectDependencies {
  adapters: Record<string, AdapterFn>;
  onSourceEvent?: (event: CollectSourceEvent) => void;
}
```

**设计优势**：
- 通过依赖注入实现可测试性（E2E 测试可注入 mock adapters）
- 新增数据源只需实现 `AdapterFn` 并注册
- 统一的 `onSourceEvent` 回调用于监控采集状态

**已实现适配器**：

| 类型 | 文件 | 数据来源 | 特殊配置 |
|------|------|----------|----------|
| `rss` | rss.ts | RSS/Atom XML | - |
| `json-feed` | json-feed-collect.ts | JSON Feed 1.1 | - |
| `website` | website.ts | HTML 链接提取 | - |
| `hn` | hn.ts | HN Algolia API | - |
| `reddit` | reddit.ts | Reddit JSON API | - |
| `github_trending` | github-trending.ts | GitHub Trending HTML | - |
| `opml_rss` | opml-rss.ts | 本地 OPML 文件 | `config.path` |
| `digest_feed` | digest-feed.ts | 自定义格式 | `config.format` |
| `custom_api` | custom-api.ts | 任意 JSON API | `config.itemPath`, `config.fieldMap` |
| `x_*` | x-bird.ts | bird CLI | `config.birdMode`, `config.authTokenEnv` |

### 2. 确定性流水线设计

Pipeline 核心模块全部为**纯函数**，保证：
- 相同输入 → 相同输出
- 无副作用，易于测试
- 可独立验证每个阶段

```typescript
// normalize.ts - 纯函数
export function normalizeItems(items: RawItem[]): NormalizedItem[]

// dedupe-exact.ts - 纯函数
export function dedupeExact<T extends ExactDedupItem>(items: T[]): T[]

// dedupe-near.ts - 纯函数
export function dedupeNear<T extends NearDedupItem>(items: T[], threshold = 0.74): T[]

// rank.ts - 纯函数
export function rankCandidates<T extends RankedCandidate>(candidates: T[]): Array<T & { finalScore: number }>

// cluster.ts - 纯函数
export function buildClusters(items: ClusterableItem[], runId: string): Cluster[]
```

### 3. 评分算法详解

**综合评分公式**：

```
finalScore = Σ(weight_i × score_i) - penalty

where:
  weight_source = 0.30  (来源权重)
  weight_freshness = 0.25 (新鲜度)
  weight_topic = 0.25  (主题匹配)
  weight_engagement = 0.10 (互动量)
  weight_ai = 0.10 (AI质量评分，可选)
  penalty = 0.12 (仅 community_post)
```

**互动量评分归一化**（对数尺度）：

```typescript
function toBoundedEngagementScore(metadataJson: string): number {
  const score = metadata?.engagement?.score ?? 0;
  const comments = metadata?.engagement?.comments ?? 0;
  const total = Math.max(0, score) + Math.max(0, comments * 0.5);
  return Math.min(1, Math.log10(total + 1) / 2);
}
```

**主题匹配评分**：

```typescript
function scoreTopicMatch(item: NormalizedItem, rule: TopicRule): number {
  const text = item.normalizedText?.toLowerCase() ?? "";
  const keywords = rule.includeKeywords ?? [];
  const matches = keywords.filter(k => text.includes(k.toLowerCase()));
  return keywords.length > 0 ? matches.length / keywords.length : 0;
}
```

### 4. 去重策略

**两阶段去重**：

1. **精确去重** (`dedupeExact`)：按 `canonicalUrl` 完全匹配
   - 内容类型优先级：`article (3) > digest_entry (2) > community_post (1)`
   - 同 URL 多源时保留优先级高的

2. **近似去重** (`dedupeNear`)：按标题相似度匹配
   - 条件：同一天内 + Jaccard 相似度 >= 0.74
   - 保留时间戳更新的条目

```typescript
function overlapRatio(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}
```

### 5. 视图系统

视图系统采用 **Builder + Renderer** 分离模式：

```typescript
interface ViewModel {
  viewId: string;
  title: string;
  summary?: string;      // AI 生成的摘要（可选）
  highlights?: string[];
  sections: ViewModelSection[];
}

// 构建器：QueryResult → ViewModel
function buildViewModel(result: QueryResult, viewId: string): ViewModel

// 渲染器：ViewModel → Markdown/JSON
function renderViewMarkdown(model: ViewModel, viewId: string): string
```

**内置视图结构**：

| 视图 | 结构 | 用途 |
|------|------|------|
| `item-list` | Ranked Items 列表 | 快速浏览 |
| `daily-brief` | Highlights + Top Clusters + Supporting | 每日摘要 |
| `x-bookmarks-analysis` | Summary + Top Themes + Notable Items | X 收藏分析 |
| `x-likes-analysis` | 同上 | X 点赞分析 |
| `x-longform-hot` | Hot Posts + Linked Articles + Clusters | X 长文发现 |

### 6. 配置层级

```
Profile (预设)
├── topicIds[] ──────▶ Topics (关键词)
├── sourcePackIds[] ──▶ SourcePacks ▶▶ Sources
├── defaultView ──────▶ View 定义
└── defaultWindow ────▶ 时间窗口

Query (运行时)
├── profileId (继承上述默认值)
├── sourceIds/sourceTypes/packIds (覆盖/合并)
├── viewId (覆盖)
└── window/since/until (覆盖)
```

**优先级**：CLI 参数 > Profile 默认值 > View 默认值

### 7. AI 集成边界

AI 功能设计为**可选扩展**，不影响核心流水线的确定性：

```typescript
interface AiClient {
  scoreCandidate(prompt: string): Promise<number>;     // 内容质量 0-1
  summarizeCluster(prompt: string): Promise<string>;   // 簇摘要
  narrateDigest(prompt: string): Promise<string>;      // 摘要叙述
}

// 使用时：
const rankedItems = rankCandidates(
  await enrichCandidates(candidates, {
    limit: 5,
    scoreCandidate: aiClient
      ? (c) => aiClient.scoreCandidate(buildPrompt(c))
      : undefined,  // 无 AI 时跳过
  })
);
```

**设计原则**：
- AI 评分仅占 `finalScore` 的 10% 权重
- 无 AI 配置时，`contentQualityAi = 0`，不影响排序逻辑
- 核心流程不依赖 AI 输出

### 8. 依赖注入与可测试性

所有外部依赖通过可选参数注入，便于 E2E 测试：

```typescript
// runQuery 的依赖注入接口
interface RunQueryDependencies {
  aiClient?: AiClient | null;
  loadSources?: () => Promise<Source[]>;
  loadProfiles?: () => Promise<TopicProfile[]>;
  loadTopics?: () => Promise<TopicDefinition[]>;
  loadSourcePacks?: () => Promise<SourcePack[]>;
  loadViews?: () => Promise<QueryViewDefinition[]>;
  collectSources?: (sources, deps) => Promise<RawItem[]>;
  buildClusters?: typeof buildClusters;
  now?: () => string;
}

// E2E 测试示例
const result = await runQuery(query, {
  loadSources: getXMockSources,
  collectSources: (sources, deps) => {
    return collectSources(sources, {
      ...deps,
      adapters: { ...deps.adapters, ...mockAdapters },
    });
  },
});
```

### 9. 数据持久化

SQLite schema 包含以下核心表：

| 表名 | 职责 |
|------|------|
| `sources` | 数据源配置与元数据 |
| `raw_items` | 原始采集数据 |
| `normalized_items` | 规范化后的条目 |
| `clusters` | 内容聚类结果 |
| `runs` | 执行记录 |
| `outputs` | 输出结果 |
| `source_health` | 数据源健康状态监控 |

---

## 当前能力

- TypeScript + Bun CLI
- SQLite 持久化：sources、runs、outputs、source health
- 配置驱动的 sources、source packs、topics、profiles、views
- 已接入 `rss`、`json-feed`、`website`、`hn`、`reddit`
- 已接入 `github_trending`、`digest_feed`、`custom_api`、`opml_rss`
- 已接入基于 `bird CLI` 的 X family adapter
- 确定性的规范化、精确去重、近似去重、排序与聚类
- 可选的 AI 抽象层，用于候选评分、cluster summary 与 digest narration 扩展

## 配置文件

示例配置位于 [`config/`](./config)：

- `sources.example.yaml`
- `topics.example.yaml`
- `profiles.example.yaml`
- `views.example.yaml`
- `config/packs/ai-news-sites.yaml`
- `config/packs/engineering-blogs-core.yaml`

当前默认使用本地 YAML 配置并运行在本地状态之上。

### 示例

```yaml
# config/sources.example.yaml
sources:
  - id: openai-news
    name: OpenAI News
    type: rss
    enabled: true
    url: https://openai.com/news/rss.xml

  - id: techurls
    name: TechURLs
    type: website
    enabled: true
    url: https://techurls.com/

  - id: simon-willison
    name: Simon Willison
    type: website
    enabled: true
    url: https://simonwillison.net/
```

X family 最小配置示例：

```yaml
  - id: x-home-local
    name: X Home Local
    type: x_home
    enabled: true
    url: https://x.com/home
    config:
      birdMode: home
      chromeProfile: Default
      cookieSource:
        - chrome
```

如果不走浏览器 cookie，也可以改用显式 token：

```yaml
    config:
      birdMode: home
      authTokenEnv: BIRD_AUTH_TOKEN
      ct0Env: BIRD_CT0
```

```yaml
# config/topics.example.yaml
topics:
  - id: ai-news
    name: AI News
    keywords:
      - ai
      - model
```

```yaml
# config/profiles.example.yaml
profiles:
  - id: default
    name: Default Query
    topicIds:
      - ai-news
      - engineering-blogs
    sourcePackIds:
      - ai-news-sites
      - engineering-blogs-core
    defaultView: daily-brief
    defaultWindow: 24h
```

## 默认配置与 Pack taxonomy

当前 `config/packs` 只保留可直接参与 runtime resolution 的 pack：

- `ai-news-sites`：默认启用的公开 AI 新闻站与聚合站
- `engineering-blogs-core`：默认启用的工程博客核心源

注意：

- 当前仓库内部只保留 canonical source type 命名
- `config/sources.example.yaml` 默认只暴露可直接运行的公开 source
- `custom_api`、`opml_rss`、X family 这类依赖本地文件、登录态或外部前置条件的 source，应由使用者在本地配置中按需添加
- `config.placeholderMode: schema` 仍可用于 source 级 schema placeholder，但不再通过 pack 暴露为 reference-only 运行分组
- 当前 Phase 4 的首个质量提升切片是确定性的 link relation enrichment：优先消费已有 `canonicalHints`，显式区分原文、讨论源与分享源，而不是直接引入正文抓取

## 命令

```bash
bun install
bun test
bun run check
bun run smoke
bun run e2e
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts run --view item-list
bun scripts/aggregator.ts run --view daily-brief
bun scripts/aggregator.ts run --view x-bookmarks-analysis
bun scripts/aggregator.ts run --view item-list --format json
bun scripts/aggregator.ts sources list --source-type rss
bun scripts/aggregator.ts config validate
```

## 输出模式

- `item-list`：适合快速浏览的排序 Markdown 列表
- `daily-brief`：带高亮与聚类的结构化 Markdown 摘要
- `x-bookmarks-analysis` / `x-likes-analysis`：面向 X 收藏/点赞的分析视图
- `x-longform-hot`：面向 X 长文与外链热度的发现视图
- `--format json`：输出稳定的中间层 JSON，包含 `query`、`selection`、`rankedItems`、`clusters` 与 `viewModel`
- `scan` / `digest`：仍可调用，但仅作为 deprecated thin wrapper

## 示例工作流

```bash
bun run smoke
```

更完整的验证说明请见 [`docs/testing.md`](./docs/testing.md)。

```bash
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts run --view item-list
bun scripts/aggregator.ts run --view daily-brief
```

### `item-list` 输出示例

```md
# Scan Results

- [Example title](https://example.com/post)
  - Source: Query View
  - Score: 0.82
```

### `daily-brief` 输出示例

```md
# Daily Digest

## Highlights

- Example title

## Top Clusters

- [Example title](https://example.com/post)
  - Why it matters
```

## 后续计划

以下内容已经进入持续迭代路线图：

- X family 的授权配置、手动 probe 与兼容性收敛
- 更稳的 `github_trending` / `digest_feed` / `custom_api` / `opml_rss` source 治理
- 更深的正文提取与 enrichment
- feedback loop 与自适应排序
- Web UI
- 多用户能力
- embedding / vector search

## 当前实现状态

截至 2026-03-11，仓库当前状态为：

- 已完成：项目脚手架与 CLI
- 已完成：本地 YAML 配置加载与校验
- 已完成：按 source taxonomy 组织的 source config 与 source packs
- 已完成：SQLite schema 与核心表
- 已完成：`rss`、`json-feed`、`website` adapter
- 已完成：`hn`、`reddit` 的 collector 路径支持
- 已完成：`github_trending`、`digest_feed`、`custom_api`、`opml_rss` adapter
- 已完成：X family `bird CLI` adapter，需本地授权后手动 probe
- 已完成：profile preset、view config、统一 selection resolution
- 已完成：规范化、去重、topic match、排序、聚类
- 已完成：`run --view` 查询入口、Markdown / JSON 输出
- 已完成：`scan` 与 `digest` thin wrapper 兼容层
- 已完成：候选评分、cluster summary、digest narration 的 AI hook
- 已完成：raw items、normalized items、clusters 的 end-to-end 持久化
- 尚未实现：深度 enrichment、feedback learning、Web UI、多用户能力
