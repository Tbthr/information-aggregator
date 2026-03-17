# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 CLI 输出 Markdown 或 JSON 结果。

## 架构概览

### 目录结构

- `src/adapters/`：数据源适配器（fetch / parse）
- `src/api/`：HTTP API 服务（Hono 框架）
- `src/archive/`：数据归档功能
- `src/cache/`：内容缓存层
- `src/config/`：YAML 配置加载与校验
- `src/db/`：SQLite schema 与 query helpers
- `src/pipeline/`：核心处理流水线（collect → normalize → dedupe → policy_filter → enrich → rank → cluster）
- `src/query/`：查询引擎（CLI parser、selection resolver）
- `src/views/`：视图层（registry、view model 构建）
- `src/views/render/`：Markdown 渲染
- `src/render/`：JSON 等其他格式输出
- `src/templates/`：模板加载器（prompt、view 模板）
- `src/ai/`：AI 客户端抽象层
  - `config/`：配置加载（settings.yaml → 环境变量）
  - `providers/`：策略模式实现（Anthropic、Gemini、OpenAI）
  - `prompts*.ts`：各场景 prompt
- `src/cli/`：CLI 入口点
- `src/verification/`：验证辅助（smoke、e2e）
- `config/packs/`：Pack 配置目录
- `config/prompts/`：AI prompt 模板
- `config/views/`：视图模板
- `.github/workflows/`：GitHub Actions 自动化

### 核心数据流

1. **Collect**：从各数据源拉取内容（adapters）
2. **Normalize**：URL/文本规范化
3. **Dedupe**：精确 + 近似去重
4. **Policy Filter**：按 source / pack policy 执行 AI 过滤判断
5. **Enrich**：正文提取 + AI 增强
6. **Rank**：加权评分
7. **Cluster**：相似内容聚合
8. **Render**：输出 Markdown/JSON

## 当前能力

- TypeScript + Bun CLI
- SQLite 持久化：sources、runs、outputs、source health、enrichment results
- Pack 驱动的数据源配置（自包含 YAML 文件）
- 已接入 `rss`、`json-feed`、`github_trending`
- 已接入基于 `bird CLI` 的 X family adapter（x_home、x_list、x_bookmarks、x_likes、x_user_tweets、x_search、x_trending）
- 可选的 AI 抽象层，用于候选评分、cluster summary 与 digest narration 扩展
- Source Policy：支持 `assist_only` / `filter_then_assist`
- AI 过滤判断：支持 `keepDecision`、`keepReason`、`readerBenefit`、`readingHint`
- Web 四视图：日报首页、Pack 视图、来源详情页、周报页
- Save For Later：支持保存、取消保存与日报聚合展示

## 前端入口

- `/`：日报首页
- `/items`：通用列表页
- `/pack/:id`：Pack 详情页
- `/source/:id`：来源详情页
- `/weekly`：周报页

## 前端验证要求

- 前端开发/构建请使用受支持的 Node 版本：`^20.19.0` 或 `^22.12.0`。当前仓库已通过 `frontend/package.json` 将 `esbuild` 固定到 `0.25.12`，用于规避旧版本在本机环境下的挂起问题。
- `cd frontend && bun run test:e2e` 会自动拉起本地 API（3000）与 Vite 前端（5173），用于页面级回归。
- 涉及前端页面样式、布局、图表或关键交互时，除了类型检查和构建，还需要使用 `chrome-cdp` skill 进行浏览器验证。
- 推荐验证路径：`/`、`/weekly`、`/source/:id`
- 至少检查：布局结构、空态/错误态、图表可见性、Save 按钮交互

## 配置文件

配置位于 `config/` 目录：

```
config/
├── packs/           # Pack 配置目录
├── auth/            # Auth 配置目录
└── settings.yaml    # AI 配置（可选）
```

### AI 配置（settings.yaml）

AI 功能通过 `config/settings.yaml` 配置：

```yaml
# config/settings.yaml
ai:
  # 默认使用的 provider: anthropic | gemini | openai
  defaultProvider: anthropic

  anthropic:
    # 支持环境变量引用
    authToken: ${ANTHROPIC_AUTH_TOKEN}
    model: claude-3-5-sonnet-latest
    # baseUrl: https://api.anthropic.com

  gemini:
    apiKey: ${GEMINI_API_KEY}
    # model: gemini-2.0-flash  # 可选，默认 gemini-2.0-flash
```

