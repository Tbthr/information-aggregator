# Information Aggregator Post-MVP 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 在不扩展到 Web UI 或多用户产品的前提下，把 MVP 推进到下一阶段，补齐配置绑定、pipeline 持久化、provider-backed AI enrichment、更多 source adapter，以及更强的 source health 验证。

**架构：** 保持本地优先、adapter-based pipeline 不变。新增能力以可分离层的方式接入：先做配置解析，再做 pipeline persistence，再做 provider / adapter 扩展，最后补验证与文档。

**技术栈：** TypeScript、Bun、SQLite、YAML、Markdown、bun:test、本地 mock HTTP server

---

## 历史背景说明

这是一份历史计划归档，用于记录 2026-03-09 当时对 post-MVP 阶段的拆解方式。  
它的重点是说明当时认为最值得优先推进的能力，而不是作为当前唯一有效的执行清单。

## 核心任务摘要

### 任务 1：把参考项目来源写入默认配置

目的：

- 用参考项目替换早期的占位示例配置
- 让默认 source config、packs、topics、profiles 形成可运行基线

主要涉及：

- `config/sources.example.yaml`
- `config/packs/*.yaml`
- `config/topics.example.yaml`
- `config/profiles.example.yaml`
- `README.md`
- `SKILL.md`
- `src/config/load.test.ts`
- `src/verification/smoke.test.ts`

### 任务 2：补齐 topics / profiles / source packs 的加载

目的：

- 让配置系统不只会加载 sources
- 为 profile 驱动收集做准备

主要涉及：

- `src/types/index.ts`
- `src/config/load.ts`
- `src/config/validate.ts`
- `src/config/load.test.ts`

### 任务 3：在收集前先完成 profile resolution

目的：

- 让 profile 能展开 source packs
- 保证最终只收集启用的 source

主要涉及：

- `src/config/resolve-profile.ts`
- `src/config/resolve-profile.test.ts`
- `src/types/index.ts`

### 任务 4：把 collection / normalize / dedupe / cluster 写入数据库

目的：

- 从“只输出结果”升级为“保留 pipeline 中间状态”
- 为后续回放、比较、调试与 AI enrichment 做准备

主要涉及：

- `src/db/queries/*`
- `src/cli/run-scan.ts`
- `src/cli/run-digest.ts`
- 相关 query tests

### 任务 5：加入 provider-backed AI hooks

目的：

- 在不破坏 deterministic pipeline 的前提下，增加候选评分、cluster summary、digest narration 能力

主要涉及：

- `src/ai/client.ts`
- `src/ai/prompts.ts`
- `src/cli/run-digest.ts`
- `src/cli/run-scan.ts`
- AI 相关测试

### 任务 6：补 `hn` / `reddit` 支持

目的：

- 让 post-MVP 阶段不再局限于纯 feed source
- 为 community source 接入做准备

主要涉及：

- `src/adapters/hn.ts`
- `src/adapters/reddit.ts`
- 对应 adapter tests
- collect / E2E 测试

### 任务 7：增强 source health

目的：

- 记录成功 / 失败 / 零条目 / latency 等信息
- 为后续 source 质量判断提供基础

主要涉及：

- `src/db/queries/source-health.ts`
- `src/pipeline/collect.ts`
- `src/verification/*`

## 当时的执行原则

- 仍然遵循 TDD
- 先让 config 与本地 mock E2E 稳定，再接更复杂 source
- 不因为 post-MVP 就直接跳到 SaaS 化设计
- AI 必须保持 optional、late-binding

## 与当前路线图的关系

这份历史计划与当前的“数据源类型路线图”并不冲突，但当前更应优先参考：

- `docs/plans/2026-03-10-source-type-roadmap-design.md`
- `docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md`

因为后者已经纳入了：

- source type taxonomy
- X family 统一命名
- `bird CLI` 路线
- config / pack 审计结果
