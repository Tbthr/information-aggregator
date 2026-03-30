# Phase 3: Topic Configuration + AI Optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 3-Topic Configuration + AI Optimization
**Areas discussed:** keywordBlacklist migration, Topic seeding, Daily batching, Weekly batching, Model pinning

---

## keywordBlacklist migration

| Option | Description | Selected |
|--------|-------------|----------|
| One-time migration | Write Prisma migration: read keywordBlacklist → populate Topic.excludeRules → remove column | ✓ |
| Claude's discretion | Let researcher/planner determine best migration approach | |

**User's choice:** One-time migration (Recommended)
**Notes:** 一次性 Prisma migration 完成数据迁移和字段移除

---

## Topic seeding strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Empty = all (keep current behavior) | Don't seed topicIds. Empty array means "include all topics" | |
| Seed all active topic IDs explicitly | Run setup script to populate topicIds with all active Topic IDs | |

**User's choice (free text):** "帮我初始化一些topic，比如AI Agent LLM 地缘冲突等等"
**Follow-up confirmation:** 创建预设 Topic 记录 + DailyReportConfig.topicIds 填充这些 Topic ID
**Notes:** 用户希望在种子数据中预设 Topic（AI Agent、LLM、地缘冲突等），并在 DailyReportConfig.topicIds 中填充这些 ID

---

## Daily topic summary batching

| Option | Description | Selected |
|--------|-------------|----------|
| 3 并发（当前） | PARALLEL_CONCURRENCY=3，每批3个并发调用 | ✓ |
| 1 次调用（全部 batch） | 所有 topics 的 summary 合并成 1 次 AI 调用 | |

**User's choice (free text):** "假设有N个topic，日报应该生成N个主题，每个content有最终的topic归属，然后再发起N次AI调用，生成对应topic的summary。确保日报的逻辑是这样的"
**Notes:** 用户确认当前逻辑正确：clustering 1次 → N topics → N 次并发=3 AI calls for summaries

---

## Weekly picks batching

| Option | Description | Selected |
|--------|-------------|----------|
| 1 次 batched call | 6 个 content 一次传入，返回 6 个 reason | |
| 保持 6 次调用（当前） | 每个 pick 单独调用 | ✓ |

**User's choice (free text):** "对于周报来说，根据近7天的content给一个大的汇总，然后选出topN的content，每个content调用一次AI请求，拿到"文章的总结概括"和"为什么值得读"，串行请求AI，即并发=1，暂不可配置"
**Notes:** 用户确认当前串行逻辑（并发=1）正确，不需要改成 batched call

---

## Model version pinning

| Option | Description | Selected |
|--------|-------------|----------|
| 环境变量配置 | 通过 AI_DEFAULT_MODEL 环境变量指定 | ✓ |
| 代码中硬编码固定版本 | 在 AI client 代码中写死一个版本号 | |

**User's choice:** 环境变量配置 (Recommended)
**Notes:** 通过环境变量灵活配置不同环境的 model version

---

## Claude's Discretion

- 预设 Topic 的具体名称和数量由 researcher/planner 确定
- 预设 Topic 的 excludeRules 初始值可为空

## Deferred Ideas

None — discussion stayed within phase scope.
