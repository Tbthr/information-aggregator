# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 CLI 输出 Markdown 或 JSON 结果。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer (cli/)                               │
│   aggregator.ts → parse-cli.ts → runQuery() / renderViewMarkdown()         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Query Layer (query/)                             │
│   ParsedRunArgs → resolveSelection() → runQuery() → QueryResult            │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                      │
          ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────────┐  ┌────────────────────────────────┐
│ Config Layer    │  │   Pipeline Layer    │  │   Views/Render Layer           │
│ (config/)       │  │   (pipeline/)       │  │   (views/, render/)            │
├─────────────────┤  ├─────────────────────┤  ├────────────────────────────────┤
│ • load-pack.ts  │  │ • collect.ts        │  │ • registry.ts                  │
│ • load-auth.ts  │  │ • normalize.ts      │  │ • daily-brief.ts               │
│                 │  │ • dedupe-exact.ts   │  │ • item-list.ts                 │
│                 │  │ • dedupe-near.ts    │  │ • x-*.ts                       │
│                 │  │ • topic-match.ts    │  │ • render helpers / json.ts      │
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
│ • json-feed.ts  │            ┌─────────────────────────────────────┐
│ • website.ts    │            │   AI Layer (ai/) - Optional         │
│ • hn.ts         │            │   • scoreCandidate()                │
│ • reddit.ts     │            │   • summarizeCluster()              │
│ • x-bird.ts     │            │   • narrateDigest()                 │
│ • github-*      │            └─────────────────────────────────────┘
│ • digest-feed.ts│
└─────────────────┘
```

### 核心数据流

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ ParsedRunArgs│───▶│ resolveSelection│───▶│  Selected Sources│
│ (--pack etc) │    │   (Pack-based)  │    │   + TopicRule    │
└──────────────┘    └─────────────────┘    └────────┬─────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Collect Phase                              │
│  adapters[type](source) → RawItem[] → normalizeCollectedItem()   │
│  支持 11 种数据源类型: rss/json-feed/website/hn/reddit/          │
│  digest_feed/github_trending/x_*                                 │
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
│  • extractContent() - 正文提取（可选）                            │
│  • AI enrichment - 关键点提取、标签生成、质量评分                  │
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
│  内置视图: item-list / daily-brief / json                        │
└───────────────────────────────────────────────────────────────────┘
```

## 当前能力

- TypeScript + Bun CLI
- SQLite 持久化：sources、runs、outputs、source health、enrichment results
- Pack 驱动的数据源配置（自包含 YAML 文件）
- 已接入 `rss`、`json-feed`、`website`、`hn`、`reddit`
- 已接入 `github_trending`、`digest_feed`、`custom_api`、`opml_rss`
- 已接入基于 `bird CLI` 的 X family adapter
- 确定性的规范化、精确去重、近似去重、排序与聚类
- **深度 enrichment**：正文提取（使用 @mozilla/readability）、AI 关键点提取、标签生成
- 可选的 AI 抽象层，用于候选评分、cluster summary 与 digest narration 扩展

## 配置文件

配置位于 `config/packs/` 目录，每个 Pack 是一个自包含的 YAML 文件：

```
config/packs/
├── ai-news.yaml        # AI 新闻与动态（5 sources）
├── karpathy-picks.yaml # Karpathy 精选技术博客（90 sources）
├── reference.yaml      # Adapter schema 示例（12 sources）
├── security.yaml       # 网络安全（5 sources）
└── tech-news.yaml      # 科技资讯聚合（8 sources）
```

### Pack 文件结构

```yaml
# config/packs/ai-news.yaml
pack:
  id: ai-news
  name: AI 新闻与动态
  description: AI 领域的新闻站点、公司博客、研究动态
  keywords: [GPT, LLM, 机器学习, AI, 人工智能, OpenAI, Claude]

sources:
  - type: rss
    url: https://openai.com/news/rss.xml
    description: OpenAI 官方新闻和产品发布

  - type: rss
    url: https://huggingface.co/blog/feed.xml
    description: Hugging Face 技术博客

  - type: website
    url: https://techurls.com/
    description: 技术新闻聚合
    enabled: false  # 可选，默认 true
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `pack.id` | ✅ | Pack 唯一标识 |
| `pack.name` | ✅ | 显示名称 |
| `pack.description` | ❌ | Pack 描述 |
| `pack.keywords` | ❌ | 主题关键词列表，用于内容过滤 |
| `sources[].type` | ✅ | 数据源类型 |
| `sources[].url` | ✅ | 数据源 URL |
| `sources[].description` | ❌ | 数据源描述 |
| `sources[].enabled` | ❌ | 是否启用，默认 true |

**数据源类型**：

| 类型 | 数据来源 | 特殊配置 |
|------|----------|----------|
| `rss` | RSS/Atom XML | - |
| `json-feed` | JSON Feed 1.1 | - |
| `website` | HTML 链接提取 | - |
| `hn` | HN Algolia API | - |
| `reddit` | Reddit JSON API | - |
| `github_trending` | GitHub Trending HTML | - |
| `digest_feed` | 自定义格式 | `config.format` |
| `x_*` | bird CLI | 见下方详细配置 |

### X/Twitter 数据源配置

X/Twitter 数据源需要 [bird CLI](https://github.com/nicoulaj/bird) 和浏览器授权。通过 `configJson` 字段配置：

```yaml
sources:
  - type: x_home
    url: https://x.com/home
    description: X 首页时间线
    configJson: '{"birdMode":"home","count":50}'

  - type: x_list
    url: https://x.com/i/lists/123456789
    description: X 列表
    configJson: '{"birdMode":"list","listId":"123456789","count":100}'
