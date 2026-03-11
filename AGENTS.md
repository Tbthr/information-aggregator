# AGENTS.md

## 项目概览

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、规范化与去重，并通过统一的 `run --view <view>` 查询入口输出 Markdown 或 JSON。

当前能力范围：

- YAML 驱动的 source 配置（支持 V1 分离式和 V2 自包含 Pack 两种格式）
- V2 Pack 配置：自包含数据源定义，简化 CLI 使用
- query preset 与 view 配置
- SQLite 持久化：sources、runs、outputs、source health
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter
- `bird CLI` 驱动的 X family adapter：`x_home`、`x_list`、`x_bookmarks`、`x_likes`、`x_multi`
- 确定性的规范化、精确去重、近似去重、排序、聚类与 Markdown 输出
- enrichment boundary 与有界 AI hook
- `run --pack`（V2）、`run --view`（V1）、`sources list`、`config validate` CLI
- `scan` / `digest` deprecated thin wrapper
- 稳定的本地 smoke 与 E2E 验证流程

当前仍明确不包含：

- embeddings / vector similarity
- Web UI
- 多用户能力
- 高级 feedback loop / learning loop

## 架构

主运行流为：

```text
QuerySpec -> SelectionResolver -> Collectors -> RawItem -> Normalize -> Dedup/Cluster -> Rank -> ViewModel -> Render
```

模块职责：

- `src/adapters/`：只负责 source-specific fetch / parse
- `src/config/`：YAML 加载与校验
- `src/db/`：SQLite schema 与 query helpers
- `src/pipeline/`：collect、normalize、dedupe、topic match、rank、cluster
- `src/query/`：query spec、CLI parser、selection resolver、shared query engine
- `src/views/`：view registry 与 view model 构建
- `src/render/`：Markdown 输出格式化
- `src/cli/`：兼容层 wrapper 与顶层 CLI surface
- `src/verification/`：可复用的验证辅助
- `scripts/`：开发与验证入口
- `docs/`：计划、测试说明、实现进展

设计约束：

- 除非明确是可选 AI hook，否则 pipeline 必须保持确定性
- 不要把 fetch 逻辑混入 ranking / render
- 不要把 view-specific 逻辑塞回 collect / normalize
- 测试优先使用依赖注入，不依赖全局 mock
- 新 adapter 必须通过既有 collector pattern 接入

## 配置系统

项目支持两种配置格式：

### V2 Pack 配置（推荐）

V2 格式采用自包含的 Pack 设计，数据源直接内联到 Pack 文件中：

```yaml
# config/packs-v2/ai-news.yaml
pack:
  id: ai-news
  name: AI 新闻与动态
  description: AI 领域的新闻站点、公司博客、研究动态
  keywords: [GPT, LLM, 机器学习, AI]

sources:
  - type: rss
    url: https://openai.com/news/rss.xml
    description: OpenAI 官方新闻

  - type: rss
    url: https://huggingface.co/blog/feed.xml
    description: Hugging Face 技术博客
```

相关模块：
- `src/config/load-pack-v2.ts`：V2 Pack 加载与校验
- `src/query/parse-cli-v2.ts`：V2 CLI 参数解析
- `config/packs-v2/`：V2 Pack 配置目录

### V1 传统配置

V1 格式需要多个配置文件配合：
- `config/sources.yaml`：数据源定义
- `config/profiles.yaml`：查询预设
- `config/topics.yaml`：主题关键词
- `config/packs/`：Pack 引用（引用 sources 中的 ID）

## 开发流程

安装与基线检查：

```bash
bun install
bun test
bun run check
```

主要开发命令：

```bash
bun run smoke
bun run e2e
bun run e2e:real
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts sources list --source-type rss
```

### V2 Pack CLI（推荐）

```bash
# 单 Pack 查询
bun run aggregator run --pack ai-news --view daily-brief --window 24h
bun run aggregator run --pack ai-news --view item-list --window 7d
bun run aggregator run --pack ai-news --view json --window all

# 多 Pack 合并查询
bun run aggregator run --pack ai-news,engineering --view daily-brief --window 24h
```

### V1 Profile CLI（传统）

```bash
bun scripts/aggregator.ts run --view item-list
bun scripts/aggregator.ts run --view daily-brief
bun scripts/aggregator.ts run --view x-bookmarks-analysis
bun scripts/aggregator.ts run --view item-list --format json
```

## 验证策略

默认顺序：

1. `bun test`
2. `bun run smoke`
3. `bun run e2e`
4. clean-clone 安装验证
5. `bun run e2e:real`

解释：

- `smoke` 是开发期最快的回归检查
- `e2e` 是稳定的 fetch-to-output 本地基线
- `e2e:real` 不应作为 CI gate，因为它受上游和网络波动影响

## 端到端测试规则

当你新增或修改 source/runtime 行为时：

- 先补本地 mock-source E2E 测试
- 优先使用本地 HTTP test server，而不是脆弱的网络 mock
- 断言最终 Markdown 输出，而不只检查中间结构
- 真实网络 probe 只能作为补充验证，不能是唯一验证
- X family source 要优先做 `bird CLI` 参数映射和 fixture 输出测试，再做手动 probe

当你修改打包或安装行为时：

- 从 clean clone 验证仓库

## 文档规则

行为变化时，需要保持这些文件同步：

- `README.md`：用户视角说明与命令
- `docs/testing.md`：验证流程与最佳实践
- `AGENTS.md`：项目概览与架构

如果某项能力故意未完成，必须写进文档，不能让配置或 README 暗示”已经支持”。

### Markdown 语言规则

- 本仓库新增或修改的 Markdown 文档必须使用中文
- 代码标识符、CLI 命令、source type 名称、协议名称等保留原文
- 引用英文上游名称时，用中文解释，不要把整份文档切回英文

## 当前实现进展

目前已完成：

- 项目脚手架与 CLI
- config validation
- V2 Pack 配置格式与加载（`load-pack-v2.ts`、`parse-cli-v2.ts`）
- query runner / selection resolver / view registry
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter
- `bird CLI` 驱动的 X family adapter
- SQLite bootstrap 与核心 queries
- normalize、dedupe、topic scoring、ranking、clustering、enrichment boundary
- Markdown / JSON 输出
- `scan` / `digest` thin wrapper
- smoke 验证
- mock-source E2E
- real-network probe

按设计仍延期：

- 更深的 enrichment 与 feedback loop
- Web / 多用户表面

## 协作说明

给后续 agent 的约束：

- 优先做小而清晰的改动
- commit 必须逻辑分组
- 不要悄悄扩大当前路线图 scope
- 如果一项能力被延期，记录在 docs，而不是半实现地留在代码里
