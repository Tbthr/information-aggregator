# Information Aggregator

将已配置的信息源聚合为本地 `scan` 与 `digest` 输出。

## 当前能力

- 加载 sources、topics、profiles、source packs 的 YAML 配置
- 从 `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` 采集
- 通过 `bird CLI` 接入 `x_home`、`x_list`、`x_bookmarks`、`x_likes`、`x_multi`
- 规范化 URL 与文本
- 去除精确重复并压缩近似重复
- 使用确定性的混合评分进行排序
- 输出 Markdown 格式的 `scan` 与 `digest`
- 在 SQLite 中跟踪 runs、outputs 与 source health

## 使用方式

```bash
bun install
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
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
    name: Default Digest
    mode: digest
    topicIds:
      - ai-news
      - engineering-blogs
    sourcePackIds:
      - ai-news-sites
      - ai-daily-digest-blogs
```

## Source Packs

`config/packs/` 下的示例文件展示了如何把 sources 组合成可重复使用的扫描或摘要集合。

默认配置参考了 5 个项目的数据源表面：

- `ai-news-radar`
- `ai-daily-digest`
- `clawfeed`
- `smaug`
- `x-ai-topic-selector`

其中一部分 disabled source 只用于表达参考项目覆盖范围与 schema 边界，不代表默认配置会直接运行它们。

## 输出示例

`scan` 输出示例：

```md
# Scan

- [Example title](https://example.com/post)
  - source: OpenAI News
  - score: 0.82
```

`digest` 输出示例：

```md
# Digest

## Top Highlights

- Example title
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
- 基于参考项目扩展的默认 source config 与 source packs
- SQLite bootstrap 与核心表
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter/collector 路径
- `bird CLI` 驱动的 X family adapter
- profile / topic / source-pack resolution
- 确定性的 normalize、dedupe、topic-match、rank、cluster
- `scan` 与 `digest` Markdown render
- 候选评分、cluster summary、digest narration 的 AI hook
- raw items、normalized items、clusters 的 end-to-end 持久化

当前刻意延期：

- 更深的 enrichment 与 feedback loop
- Web / 多用户表面
