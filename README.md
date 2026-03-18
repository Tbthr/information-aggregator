# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过 Web 界面呈现聚合结果。

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
- `src/ai/`：AI 客户端抽象层
  - `config/`：配置加载（settings.yaml → 环境变量）
  - `providers/`：策略模式实现（Anthropic、Gemini、OpenAI）
  - `prompts*.ts`：各场景 prompt
- `src/cli/`：CLI 入口点
- `src/verification/`：验证辅助（smoke、e2e）
- `config/packs/`：Pack 配置目录

### 核心数据流

1. **Collect**：从各数据源拉取内容（adapters）
2. **Normalize**：URL/文本规范化
3. **Dedupe**：精确 + 近似去重
4. **Policy Filter**：按 source / pack policy 执行 AI 过滤判断
5. **Enrich**：正文提取 + AI 增强
6. **Rank**：加权评分
7. **Cluster**：相似内容聚合

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
| `pack.description` | ❌ | Pack 描述，用于 AI 过滤时的主题判断 |
| `sources[].type` | ✅ | 数据源类型 |
| `sources[].url` | ✅ | 数据源 URL |
| `sources[].description` | ❌ | 数据源描述 |
| `sources[].enabled` | ❌ | 是否启用，默认 true |

**数据源类型**：

| 类型 | 数据来源 | 特殊配置 |
|------|----------|----------|
| `rss` | RSS/Atom XML | - |
| `json-feed` | JSON Feed 1.1 | - |
| `github-trending` | GitHub Trending HTML | - |
| `x-home` | bird CLI | 首页时间线 |
| `x-list` | bird CLI | 列表时间线 |
| `x-bookmarks` | bird CLI | 书签 |
| `x-likes` | bird CLI | 点赞 |

### X/Twitter 数据源配置

X/Twitter 数据源需要 [bird CLI](https://github.com/nicoulaj/bird) 和浏览器授权。通过 `configJson` 字段配置：

```yaml
sources:
  - type: x-home
    url: https://x.com/home
    description: X 首页时间线
    configJson: '{"birdMode":"home","count":50}'

  - type: x-list
    url: https://x.com/i/lists/123456789
    description: X 列表
    configJson: '{"birdMode":"list","listId":"123456789","count":100}'
```

**支持的 birdMode**：

| birdMode | 说明 | 数据源类型 |
|----------|------|-----------|
| `home` | 首页时间线 | `x-home` |
| `list` | 列表时间线 | `x-list` |
| `bookmarks` | 书签 | `x-bookmarks` |
| `likes` | 点赞 | `x-likes` |

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
└── x-family.yaml    # X/Twitter 系列（x-home, x-list, x-bookmarks, x-likes）
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

## 示例工作流

```bash
bun run smoke
```

更完整的验证说明请见 [`TEST.md`](./TEST.md)。

### 分数计算

API 返回的每条内容项都包含动态计算的分数。分数公式：

```
finalScore =
  sourceWeight × 0.4 +
  freshness × 0.35 +
  engagement × 0.15 +
  contentQuality × 0.1
```

| 维度 | 权重 | 说明 |
|------|------|------|
| sourceWeight | 40% | 数据源权重（当前固定为 1） |
| freshness | 35% | 新鲜度，越新分数越高 |
| engagement | 15% | 互动数据（点赞、评论等） |
| contentQuality | 10% | 内容质量（当前默认 0.5） |

**新鲜度衰减规则**：

| 时间范围 | 分数范围 |
|----------|----------|
| 1 小时内 | 1.0 |
| 24 小时内 | 0.8 → 1.0（线性衰减） |
| 7 天内 | 0.5 → 0.8（线性衰减） |
| 更早 | 0.1 → 0.5（按周衰减） |