```

**支持的 birdMode**：

| birdMode | 说明 | 数据源类型 |
|----------|------|-----------|
| `home` | 首页时间线 | `x_home` |
| `list` | 列表时间线 | `x_list` |
| `bookmarks` | 书签 | `x_bookmarks` |
| `likes` | 点赞 | `x_likes` |

**configJson 参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `birdMode` | string | 必填，bird CLI 模式 |
| `listId` | string | list 模式必填，列表 ID |
| `count` | number | 拉取数量，默认 20 |
| `fetchAll` | boolean | 分页拉取全部（仅 list/bookmarks/likes，有封号风险） |
| `maxPages` | number | 配合 fetchAll，限制最大页数（每页约 100 条） |
| `authTokenEnv` | string | 环境变量名，提供 Twitter auth_token |
| `ct0Env` | string | 环境变量名，提供 Twitter ct0 token |
| `chromeProfile` | string | Chrome 配置文件名（用于提取 cookie） |
| `chromeProfileDir` | string | Chrome 配置文件目录 |

**认证方式**（二选一）：

1. **浏览器 Cookie**：设置 `chromeProfile` 让 bird 自动提取 cookie
2. **环境变量**：设置 `authTokenEnv` 和 `ct0Env` 从环境变量读取 token

### 从 OPML 导入

如果你有 OPML 文件（从 Feedly、Inoreader 等导出），可以让 AI 帮你转化为项目的 pack 配置：

```
请帮我把这个 OPML 文件转换为 information-aggregator 的 pack 配置：
[粘贴 OPML 内容]
```

## 命令

```bash
bun install
bun test
bun run check
bun run smoke
bun run e2e
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts --version
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts sources list
```

### 查询命令

```bash
# 单 Pack 查询
bun run aggregator run --pack ai-news --view daily-brief --window 24h
bun run aggregator run --pack ai-news --view item-list --window 7d
bun run aggregator run --pack karpathy-picks --view json --window all

# 多 Pack 合并查询
bun run aggregator run --pack ai-news,tech-news --view daily-brief --window 24h

# 输出到文件（推荐用于大数据量）
bun run aggregator run --pack x-sources --view json --window all --output out/result.json
```

### 参数说明

| 参数 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| `--pack` | ✅ | Pack ID，支持逗号分隔的多 Pack | `ai-news` 或 `ai-news,tech-news` |
| `--view` | ✅ | 输出格式 | `json`, `daily-brief`, `item-list` |
| `--window` | ✅ | 时间窗口 | `24h`, `7d`, `3d`, `all` |
| `--output` | ❌ | 输出文件路径，直接写入文件（避免大数据管道编码问题） | `out/result.json` |

**注意**：输出大量数据时（如 X 数据源），建议使用 `--output` 参数直接写入文件，避免通过 stdout 管道可能出现的编码问题。

## 输出模式

| 视图 | 输出格式 | 说明 |
|------|---------|------|
| `json` | JSON | 原始数据，供程序消费 |
| `daily-brief` | Markdown | 摘要格式：Highlights + Clusters + Supporting Items |
| `item-list` | Markdown | 简单列表格式 |

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

## 示例工作流

```bash
bun run smoke
```

更完整的验证说明请见 [`TEST.md`](./TEST.md)。

```bash
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts run --pack ai-news --view daily-brief --window 24h
bun scripts/aggregator.ts run --pack karpathy-picks --view item-list --window 7d
```

## 后续计划

以下内容已经进入持续迭代路线图：

- X family 的授权配置、手动 probe 与兼容性收敛
- 更稳的 `github_trending` / `digest_feed` / `custom_api` / `opml_rss` source 治理
- feedback loop 与自适应排序
- Web UI
- 多用户能力
- embedding / vector search

## 当前实现状态

截至 2026-03-12，仓库当前状态为：

- 已完成：项目脚手架与 CLI
- 已完成：本地 YAML 配置加载与校验
- 已完成：Pack 驱动的数据源配置
- 已完成：SQLite schema 与核心表
- 已完成：`rss`、`json-feed`、`website` adapter
- 已完成：`hn`、`reddit` 的 collector 路径支持
- 已完成：`github_trending`、`digest_feed`、`custom_api`、`opml_rss` adapter
- 已完成：X family `bird CLI` adapter，需本地授权后手动 probe
- 已完成：规范化、去重、topic match、排序、聚类
- 已完成：`run --pack --view --window` 查询入口、Markdown / JSON 输出
- 已完成：候选评分、cluster summary、digest narration 的 AI hook
- 已完成：raw items、normalized items、clusters 的 end-to-end 持久化
- 已完成：深度 enrichment（正文提取、AI 关键点提取、标签生成）
- 尚未实现：feedback learning、Web UI、多用户能力
