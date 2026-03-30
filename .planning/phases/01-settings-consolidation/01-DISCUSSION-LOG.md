# Phase 1: Settings Consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 1-settings-consolidation
**Areas discussed:** Tab Structure, Topic Selection UI, Field Retention, keywordBlacklist Merge

---

## Area 1: Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tabs 合并 | /settings 有 Daily / Weekly / Sources 三个 tab，从 /config 和 /settings/reports 都跳转到 /settings（可用 301 重定向） | ✓ |
| 2 tabs + 子路径 | /settings 只有 Daily / Weekly；Sources tab 点击后展开子面板或跳转 /config（保留 /config URL） | |
| 只修 bug 不动结构 | 只修复 packs→topicIds bug，保持 /config 和 /settings/reports 分开 | |

**User's choice:** 3 tabs 合并
**Notes:** Tab structure locked: 3 tabs (Daily/Weekly/Sources) at /settings

---

## Area 2: Topic Selection UI

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox list | 保持 checkbox list — 优点：同时可见所有 topic，适合少量 topic；已有组件基础，改 label 即可 | ✓ |
| Multi-select dropdown | Combobox/DropdownSelect — 优点：节省空间，适合 topic 数量增长；需要新组件或库 | |

**User's choice:** Checkbox list (recommended)
**Notes:** Keep existing checkbox pattern, rename "数据源 Pack" → "数据源 Topic"

---

## Area 3: Field Retention (keywordBlacklist, kindPreferences, filterPrompt)

| Option | Description | Selected |
|--------|-------------|----------|
| 全部保留 | keywordBlacklist、kindPreferences、filterPrompt 都保留；只删 packs；保持现状减少风险 | ✓ |
| 只删 packs | 只修 bug 删除 packs 字段，其他非必需字段也保留 | |
| 精简范围 | keywordBlacklist 和 kindPreferences 也评估是否需要，可能在 Phase 1 中删除 | |

**User's choice:** 全部保留 (recommended)

**Notes:**
- keywordBlacklist: User wants to merge with Topic.excludeRules eventually, but pipeline change scope → deferred to Phase 3
- kindPreferences: Pipeline uses it in scoring/base-stage.ts — keep
- filterPrompt: Pipeline uses it in daily.ts AI filtering — keep

---

## Area 4: keywordBlacklist Merge (deferred check)

| Option | Description | Selected |
|--------|-------------|----------|
| 确认推迟 | Phase 1 只修 packs bug；keywordBlacklist+excludeRules 合并放到 Phase 3 的 PIPELINE-02/03 中 | ✓ |
| Phase 1 直接做 | Phase 1 同时做 pipeline 改动（keywordBlacklist→excludeRules）。会导致 Phase 1 工作量增加 | |

**User's choice:** 确认推迟 (recommended)

**Notes:** keywordBlacklist → Topic.excludeRules merge deferred to Phase 3 (PIPELINE-02/03 scope). Requires changes to:
- Prisma schema (remove keywordBlacklist from DailyReportConfig)
- Pipeline `daily.ts` (read excludeRules instead of keywordBlacklist)
- Frontend (remove keywordBlacklist field from UI)
- API (remove keywordBlacklist from schema)

---

## Claude's Discretion

- Tab state management approach (URL query param vs React state) — not discussed; planner decides
- Exact redirect implementation (Next.js redirect() vs Next.config.mjs rewrites) — planner decides
- Whether to extract ConfigPage sub-components before importing into tabbed page — planner decides

## Deferred Ideas

- keywordBlacklist + Topic.excludeRules merge — belongs in Phase 3 (PIPELINE-02/03)
