# 信息聚合平台 - 采集与报告优化

**Core value:** 提升信息采集质量与报告生成效率，确保数据字段完整、AI 调用优化、前端配置同步

**Current focus:** 初始化项目，定义数据采集管道与报告生成的优化范围

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

**Recent changes (2026-03-30):**
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

### Active

- [ ] **[PIPELINE-01]** 数据采集所有 fetcher 的关键字段检查 — RSS/JSON Feed/Website/X 适配器的 RawItem 字段完整性
- [ ] **[PIPELINE-02]** 日报 AI 配置的初始 Topic 指定 — Supabase 中配置默认 topicIds 提高日报质量
- [ ] **[PIPELINE-03]** 日报 AI 使用优化 — 分析 `prompts-reports.ts` 中 AI 调用效率和质量
- [ ] **[PIPELINE-04]** 周报全流程梳理 — `src/reports/weekly.ts` 各阶段 AI 调用和输出质量
- [ ] **[PIPELINE-01]** 数据采集所有 fetcher 的关键字段检查 — RSS/JSON Feed/Website/X 适配器的 RawItem 字段完整性
- [ ] **[PIPELINE-02]** 日报 AI 配置的初始 Topic 指定 — Supabase 中配置默认 topicIds 提高日报质量
- [ ] **[PIPELINE-03]** 日报 AI 使用优化 — 分析 `prompts-reports.ts` 中 AI 调用效率和质量
- [ ] **[PIPELINE-04]** 周报全流程梳理 — `src/reports/weekly.ts` 各阶段 AI 调用和输出质量

### Out of Scope

- 全新功能开发
- 架构重构
- 非报告相关的 UI 改版

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pack 概念删除 | recent `c759a8b` 确认 Pack 已移除 | 前端配置需改为 Source + Topic 模式 |
| Content/Topic 统一 schema | recent `33e4bf6` 迁移完成 | 报告生成逻辑基于新 schema |
| 保持现有 pipeline 架构 | pipeline 结构稳定 | 仅优化字段质量和 AI 调用 |

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

*Last updated: 2026-03-30 after Phase 1 completion (settings-consolidation)*
