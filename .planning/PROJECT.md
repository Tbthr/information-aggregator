# 信息聚合平台 - 采集与报告优化

**Core value:** 提升信息采集质量与报告生成效率，确保数据字段完整、AI 调用优化、前端配置同步

**Current focus:** v1.0 MVP 已完成，等待下一里程碑规划

---

## What This Is

对 Information Aggregator 的数据采集管道（Collection Pipeline）、日报生成、周报生成进行全面的质量审计和优化，同时修正前端报告设置页面，确保配置完整性。

**这不是：** 新功能开发或架构重构

---

## Context

Existing codebase at `/Users/lyq/ai-enhance/information-aggregator`：
- Next.js 16 App Router + React 19 + Prisma + Supabase
- 数据采集管道：RSS → JSON Feed → Website → X/Twitter
- 报告生成：日报（每日）+ 周报（每周）基于 AI
- 前端：shadcn/ui + SWR

**Recent changes (2026-03-31):**
- `7010fc1` — docs(phase-04): complete phase execution
- `b65ffb9` — fix(04): annotate thrown errors with retryCount in withPrismaRetry
- Phase 4 全部完成，v1.0 MVP 里程碑结束
- `c759a8b` — refactor: remove legacy CustomView and Bookmark features
- `33e4bf6` — refactor: remove legacy Item/Tweet/Pack models, migrate to Content/Topic unified schema

---

## Requirements

### Validated

- ✓ **Content/Topic 统一 schema** — `Content` 和 `Topic` 模型已迁移完成
- ✓ **FRONTEND-01** — 前端 `packs` → `topicIds` 字段修复，ReportSettingsPage 与 API schema 对齐 (Phase 1)
- ✓ **FRONTEND-02** — 统一 Tabbed `/settings` 页面，合并日报/周报/数据源配置，旧 URL 重定向 (Phase 1)
- ✓ **Collection Pipeline** — `src/pipeline/run-collect-job.ts` 实现：adapters → normalize → filter → dedupe → persist
- ✓ **日报 Pipeline** — `src/reports/daily.ts` 实现：collect → score → cluster → summarize → persist
- ✓ **周报 Pipeline** — `src/reports/weekly.ts` 实现：collect → editorial → picks → persist
- ✓ **AI 多 provider 支持** — Anthropic/Gemini/OpenAI fallback
- ✓ **前端 SWR 数据获取** — 统一使用 SWR hooks
- ✓ **PIPELINE-01** — 数据采集所有 fetcher 的关键字段检查：RawItem 新增 author/content 字段，4个适配器全部添加 discard logging 和 discard summary (Phase 2)
- ✓ **PIPELINE-02** — 日报 AI 配置的初始 Topic 指定：Supabase seed 初始化 `DailyReportConfig.topicIds`，keywordBlacklist 迁移为 `Topic.excludeRules` (Phase 3)
- ✓ **PIPELINE-03** — 日报 AI 使用优化：batch clustering 调用，模型版本固定 (Phase 3)
- ✓ **PIPELINE-04** — 周报 AI 优化：picks 生成使用单次 batch 调用替代 6 次独立调用 (Phase 3)
- ✓ **采集管道事务与重试** — `withPrismaRetry` + 事务包装 + 结构化错误日志 (Phase 4)

### Active

- [ ] **[NEW]** 下一里程碑规划中 — 待定义

### Out of Scope

- 全新功能开发
- 架构重构
- 非报告相关的 UI 改版

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pack 概念删除 | `c759a8b` 确认 Pack 已移除 | 前端配置需改为 Source + Topic 模式 |
| Content/Topic 统一 schema | `33e4bf6` 迁移完成 | 报告生成逻辑基于新 schema |
| 保持现有 pipeline 架构 | pipeline 结构稳定 | 仅优化字段质量和 AI 调用 |
| keywordBlacklist → Topic.excludeRules | Phase 3 验证 | 细粒度 topic 级别排除规则更灵活 |
| AI batch 调用优化 | Phase 3 验证 | 日报 clustering 一次调用替代逐条，节省 token |
| Prisma 事务 + retry wrapper | Phase 4 验证 | 采集管道 transient failure 自动恢复 |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-03-31 after v1.0 MVP milestone completion*
