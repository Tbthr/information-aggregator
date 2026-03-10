# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并输出快速浏览用的 `scan` 或结构化的 `digest`。

## 当前能力

- TypeScript + Bun CLI
- SQLite 持久化：sources、runs、outputs、source health
- 配置驱动的 sources、source packs、topics、profiles
- `rss`、`json-feed`、`website` 的基础采集能力
- 已接入 collector 路径的 `hn` 与 `reddit`
- 确定性的规范化、精确去重、近似去重、排序与聚类
- 可选的 AI 抽象层，用于后续候选评分和摘要扩展

## 配置文件

示例配置位于 [`config/`](./config)：

- `sources.example.yaml`
- `topics.example.yaml`
- `profiles.example.yaml`
- `config/packs/ai-daily-digest-blogs.yaml`
- `config/packs/ai-daily-digest-reference-full.yaml`
- `config/packs/ai-news-sites.yaml`
- `config/packs/ai-news-radar-reference.yaml`
- `config/packs/clawfeed-reference.yaml`
- `config/packs/smaug-reference.yaml`
- `config/packs/x-ai-topic-selector-reference.yaml`

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
    name: Default Digest
    mode: digest
    topicIds:
      - ai-news
      - engineering-blogs
    sourcePackIds:
      - ai-news-sites
      - ai-daily-digest-blogs
```

## 默认配置与参考项目

当前默认配置参考了 5 个项目的数据源表面：

- `ai-news-radar`：提供聚合站/新闻站默认源，以及 `opml_rss` 占位需求
- `ai-daily-digest`：提供高质量 blog/RSS 源池
- `clawfeed`：提供 `json-feed`、`rss`、`website`、`hn`、`reddit`、`github_trending`、`digest_feed`、`custom_api` 等类型参考
- `smaug`：提供 `x_bookmarks`、`x_likes`、`x_multi` 的输入语义参考
- `x-ai-topic-selector`：提供 `x_list`、`x_home`、`x_bookmarks` 的输入语义参考

注意：

- 当前仓库内部只保留 canonical source type 命名
- `config/sources.example.yaml` 里有一部分 source type 是为了完整表达路线图和参考项目覆盖范围而加入的 disabled reference source
- disabled reference source 分为两类：
  - `enabled: false` 且结构有效，可在 adapter 实现后直接转为可运行 source
  - `config.placeholderMode: schema`，只用于表达未来 schema 契约，当前不可直接运行

当前仍未接入主采集链路、但已出现在配置中的类型包括：

- `github_trending`
- `digest_feed`
- `custom_api`
- `x_bookmarks`
- `x_likes`
- `x_multi`
- `x_list`
- `x_home`
- `opml_rss`

这保证了配置能完整反映参考项目的 source surface，但不代表这些 adapter 已经实现。

## 命令

```bash
bun install
bun test
bun run check
bun run smoke
bun run e2e
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
bun scripts/aggregator.ts config validate
```

## 输出模式

- `scan`：适合快速浏览的排序 Markdown 列表
- `digest`：带高亮与聚类的结构化 Markdown 摘要

## 示例工作流

```bash
bun run smoke
```

更完整的验证说明请见 [`docs/testing.md`](./docs/testing.md)。

```bash
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

### `scan` 输出示例

```md
# Scan

- [Example title](https://example.com/post)
  - source: OpenAI News
  - score: 0.82
```

### `digest` 输出示例

```md
# Digest

## Top Highlights

- Example title

## Cluster: Example topic

- [Example title](https://example.com/post)
```

## 后续计划

以下内容已经进入持续迭代路线图：

- X family adapter
- `github_trending`、`digest_feed`、`custom_api`、`opml_rss`
- 更深的正文提取与 enrichment
- feedback loop 与自适应排序
- Web UI
- 多用户能力
- embedding / vector search

## 当前实现状态

截至 2026-03-10，仓库当前状态为：

- 已完成：项目脚手架与 CLI
- 已完成：本地 YAML 配置加载与校验
- 已完成：基于参考项目的 source config 与 source packs
- 已完成：SQLite schema 与核心表
- 已完成：`rss`、`json-feed`、`website` adapter
- 已完成：`hn`、`reddit` 的 collector 路径支持
- 已完成：profile / topic / source-pack resolution
- 已完成：规范化、去重、topic match、排序、聚类
- 已完成：`scan` 与 `digest` Markdown 输出
- 已完成：候选评分、cluster summary、digest narration 的 AI hook
- 已完成：raw items、normalized items、clusters 的 end-to-end 持久化
- 尚未实现：X adapters、深度 enrichment、feedback learning、Web UI、多用户能力
