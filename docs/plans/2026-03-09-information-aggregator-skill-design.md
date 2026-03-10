# Information Aggregator Skill 设计

日期：2026-03-09
状态：历史设计归档

> 2026-03-10 更新：主查询入口已迁移为 `run --view <view>`，`scan` / `digest` 当前仅保留为 deprecated thin wrapper。

## 实现进展快照

截至 2026-03-09，当时的设计快照认为仓库已经具备：

- 独立 Bun 项目结构
- CLI 入口
- 示例配置
- SQLite schema 与 repository 层
- `rss`、`json-feed`、`website` adapter
- normalize、精确去重、近似去重、排序、聚类与 Markdown render
- `scan` / `digest` 端到端编排
- provider-backed AI hooks
- profile / topic / source-pack binding
- `hn` / `reddit` collector 路径支持

按设计仍未实现：

- X family adapter
- 更深的 enrichment worker
- feedback loop
- Web UI
- 多用户能力
- embeddings

## 1. 目标

构建一个可复用、本地优先的信息聚合 skill，用于：

- 从多个高质量 source 收集内容
- 去除重复信息
- 输出高密度的 `daily digest` 和 `interactive scan`

系统要求：

- 可配置
- 可扩展
- 可稳定日常使用
- 便于后续扩展，而不是一开始就走 SaaS-first

## 2. 产品方向

系统的目标不是做“另一个 feed reader”，而是：

1. 把多个 source 收敛到统一池子
2. 去掉精确重复并压缩近似重复
3. 只对高价值内容做排序和摘要

长期看，输出单位应该从“单条 item”逐步演进为“cluster-aware result”，避免同一事件从多个 source 重复出现。

## 3. 设计原则

- 本地优先：先做 skill + CLI
- 配置驱动：source、topic、output mode 都来自配置
- adapter-based：每种 source type 都通过 collector interface 接入
- pipeline separation：collection、normalize、dedupe、rank、enrich、render 分层
- AI-late：AI 只在候选缩减之后介入
- explainable：排序逻辑要足够可解释
- incremental extensibility：未来新增 source type 不应迫使架构重写

## 4. MVP 范围

MVP 应包括：

- 本地 skill + CLI 入口
- SQLite 持久化
- `sources`、`source_packs`、`topics`、`profiles` 配置
- `rss`
- `json-feed`
- `website` with RSS discovery
- 统一 `RawItem` / `NormalizedItem`
- 精确去重
- 轻量近似去重
- 混合排序策略
- `scan`
- `digest`
- source health tracking

## 5. 明确延期的内容

当时设计里就明确延期：

- `x_bookmarks`、`x_list`
- Reddit / Hacker News 的完整产品化支持
- 深度正文提取
- GitHub / 长文 enrichment pipeline
- feedback learning
- Web UI
- 多用户
- remote sync
- embeddings / vector store
- 跨运行事件演化跟踪

## 6. 推荐架构

统一流程：

```text
Sources -> Collectors -> RawItem -> Normalize -> Dedup/Cluster -> Rank -> Render
```

职责：

- `Sources`：配置输入
- `Collectors`：source-specific 采集
- `RawItem`：统一原始层
- `Normalize`：URL / 文本规范化
- `Dedup/Cluster`：先精确去重，再近似压缩
- `Rank`：规则分与 AI 分结合
- `Render`：输出 `digest` 或 `scan`

## 7. 设计价值

这份历史设计文档的价值在于，它定义了仓库最初的核心边界：

- 本地优先
- 配置驱动
- adapter + pipeline 分层
- AI 后置

当前如果继续推进 source type 能力，应优先参考更新后的路线图文档，而不是直接回到这份早期设计逐条执行。
