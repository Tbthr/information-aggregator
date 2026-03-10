# Information Aggregator

将已配置的信息源聚合为统一的本地 query runner 输出，主入口为 `run --view <view>`，支持 Markdown 与 JSON。

## 当前能力

- 加载 sources、topics、profiles、views、source packs 的 YAML 配置
- 从 `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` 采集
- 通过 `bird CLI` 接入 `x_home`、`x_list`、`x_bookmarks`、`x_likes`、`x_multi`
- 规范化 URL 与文本
- 去除精确重复并压缩近似重复
- 使用确定性的混合评分进行排序
- 通过 `item-list`、`daily-brief`、`x-bookmarks-analysis`、`x-likes-analysis`、`x-longform-hot` 输出 Markdown
- 输出稳定的 JSON 中间层结果，包含 `query`、`selection`、`rankedItems`、`clusters`、`viewModel`
- 在 SQLite 中跟踪 runs、outputs 与 source health
- 保留 `scan` / `digest` deprecated thin wrapper 兼容层

## 使用方式

```bash
bun install
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts run --view item-list
bun scripts/aggregator.ts run --view daily-brief
bun scripts/aggregator.ts run --view x-bookmarks-analysis
bun scripts/aggregator.ts run --view item-list --format json
bun scripts/aggregator.ts sources list --source-type rss
bun scripts/aggregator.ts config validate
```

## 配置结构

本地 YAML 示例：

```yaml
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

```yaml
topics:
  - id: ai-news
    name: AI News
    keywords:
      - ai
      - model
```

```yaml
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

## Source Packs

`config/packs/` 下的示例文件展示了如何把 sources 组合成可重复使用的运行分组。

当前示例 pack 只保留 runtime 可直接解析的分组：

- `ai-news-sites`
- `engineering-blogs-core`

`custom_api`、`opml_rss`、X family 这类依赖本地文件、登录态或外部前置条件的 source，需要在本地配置中显式添加。

## Views

当前内置 view：

- `item-list`
- `daily-brief`
- `x-bookmarks-analysis`
- `x-likes-analysis`
- `x-longform-hot`

`scan` / `digest` 仍存在，但仅用于兼容旧调用方：

- `scan` -> `item-list`
- `digest` -> `daily-brief`

## 输出示例

`item-list` 输出示例：

```md
# Scan Results

- [Example title](https://example.com/post)
  - Source: Query View
  - Score: 0.82
```

`daily-brief` 输出示例：

```md
# Daily Digest

## Highlights

- Example title

## Top Clusters

- [Example title](https://example.com/post)
  - Why it matters
```

## 后续计划

以下能力已经进入持续迭代路线图：

- 更深的 Reddit / community source 支持
- 深度 enrichment 与 feedback loop
- 浏览器界面或 Web UI
- 多用户能力
- embedding 相似度

## 当前实现状态

当前仓库已经实现：

- CLI 启动与帮助命令
- 本地 YAML 配置校验
- 基于 runtime query 模型的默认 source config、source packs、profiles、views
- SQLite bootstrap 与核心表
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter/collector 路径
- `bird CLI` 驱动的 X family adapter
- profile preset、view config 与 selection resolution
- 确定性的 normalize、dedupe、topic-match、rank、cluster
- shared query engine
- Markdown / JSON render
- `scan` 与 `digest` thin wrapper
- 候选评分、cluster summary、digest narration 的 AI hook
- raw items、normalized items、clusters 的 end-to-end 持久化

当前刻意延期：

- 更深的 enrichment 与 feedback loop
- Web / 多用户表面
