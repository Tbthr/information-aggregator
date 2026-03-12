# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 CLI 输出 Markdown 或 JSON 结果。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer (src/cli/)                            │
│   main.ts → parse-cli.ts → runQuery() / renderViewMarkdown()               │
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
│                 │  │ • dedupe-exact.ts   │  │ • x-analysis.ts                │
│                 │  │ • dedupe-near.ts    │  │ • render/ (Markdown 输出)      │
│                 │  │ • topic-match.ts    │  │                                │
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
│ • rss.ts        │  │           enrichment_results, extracted_content_cache  │
│ • json-feed.ts  │  └─────────────────────────────────────────────────────────┘
│ • x-bird.ts     │            ┌─────────────────────────────────────┐
│ • github-*      │            │   AI Layer (ai/) - Optional         │
└─────────────────┘            │   • providers/ (OpenAI/Anthropic/Gemini)│
                                │   • enrichArticle()                 │
                                │   • generateDailyBriefOverview()    │
                                │   • summarizePost()                 │
                                └─────────────────────────────────────┘
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
│  支持 4 种数据源类型: rss/json-feed/                               │
│  github_trending/x_*                                                │
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
│  内置视图: daily-brief / x-analysis / json                      │
└───────────────────────────────────────────────────────────────────┘
```

## 当前能力

- TypeScript + Bun CLI
- SQLite 持久化：sources、runs、outputs、source health、enrichment results
- Pack 驱动的数据源配置（自包含 YAML 文件）
- 已接入 `rss`、`json-feed`、`github_trending`
- 已接入基于 `bird CLI` 的 X family adapter（x_home、x_list、x_bookmarks、x_likes）
- 确定性的规范化、精确去重、近似去重、排序与聚类
- **深度 enrichment**：正文提取（使用 @mozilla/readability）、AI 关键点提取、标签生成
- 可选的 AI 抽象层，用于候选评分、cluster summary 与 digest narration 扩展

## 配置文件

配置位于 `config/packs/` 目录，每个 Pack 是一个自包含的 YAML 文件：

```
config/packs/
├── github.yaml           # GitHub Trending
├── karpathy-picks.yaml   # Karpathy 精选技术博客
├── tech-news.yaml        # 科技资讯聚合
├── test_daily.yaml       # 测试 Pack - Daily Brief
├── test_x_analysis.yaml  # 测试 Pack - X Analysis
├── x-bookmarks.yaml      # X 书签
├── x-home.yaml           # X 首页时间线
├── x-likes.yaml          # X 点赞
└── x-lists.yaml          # X 列表
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
    enabled: false  # 可选，默认 true
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `pack.id` | ✅ | Pack 唯一标识 |
| `pack.name` | ✅ | 显示名称 |
| `pack.description` | ❌ | Pack 描述 |
| `pack.keywords` | ❌ | 主题关键词列表，用于内容排序（见下方说明） |
| `sources[].type` | ✅ | 数据源类型 |
| `sources[].url` | ✅ | 数据源 URL |
| `sources[].description` | ❌ | 数据源描述 |
| `sources[].enabled` | ❌ | 是否启用，默认 true |

**keywords 工作原理**：

keywords 是一个**软过滤**机制，用于提升相关内容的排名，而非完全排除不匹配的内容：

1. **解析阶段**：当选择多个 pack 运行时，所有 pack 的 keywords 会被合并
2. **评分阶段**：系统遍历每条内容的标题和正文，根据关键词匹配情况计算 `topicMatchScore`
3. **排序阶段**：`topicMatchScore` 占最终排序权重的 **25%**

评分规则：

| 匹配条件 | 分数影响 |
|----------|----------|
| 标题或正文包含 include 关键词 | **+1** / 每个匹配 |
| 标题或正文包含 exclude 关键词 | **-2** / 每个匹配 |

**使用建议**：
- 选择能区分主题的**专有名词**（如 `OpenAI`、`Transformer`）而非通用词（如 `技术`）
- 关键词列表不宜过长，3-10 个为佳
- 多 pack 合并时，所有关键词会叠加生效

**数据源类型**：

| 类型 | 数据来源 | 特殊配置 |
|------|----------|----------|
| `rss` | RSS/Atom XML | - |
| `json-feed` | JSON Feed 1.1 | - |
| `github_trending` | GitHub Trending HTML | - |
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

### Auth 配置目录

授权相关配置统一存放在 `config/auth/` 目录，系统会自动将这些配置合并到对应类型的 source 中：

```
config/auth/
└── x-family.yaml    # X/Twitter 系列（x_home, x_list, x_bookmarks, x_likes）
```

