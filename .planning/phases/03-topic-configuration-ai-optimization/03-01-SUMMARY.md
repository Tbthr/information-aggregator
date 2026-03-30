---
phase: 03-topic-configuration-ai-optimization
plan: "01"
subsystem: pipeline / reports
tags: [topic-config, migration, keyword-blacklist, exclude-rules]
dependency_graph:
  requires: []
  provides:
    - id: PIPELINE-02
      description: "Daily report filters content using Topic.excludeRules instead of keywordBlacklist"
  affects:
    - prisma/schema.prisma (DailyReportConfig model)
    - src/reports/daily.ts (filterContent function)
    - app/api/settings/reports/route.ts (API schema/handlers)
    - components/report-settings-page.tsx (frontend)
tech_stack:
  added:
    - scripts/migrate-keyword-blacklist.ts (one-time migration)
    - scripts/seed-topics.ts (topic seeding)
  patterns:
    - "Topic.excludeRules for per-topic content filtering"
    - "Dynamic import of loadTopicsByIds in filterContent"
key_files:
  created:
    - scripts/migrate-keyword-blacklist.ts
    - scripts/seed-topics.ts
  modified:
    - prisma/schema.prisma
    - src/reports/daily.ts
    - app/api/settings/reports/route.ts
    - components/report-settings-page.tsx
decisions:
  - "keywordBlacklist field removed from DailyReportConfig model"
  - "filterContent now uses Topic.excludeRules via loadTopicsByIds()"
  - "Migrate existing blacklist keywords to Topic.excludeRules before schema push"
  - "Seed 6 preset topics on fresh installs via seed-topics.ts"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-31"
---

# Phase 03 Plan 01: Keyword Blacklist Migration Summary

## One-liner

Keyword blacklist replaced with per-topic `excludeRules` on Topic model; 6 preset topics seeded.

## Completed Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Remove keywordBlacklist from DailyReportConfig schema | `1941563` |
| 2 | Create migrate-keyword-blacklist.ts one-time migration | `5d1b63b` |
| 3 | Create seed-topics.ts with 6 preset topics | `d76b46a` |
| 4 | Refactor filterContent to use Topic.excludeRules | `fcb0d6d` |
| 5 | Remove keywordBlacklist from API schema and PUT handler | `fe1a4d3` |
| 6 | Remove keywordBlacklist from frontend component | `b66acca` |

## Artifacts Created

### scripts/migrate-keyword-blacklist.ts
One-time migration that reads `DailyReportConfig.keywordBlacklist` and converts each keyword into a `Topic` with `excludeRules = [keyword]`. After migration, clears the blacklist field. Run **before** `npx prisma db push`.

### scripts/seed-topics.ts
Seeds 6 preset topics:
- AI Agent, LLM, 地缘冲突, 科技趋势, 商业财经, AI产品

Also initializes `DailyReportConfig.topicIds` with all 6 topic IDs.

## Changes Made

### Schema (prisma/schema.prisma)
- Removed `keywordBlacklist String[]` from `DailyReportConfig` model

### filterContent (src/reports/daily.ts)
- Removed `keywordBlacklist` destructuring
- Added dynamic import of `loadTopicsByIds` from `@/src/config/load-pack-prisma`
- Built `excludeRulesMap: Map<topicId, keywords[]>` from loaded topics
- Replaced `matchesBlacklist()` with per-topic excludeRules matching:
  - For each content, iterates over its topicIds
  - If any topic has excludeRules matching content title+body, content is filtered OUT

### API (app/api/settings/reports/route.ts)
- Removed `keywordBlacklist` from `dailyConfigSchema` z.object
- Removed `keywordBlacklist` from `updateData` construction in PUT handler
- Removed `keywordBlacklist` from upsert create data

### Frontend (components/report-settings-page.tsx)
- Removed `keywordBlacklist: string[]` from `DailyConfig` interface
- Removed `keywordBlacklist: []` from initial daily state
- Removed keywordBlacklist sync in useEffect
- Removed keywordBlacklist from handleSave payload
- Removed entire "关键词黑名单" JSX section

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `grep -n "keywordBlacklist" prisma/schema.prisma` returns 0 results
- `grep -n "keywordBlacklist" src/reports/daily.ts` returns 0 results
- `grep -n "keywordBlacklist" app/api/settings/reports/route.ts` returns 0 results
- `grep -n "keywordBlacklist" components/report-settings-page.tsx` returns 0 results
- `grep -n "excludeRules" src/reports/daily.ts` returns 8 results
- `pnpm check` passes (exit 0)
- `pnpm build` succeeds

## Self-Check: PASSED

All success criteria met:
- DailyReportConfig.keywordBlacklist field removed from schema
- One-time migration script converts existing blacklist entries to Topic.excludeRules
- 6 preset topics seeded: AI Agent, LLM, 地缘冲突, 科技趋势, 商业财经, AI产品
- DailyReportConfig.topicIds initialized with all 6 topic IDs (via seed-topics.ts)
- daily.ts filterContent uses Topic.excludeRules (not keywordBlacklist)
- keywordBlacklist removed from API schema, PUT handler, and GET response
- keywordBlacklist removed from frontend ReportSettingsPage component
