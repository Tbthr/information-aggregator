# Information Aggregator

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并输出快速浏览用的 `scan` 或结构化的 `digest`。

## 当前能力

- TypeScript + Bun CLI
- SQLite 持久化：sources、runs、outputs、source health
- 配置驱动的 sources、source packs、topics、profiles
- 已接入 `rss`、`json-feed`、`website`、`hn`、`reddit`
- 已接入 `github_trending`、`digest_feed`、`custom_api`、`opml_rss`
- 已接入基于 `bird CLI` 的 X family adapter
- 确定性的规范化、精确去重、近似去重、排序与聚类
- 可选的 AI 抽象层，用于后续候选评分和摘要扩展

## 配置文件

示例配置位于 [`config/`](./config)：

- `sources.example.yaml`
- `topics.example.yaml`
- `profiles.example.yaml`
- `config/packs/ai-news-sites.yaml`
- `config/packs/engineering-blogs-core.yaml`
- `config/packs/engineering-blogs-reference-hnpc-2025.yaml`
- `config/packs/community-api-reference.yaml`
- `config/packs/import-and-special-feed-reference.yaml`
- `config/packs/web-auth-reference.yaml`
- `config/packs/x-auth-reference.yaml`

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
  - id: x-home-reference
    name: X Home Reference
    type: x_home
    enabled: false
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
    name: Default Digest
    mode: digest
    topicIds:
      - ai-news
      - engineering-blogs
    sourcePackIds:
      - ai-news-sites
      - engineering-blogs-core
```

## 默认配置与 Pack taxonomy

当前 `config/packs` 按数据源本质分组，而不是按参考项目命名：

- `ai-news-sites`：默认启用的公开 AI 新闻站与聚合站
- `engineering-blogs-core`：默认启用的工程博客核心源
- `engineering-blogs-reference-hnpc-2025`：90 个工程博客/RSS 参考源，描述为 `Hacker News Popularity Contest 2025` curated list
- `community-api-reference`：`hn`、`reddit`、`github_trending` 这类社区/榜单型 reference source
- `import-and-special-feed-reference`：`opml_rss`、`digest_feed`、`custom_api` 这类导入或特殊 feed 类型 reference source
- `web-auth-reference`：网页可达但需要登录态的参考源
- `x-auth-reference`：依赖 `bird CLI` / 登录态的 X family reference source

注意：

- 当前仓库内部只保留 canonical source type 命名
- `config/sources.example.yaml` 同时包含 runnable public sources、auth-required reference sources、schema placeholder sources
- reference source 分为三类：
  - 匿名可访问但默认不启用的 reference source
  - 依赖登录态或外部会话的 auth-required reference source
  - `config.placeholderMode: schema` 的 schema placeholder，仅用于表达未来契约

当前已接入主采集链路、但默认不启用或仍依赖本地前置条件的类型包括：

- 匿名可跑通的 reference source：`hn`、`reddit`、`github_trending`、`digest_feed`
- 需要本地文件或显式 schema 的类型：`custom_api`、`opml_rss`
- 需要 `bird CLI` 与 X 登录态的类型：`x_bookmarks`、`x_likes`、`x_multi`、`x_list`、`x_home`

这保证了配置能完整反映当前 source taxonomy，同时把“已实现 adapter”和“默认 runnable”区分开。

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

- X family 的授权配置、手动 probe 与兼容性收敛
- 更稳的 `github_trending` / `digest_feed` / `custom_api` / `opml_rss` source 治理
- 更深的正文提取与 enrichment
- feedback loop 与自适应排序
- Web UI
- 多用户能力
- embedding / vector search

## 当前实现状态

截至 2026-03-10，仓库当前状态为：

- 已完成：项目脚手架与 CLI
- 已完成：本地 YAML 配置加载与校验
- 已完成：按 source taxonomy 组织的 source config 与 source packs
- 已完成：SQLite schema 与核心表
- 已完成：`rss`、`json-feed`、`website` adapter
- 已完成：`hn`、`reddit` 的 collector 路径支持
- 已完成：`github_trending`、`digest_feed`、`custom_api`、`opml_rss` adapter
- 已完成：X family `bird CLI` adapter，需本地授权后手动 probe
- 已完成：profile / topic / source-pack resolution
- 已完成：规范化、去重、topic match、排序、聚类
- 已完成：`scan` 与 `digest` Markdown 输出
- 已完成：候选评分、cluster summary、digest narration 的 AI hook
- 已完成：raw items、normalized items、clusters 的 end-to-end 持久化
- 尚未实现：深度 enrichment、feedback learning、Web UI、多用户能力