配置文件示例（`config/auth/x-family.yaml`）：

```yaml
adapter: x_family
config:
  chromeProfile: Default
  cookieSource: chrome
  # 或使用直接 Token
  # authToken: "your_auth_token"
  # ct0: "your_ct0_token"
```

**验证命令**：
```bash
bun src/cli/main.ts auth check    # 检查默认类型（x-family）
bun src/cli/main.ts auth status   # 显示所有 auth 配置状态
```

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
bun run smoke          # 纯本地验证（无网络依赖）
bun run e2e:real       # 完整数据流验证（需要网络和认证）
bun src/cli/main.ts --help
bun src/cli/main.ts --version
bun src/cli/main.ts config validate
bun src/cli/main.ts sources list
```

### 查询命令

```bash
# 单 Pack 查询
bun src/cli/main.ts run --pack ai-news --view daily-brief --window 24h
bun src/cli/main.ts run --pack ai-news --view x-analysis --window 7d
bun src/cli/main.ts run --pack karpathy-picks --view json --window all

# 多 Pack 合并查询
bun src/cli/main.ts run --pack ai-news,tech-news --view daily-brief --window 24h

# 输出到文件（推荐用于大数据量）
bun src/cli/main.ts run --pack x-sources --view json --window all --output out/result.json

# 禁用 AI 增强
bun src/cli/main.ts run --pack ai-news --view daily-brief --window 24h --no-ai
```

### 参数说明

| 参数 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| `--pack` | ✅ | Pack ID，支持逗号分隔的多 Pack | `ai-news` 或 `ai-news,tech-news` |
| `--view` | ✅ | 输出格式 | `json`, `daily-brief`, `x-analysis` |
| `--window` | ✅ | 时间窗口 | `24h`, `7d`, `3d`, `all` |
| `--output` | ❌ | 输出文件路径，直接写入文件（避免大数据管道编码问题） | `out/result.json` |
| `--no-ai` | ❌ | 禁用 AI 增强功能 | （无值） |

**注意**：输出大量数据时（如 X 数据源），建议使用 `--output` 参数直接写入文件，避免通过 stdout 管道可能出现的编码问题。

## 输出模式

| 视图 | 输出格式 | 说明 |
|------|---------|------|
| `json` | JSON | 原始数据，供程序消费 |
| `daily-brief` | Markdown | AI 生成：今日看点、主要看点、Top 10 文章（描述+推荐理由+标签）、标签云 |
| `x-analysis` | Markdown | AI 生成：每篇帖子摘要+标签，互动数据，标签云 |

### `daily-brief` 输出示例

```md
# Daily Digest

## 今日看点

今日技术社区动态呈现出...

### 主要看点

- 看点1
- 看点2
- 看点3

## 精选文章

### [文章标题](https://example.com/post)

> 一句话描述

**为什么值得关注**: 推荐理由

**标签**: `tag1` `tag2` `tag3`

## 标签云

`标签1` `标签2` `标签3`
```

## 示例工作流

```bash
bun run smoke
```

更完整的验证说明请见 [`TEST.md`](./TEST.md)。

```bash
bun src/cli/main.ts config validate
bun src/cli/main.ts run --pack ai-news --view daily-brief --window 24h
bun src/cli/main.ts run --pack karpathy-picks --view daily-brief --window 7d
```

## 后续计划

以下内容已经进入持续迭代路线图：

- 排序逻辑重构
- 更稳的 `github_trending` source 治理
- feedback loop 与自适应排序
- Web UI
- 多用户能力
- embedding / vector search

## 当前实现状态

截至 2026-03-13，仓库当前状态为：

- 已完成：项目脚手架与 CLI
- 已完成：本地 YAML 配置加载与校验
- 已完成：Pack 驱动的数据源配置
- 已完成：SQLite schema 与核心表
- 已完成：`rss`、`json-feed` adapter
- 已完成：`github_trending` adapter
- 已完成：X family `bird CLI` adapter（x_home、x_list、x_bookmarks、x_likes）
- 已完成：Auth 配置统一管理（`config/auth/` 目录）
- 已完成：CLI `auth check/status` 命令
- 已完成：规范化、去重、topic match、排序、聚类
- 已完成：`run --pack --view --window` 查询入口、Markdown / JSON 输出
- 已完成：AI 增强视图（daily-brief、x-analysis）
- 已完成：raw items、normalized items、clusters 的 end-to-end 持久化
- 已完成：深度 enrichment（正文提取、AI 关键点提取、标签生成）
- 已完成：Enrichment 结果持久化（`enrichment_results`、`extracted_content_cache` 表）
- 尚未实现：feedback learning、Web UI、多用户能力
