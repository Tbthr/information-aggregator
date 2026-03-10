# AGENTS.md

## 项目概览

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、规范化与去重，并输出 `scan` 或 `digest`。

当前能力范围：

- YAML 驱动的 source 配置
- SQLite 持久化：sources、runs、outputs、source health
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter
- `bird CLI` 驱动的 X family adapter：`x_home`、`x_list`、`x_bookmarks`、`x_likes`、`x_multi`
- 确定性的规范化、精确去重、近似去重、排序、聚类与 Markdown 输出
- enrichment boundary 与有界 AI hook
- `scan`、`digest`、`config validate` CLI
- 稳定的本地 smoke 与 E2E 验证流程

当前仍明确不包含：

- embeddings / vector similarity
- Web UI
- 多用户能力
- 高级 feedback loop / learning loop

## 架构

主运行流为：

```text
Sources -> Collectors -> RawItem -> Normalize -> Dedup/Cluster -> Rank -> Render
```

模块职责：

- `src/adapters/`：只负责 source-specific fetch / parse
- `src/config/`：YAML 加载与校验
- `src/db/`：SQLite schema 与 query helpers
- `src/pipeline/`：collect、normalize、dedupe、topic match、rank、cluster
- `src/render/`：Markdown 输出格式化
- `src/cli/`：`scan` / `digest` 端到端编排
- `src/verification/`：可复用的验证辅助
- `scripts/`：开发与验证入口
- `docs/`：计划、测试说明、实现进展

设计约束：

- 除非明确是可选 AI hook，否则 pipeline 必须保持确定性
- 不要把 fetch 逻辑混入 ranking / render
- 测试优先使用依赖注入，不依赖全局 mock
- 新 adapter 必须通过既有 collector pattern 接入

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
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

## 验证策略

默认顺序：

1. `bun test`
2. `bun run smoke`
3. `bun run e2e`
4. clean-clone 安装验证
5. `bun run e2e:real`
6. 仅在打包/分发变更时做 skill-installation 验证

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
- 只有当 skill 入口或打包契约变化时，才补 skill-installation 测试

## 文档规则

行为变化时，需要保持这些文件同步：

- `README.md`：用户视角说明与命令
- `docs/testing.md`：验证流程与最佳实践
- `docs/plans/2026-03-09-information-aggregator-skill-design.md`：架构意图与进度快照
- `docs/plans/2026-03-09-information-aggregator-skill-implementation-plan.md`：历史执行计划
- 当前活跃路线图与实施计划文档

如果某项能力故意未完成，必须写进文档，不能让配置或 README 暗示“已经支持”。

### Markdown 语言规则

- 本仓库新增或修改的 Markdown 文档必须使用中文
- 代码标识符、CLI 命令、source type 名称、协议名称等保留原文
- 引用英文上游名称时，用中文解释，不要把整份文档切回英文

## 当前实现进展

目前已完成：

- 项目脚手架与 CLI
- config validation
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter
- `bird CLI` 驱动的 X family adapter
- SQLite bootstrap 与核心 queries
- normalize、dedupe、topic scoring、ranking、clustering、enrichment boundary
- Markdown `scan` / `digest`
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