**配置优先级**（从高到低）：

| 优先级 | 来源 | 场景 |
|--------|------|------|
| 1 | 显式传参 | 单元测试、特殊场景 |
| 2 | 配置文件 (settings.yaml) | **推荐方式** |
| 3 | 环境变量 | 回退方式 |
| 4 | 默认值 | 仅 model 有默认值 |

**环境变量**：

| Provider | 环境变量 |
|----------|---------|
| Anthropic | `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL` |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` |

### Pack 配置目录

每个 Pack 是一个自包含的 YAML 文件：

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
# config/packs/tech-news.yaml
pack:
  id: tech-news
  name: 科技资讯聚合
  description: 中文科技资讯、热点聚合与信息流
  keywords: [技术, 编程, AI, 开源]

sources:
  - type: rss
    url: https://www.infoq.cn/feed
    description: InfoQ 中文，企业级技术资讯

  - type: json-feed
    url: https://www.buzzing.cc/feed.json
    description: Buzzing，中英双语资讯聚合
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
| `x_home` | bird CLI | 首页时间线 |
| `x_list` | bird CLI | 列表时间线 |
| `x_bookmarks` | bird CLI | 书签 |
| `x_likes` | bird CLI | 点赞 |
| `x_user_tweets` | bird CLI | 用户推文（需 username） |
| `x_search` | bird CLI | 搜索（需 query） |
| `x_trending` | bird CLI | 热门趋势 |

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
| `user-tweets` | 用户推文 | `x_user_tweets` |
| `search` | 搜索 | `x_search` |
| `trending` / `news` | 热门趋势 | `x_trending` |

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

### 归档命令

将数据源内容归档到 SQLite 数据库，支持增量更新：

```bash
# 归档指定 Pack 的数据
bun src/cli/main.ts archive collect --pack tech-news

# 归档多个 Pack
bun src/cli/main.ts archive collect --pack tech-news,github

# 查看归档统计
bun src/cli/main.ts archive stats

# 指定数据库路径
bun src/cli/main.ts archive collect --pack tech-news --db custom/archive.db
```

**archive collect 参数**：

| 参数 | 说明 |
|------|------|
| `--pack` | Pack ID，支持逗号分隔的多 Pack |
| `--db` | 数据库路径，默认 `data/archive.db` |
| `--concurrency` | 并发数，默认 3 |

### API 服务

```bash
# 启动 API 服务器（默认端口 3000）
bun src/cli/main.ts serve

# 指定端口
bun src/cli/main.ts serve --port 8080

# 指定数据库路径
bun src/cli/main.ts serve --db custom/archive.db
```

**API 端点**：

| 端点 | 说明 |
|------|------|
| `GET /api/items` | 查询内容项列表 |
| `GET /api/items/:id` | 获取单个内容项 |
| `GET /api/packs` | 获取 Pack 列表 |

**查询参数**（`/api/items`）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `packs` | Pack ID 列表（逗号分隔） | `tech-news,ai-daily` |
| `sources` | 数据源 ID 过滤 | `source1,source2` |
| `window` | 时间窗口 | `1h`, `6h`, `24h`, `7d`, `30d`, `all` |
| `sort` | 排序方式 | `score`, `recent`, `engagement` |
| `search` | 搜索关键词 | `OpenAI` |
| `page` | 页码 | `1` |
| `pageSize` | 每页数量 | `20` |

### 前端 Web UI

```bash
# 启动前端开发服务器
cd frontend && bun install && bun dev

# 或从项目根目录
bun --cwd frontend dev
```

前端访问地址：http://localhost:5173

**功能**：
- Pack 选择器（多选）
- 时间窗口过滤器（1h/6h/24h/7d/30d/all）
- 排序方式（score/recent/engagement）
- 关键词搜索（300ms 防抖）
- 数据源过滤器
- 分页导航

### 查询命令

```bash
# 单 Pack 查询
bun src/cli/main.ts run --pack tech-news --view daily-brief --window 24h
bun src/cli/main.ts run --pack x_bookmarks --view x-analysis --window 7d
bun src/cli/main.ts run --pack karpathy-picks --view json --window all

# 多 Pack 合并查询
bun src/cli/main.ts run --pack tech-news,karpathy-picks --view daily-brief --window 24h

