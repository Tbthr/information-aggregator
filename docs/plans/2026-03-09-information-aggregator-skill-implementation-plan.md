# Information Aggregator Skill 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> 2026-03-10 更新：仓库当前主执行路径已切换到 query runner + view system，本文中的 `scan` / `digest` 描述应视为历史实现背景。

**目标：** 落地一个本地优先、基于 SQLite 的信息聚合 skill，支持可配置的数据源、精确与近似去重，以及 `scan` / `digest` 两种输出模式。

**架构：** 使用 adapter-based pipeline。各 source adapter 先把外部数据转换成 `RawItem`，再经过 normalize、dedupe、rank、cluster 和 render，最终输出 `scan` 或 `digest`。SQLite 用于保存稳定的配置状态、raw items、normalized items、runs 和 outputs。

**技术栈：** TypeScript、Bun/Node.js、SQLite、YAML、Markdown、JSON、bun:test

---

## 历史任务摘要

这是一份历史实施计划归档。原始英文版本非常长，包含大量逐步 TDD 指令。  
这里保留其核心任务结构，便于后续理解仓库是如何一步步搭起来的。

### 任务 1：初始化项目骨架

主要内容：

- 创建 `package.json`
- 创建 `README.md`
- 创建 `SKILL.md`
- 创建 `scripts/aggregator.ts`
- 创建核心 `src/types`
- 创建 `src/cli/index.ts`
- 创建最初的 `config/*.yaml`
- 用 `src/cli/index.test.ts` 做最小启动测试

### 任务 2：定义核心类型

主要内容：

- 定义 `RunMode`
- 定义 `Source`
- 定义 `SourcePack`
- 定义 `RawItem`
- 定义 `NormalizedItem`
- 定义 `Cluster`
- 定义 `RunRecord`
- 定义 `OutputRecord`
- 定义 `TopicProfile`

### 任务 3：加入配置加载

主要内容：

- YAML 文件读取
- `sources` 配置解析
- 基础字段校验
- `src/config/load.test.ts`

### 任务 4：创建 SQLite schema 与 DB bootstrap

主要内容：

- `src/db/schema.ts`
- `src/db/client.ts`
- migration 文件
- 数据表初始化测试

### 任务 5：实现 sources / runs / outputs / source health 的 query 层

主要内容：

- CRUD / insert / list query
- 数据库层测试

### 任务 6：实现基础 adapter

主要内容：

- `rss`
- `json-feed`
- `website`

并为各 adapter 补对应解析测试。

### 任务 7：实现 pipeline

主要内容：

- `collect`
- `normalize`
- `dedupe-exact`
- `dedupe-near`
- `topic-match`
- `rank`
- `cluster`

### 任务 8：实现 render

主要内容：

- Markdown `scan`
- Markdown `digest`

### 任务 9：实现 CLI orchestration

主要内容：

- `scan` command
- `digest` command
- `config validate`

### 任务 10：补 smoke / E2E / 文档

主要内容：

- `smoke`
- 本地 mock-source E2E
- 文档同步

## 当时的关键执行原则

- 全程采用 TDD
- 每一层都要有 focused test
- 小步提交，避免一次性改动过大
- 不在 MVP 阶段提前引入复杂 UI 或产品表面

## 与当前计划的关系

这份历史计划主要用于说明仓库最初的实施路径。  
如果现在继续推进 source type、X family 或 enrichment，应该优先参考：

- `docs/plans/2026-03-10-source-type-roadmap-design.md`
- `docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md`

因为它们已经吸收了更新后的配置审计、source taxonomy 和 X 路线设计。
