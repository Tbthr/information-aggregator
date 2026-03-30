# Project Research Summary

**Project:** Information Aggregator Settings Pages
**Domain:** Frontend Settings Consolidation + Pipeline Quality
**Researched:** 2026-03-30
**Confidence:** HIGH (based on deep code analysis across pipeline, reports, config layers)

## Executive Summary

The Information Aggregator project requires fixing a critical frontend-backend schema mismatch and optimizing the content pipeline that powers AI-generated daily/weekly reports. The frontend settings page (`ReportSettingsPage`) uses deprecated `packs` field names while the backend API and database correctly use `topicIds`. Additionally, the current architecture splits related settings across two separate pages (`/settings/reports` and `/config`), reducing discoverability.

Research identifies two parallel tracks: (1) a critical settings consolidation and bug-fix effort targeting FRONTEND-01 and FRONTEND-02, and (2) a pipeline quality audit and AI optimization effort targeting PIPELINE-01 through PIPELINE-04. The recommended approach is to fix the critical `packs` to `topicIds` bug immediately, then consolidate settings into a tab-based `/settings` page, followed by pipeline field-quality and AI-call optimizations. Nine distinct pitfalls were identified across the pipeline, settings, and AI processing layers, with the most critical being RSS timestamp handling and per-item AI call inefficiency in weekly pick generation.

## Key Findings

### Recommended Stack

**Stack is fully established.** All technologies are already in the project -- no new packages required. The consolidation work uses existing shadcn/ui components and existing SWR hooks.

**Core technologies:**
- **Next.js 16 App Router** -- project standard, powers the settings page routing
- **React 19** -- project standard
- **shadcn/ui Tabs** -- `components/ui/tabs.tsx` (Radix-based, accessible) for settings consolidation
- **SWR 2.x** -- already used in `hooks/use-api.ts`, used for settings data fetching
- **Zod 3.x** -- already used in API routes for config validation

### Expected Features

**Must have (table stakes):**
- Report configuration (daily/weekly) -- **has critical bug**: uses `packs` instead of `topicIds`
- Source management -- fully implemented, working correctly
- Topic management -- fully implemented, working correctly
- AI prompt configuration -- implemented with `PromptField` component
- Topic selection for daily reports -- **buggy**: `packs` name used, API expects `topicIds`
- Numeric settings (maxItems, minScore) -- implemented with `NumberField` component

**Should have (competitive):**
- Tab-based settings consolidation -- recommended: single `/settings` page with tabs for reports + sources
- Visual source health indicators -- partially implemented, expand to show last success/failure

**Defer (v2+):**
- Preview estimated content count before saving -- requires API enhancement
- Per-topic prompt customization -- significant refactoring needed

### Architecture Approach

The architecture has one critical flaw: `ReportSettingsPage` uses a deprecated `packs` concept that no longer exists in the backend schema (after `c759a8b` and `33e4bf6` refactors). The correct data model is `Source` -> `Topic` -> `Content` with `DailyReportConfig.topicIds[]` filtering which topics appear in daily reports. The recommended architecture is a **single `/settings` page with two tabs** ("报告设置" and "数据源配置"), using the existing `Tabs` component. This keeps conceptually coupled settings discoverable in one place. The alternative (separate pages) was rejected because the two settings are workflow-coupled and users should not need to remember where to go for related configuration.

### Critical Pitfalls

1. **RSS/Atom Field Completeness** -- Relative timestamps silently discarded; Atom feed links require `href` attribute extraction. Monitor discard rates, add Atom link attribute support.

2. **Per-Item AI Calls in Weekly Picks** -- `generateWeeklyPicks()` calls AI in a loop (6 picks = 6 HTTP requests). Consolidate to single batched call.

3. **Settings UI/Backend Schema Drift** -- `ReportSettingsPage` sends `packs`, API expects `topicIds`. This is the highest-priority bug. Fix immediately.

4. **Empty Initial topicIds Produces Empty Reports** -- If `DailyReportConfig.topicIds` seeds as `[]`, behavior is "include all" (correct), but user-updated non-empty topicIds with no matching content produces empty reports silently.

5. **AI Clustering Non-Determinism** -- Same content run twice produces different topic assignments. Pin model version, add stability logging.

## Implications for Roadmap

### Phase 1: Fix Critical Bug + Settings Consolidation
**Rationale:** The `packs` -> `topicIds` mismatch is blocking correct functionality. It must be fixed before any other settings work proceeds.

**Delivers:**
- Fixed `ReportSettingsPage` with `topicIds` field
- Consolidated `/settings` page with two tabs (reports + sources)
- Correct API contract verified via roundtrip test

**Addresses:**
- FRONTEND-01: Frontend settings page sync
- FRONTEND-02: Pack -> Source/Topic migration

**Avoids:**
- Pitfall 3: Settings UI/Backend Schema Drift

### Phase 2: Pipeline Field Quality Audit
**Rationale:** Field completeness issues in adapters cause content to be silently discarded, degrading report quality. This affects all downstream AI processing.