# 输出到文件（推荐用于大数据量）
bun src/cli/main.ts run --pack x-sources --view json --window all --output out/result.json

# 禁用 AI 增强
bun src/cli/main.ts run --pack tech-news --view daily-brief --window 24h --no-ai
```

### 参数说明

| 参数 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| `--pack` | ✅ | Pack ID，支持逗号分隔的多 Pack | `tech-news` 或 `tech-news,karpathy-picks` |
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
| `x-analysis` | Markdown | AI 生成：每篇帖子摘要+标签，互动数据

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
bun src/cli/main.ts run --pack tech-news --view daily-brief --window 24h
bun src/cli/main.ts run --pack karpathy-picks --view daily-brief --window 7d
```

## GitHub Actions 自动化

项目提供 GitHub Actions workflow 实现自动化聚合：

### 每日自动聚合

`.github/workflows/daily-brief.yml` 会在每天 UTC 1:00（北京时间 9:00）自动运行：

```yaml
# 手动触发
# GitHub 仓库 → Actions → Daily Brief → Run workflow
```

**配置 Secrets**：

| Secret | 说明 |
|--------|------|
| `ANTHROPIC_AUTH_TOKEN` | Anthropic API Token（可选） |
| `GEMINI_API_KEY` | Gemini API Key（可选） |
| `OPENAI_API_KEY` | OpenAI API Key（可选） |
| `X_AUTH_TOKEN` | Twitter auth_token（X 数据源用） |
| `X_CT0` | Twitter ct0 token（X 数据源用） |

### 手动触发

`.github/workflows/manual-run.yml` 支持手动触发任意 Pack 和参数组合。

### 分数计算

API 返回的每条内容项都包含动态计算的分数。分数公式：

```
finalScore =
  sourceWeight × 0.3 +
  freshness × 0.25 +
  engagement × 0.1 +
  topicMatch × 0.25 +
  contentQuality × 0.1
```

| 维度 | 权重 | 说明 |
|------|------|------|
| sourceWeight | 30% | 数据源权重（当前固定为 1） |
| freshness | 25% | 新鲜度，越新分数越高 |
| engagement | 10% | 互动数据（点赞、评论等） |
| topicMatch | 25% | 主题匹配度（基于 Pack keywords） |
| contentQuality | 10% | 内容质量（当前默认 0.5） |

**新鲜度衰减规则**：

| 时间范围 | 分数范围 |
|----------|----------|
| 1 小时内 | 1.0 |
| 24 小时内 | 0.8 → 1.0（线性衰减） |
| 7 天内 | 0.5 → 0.8（线性衰减） |
| 更早 | 0.1 → 0.5（按周衰减） |

## 后续计划

以下内容已经进入持续迭代路线图：

- Source 过滤交互（前端 Sidebar）
- URL 状态同步（支持分享链接）
- 更稳的 `github_trending` source 治理
- feedback loop 与自适应排序
- 多用户能力
- embedding / vector search

## 当前实现状态

截至 2026-03-17，仓库当前状态为：

- 已完成：项目脚手架与 CLI
- 已完成：本地 YAML 配置加载与校验
- 已完成：Pack 驱动的数据源配置
- 已完成：SQLite schema 与核心表
- 已完成：`rss`、`json-feed` adapter
- 已完成：`github_trending` adapter
- 已完成：X family `bird CLI` adapter（x_home、x_list、x_bookmarks、x_likes、x_user_tweets、x_search、x_trending）
- 已完成：Auth 配置统一管理（`config/auth/` 目录）
- 已完成：数据归档功能（`archive collect/stats` 命令）
- 已完成：CLI `auth check/status` 命令
- 已完成：规范化、去重、topic match、排序、聚类
- 已完成：`run --pack --view --window` 查询入口、Markdown / JSON 输出
- 已完成：AI 增强视图（daily-brief、x-analysis）
- 已完成：raw items、normalized items、clusters 的 end-to-end 持久化
- 已完成：深度 enrichment（正文提取、AI 关键点提取、标签生成）
- 已完成：Enrichment 结果持久化（`enrichment_results`、`extracted_content_cache` 表）
- **已完成：HTTP API 服务（`serve` 命令）**
- **已完成：前端 Web UI（React + Vite + Tailwind）**
- **已完成：API 分数计算模块**
- 尚未实现：Source 过滤交互、URL 状态同步
