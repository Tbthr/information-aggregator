# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 `run --view <view>` 查询入口输出 Markdown 或 JSON 结果。

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