**Delivers:**
- RSS adapter: Atom `href` attribute link extraction
- RSS adapter: Relative timestamp handling
- Discard rate monitoring per source
- Near-dedup threshold audit and logging

**Addresses:**
- PIPELINE-01: Field quality audit

**Avoids:**
- Pitfall 1: RSS/Atom Field Completeness
- Pitfall 5: 24-Hour Window issues
- Pitfall 7: Near-Dedup Threshold

### Phase 3: Initial Topic Configuration + Seed Data
**Rationale:** Empty or misconfigured `topicIds` causes empty reports with no user-facing explanation. Proper seeding prevents this.

**Delivers:**
- Supabase seed with default `topicIds` = all active topic IDs
- Settings UI shows topic count preview before saving
- Validation warning when configured topicIds have zero content

**Addresses:**
- PIPELINE-02: Initial topic configuration

**Avoids:**
- Pitfall 4: Empty Initial topicIds

### Phase 4: AI Call Optimization
**Rationale:** Per-item AI calls in weekly pick generation are inefficient (N calls vs 1 batched call). Also addresses clustering non-determinism.

**Delivers:**
- `buildPickReasonsPrompt(items[])` batched version -- 1 AI call instead of N
- Model pinning to specific version (e.g., `claude-3-5-sonnet-20241022`)
- Stability mode for topic clustering
- Tweet identification improvement in clustering prompts

**Addresses:**
- PIPELINE-03: Daily AI optimization
- PIPELINE-04: Weekly flow audit

**Avoids:**
- Pitfall 2: Per-Item AI Calls
- Pitfall 6: AI Clustering Non-Determinism
- Pitfall 9: Content Type Confusion (tweet title)

### Phase 5: Pipeline Robustness
**Rationale:** Prisma batch operations can partially fail, leaving inconsistent state. Transaction wrapping prevents this.

**Delivers:**
- `$transaction` wrapping for `upsertSourcesBatch` and `syncTopicsToPrisma`
- Retry logic (up to 3x) for failed upserts
- Specific failure logging for manual re-run

**Addresses:**
- PIPELINE-01 (partial): Pipeline robustness

**Avoids:**
- Pitfall 8: Prisma Batch Partial Failure

### Phase Ordering Rationale

- **Phase 1 before 2-5:** The settings bug is a correctness issue that must be resolved before users can trust the configuration. It blocks all other settings work.
- **Phase 2 before 4:** Field quality affects AI input quality. Fixing adapters first ensures AI optimization works on complete data.
- **Phase 3 (seed data) before 4:** AI optimization for reports depends on having properly configured topic filtering.
- **Phase 5 at end:** Pipeline robustness is a hardening concern; it protects work done in phases 2-4.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (AI Call Optimization):** Complex integration with multiple AI providers; may need to validate batching approach with actual API responses
- **Phase 3 (Seed Data):** Needs verification of actual Supabase seed scripts to confirm topicId population

Phases with standard patterns (skip research-phase):
- **Phase 1 (Bug Fix + Consolidation):** Standard Next.js + shadcn/ui patterns; codebase already has working examples of both Tabs and SWR hooks
- **Phase 2 (Field Quality):** Standard adapter patterns; existing code in `src/adapters/` provides clear templates

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in project; no new packages needed |
| Features | HIGH | Table stakes fully enumerated; bug identification from direct code analysis |
| Architecture | HIGH | Recommended tab-based consolidation directly supported by existing components |
| Pitfalls | HIGH | Deep code analysis of all pipeline, adapter, report, and config layers |

**Overall confidence:** HIGH

### Gaps to Address

- **AI batching approach validation:** The recommended `buildPickReasonsPrompt(items[])` batched function is a design proposal. Implementation should validate output quality vs per-item approach.
- **Supabase seed verification:** The recommended "seed with all active topicIds" needs verification against actual seed scripts in the repository.
- **Discard rate baseline:** No baseline established for what "normal" discard rate looks like. Phase 2 should establish this before declaring success.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `components/report-settings-page.tsx`, `components/config-page.tsx`
- Codebase analysis: `app/api/settings/reports/route.ts` (API contract)
- Codebase analysis: `prisma/schema.prisma` (data model)
- Codebase analysis: `src/pipeline/`, `src/adapters/rss.ts`, `src/adapters/json-feed.ts`, `src/adapters/x-bird.ts`
- Codebase analysis: `src/reports/daily.ts`, `src/reports/weekly.ts`
- Codebase analysis: `src/archive/upsert-content-prisma.ts`
- Codebase analysis: `src/ai/prompts-reports.ts`

### Secondary (MEDIUM confidence)
- PROJECT.md active requirements -- provides requirement context but was written during initialization
- shadcn/ui component documentation -- confirms Tabs component exists and is Radix-based

### Tertiary (LOW confidence)
- External UX research unavailable due to search API unavailability; tab-based consolidation recommendation based on established patterns

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
