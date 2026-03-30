# Phase 1: Settings Consolidation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the `packs` vs `topicIds` schema mismatch bug and consolidate the settings pages into a unified tabbed `/settings` interface. This phase covers frontend-only changes (UI + API wiring). Pipeline logic changes (keywordBlacklist → Topic.excludeRules) are deferred to Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Tab structure and routing
- **D-01:** Unified `/settings` page with 3 tabs: Daily / Weekly / Sources
- **D-02:** `/config` redirects (301) to `/settings` with Sources tab active
- **D-03:** `/settings/reports` URL is replaced by `/settings` (Daily/Weekly tabs); old URL no longer exists after consolidation
- **D-04:** Sidebar "Config" nav item links to `/settings` (Sources tab); "报告设置" nav item links to `/settings` (Daily tab)

### Topic selection UI
- **D-05:** Keep checkbox list UI pattern (not dropdown/multi-select)
- **D-06:** Rename label "数据源 Pack" → "数据源 Topic" in the checkbox list
- **D-07:** `useTopics()` hook already returns `Topic[]` — no hook changes needed

### Frontend-backend field wiring
- **D-08:** Frontend `DailyConfig.packs: string[]` field must be renamed to `DailyConfig.topicIds: string[]`
- **D-09:** Frontend must read `settings.daily.topicIds` (not `settings.daily.packs`) from API response
- **D-10:** Frontend must send `topicIds` (not `packs`) in PUT body to `/api/settings/reports`
- **D-11:** Backend API is already correct (`topicIds` schema); no backend changes required for the field mismatch fix

### Non-required fields (retained in Phase 1)
- **D-12:** `keywordBlacklist` — keep in UI and API; deferred pipeline merge with `Topic.excludeRules` goes to Phase 3
- **D-13:** `kindPreferences` — keep in UI and API; actively used by `scoring/base-stage.ts` in pipeline
- **D-14:** `filterPrompt` — keep in UI and API; actively used by `daily.ts` AI filtering stage

### Component architecture
- **D-15:** `ConfigPage` component (sources) is imported into the tabbed `/settings` page as the Sources tab content
- **D-16:** `ReportSettingsPage` component is split or imported into the tabbed `/settings` page as Daily/Weekly tab content

### Deferred (Phase 3)
- **D-17:** `keywordBlacklist` field merges into `Topic.excludeRules` — pipeline `daily.ts` reads excludeRules instead; this is Phase 3 scope (PIPELINE-02/03)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 scope
- `.planning/ROADMAP.md` §Phase 1 — Success Criteria (4 items: unified page, topicIds, API correctness, Sources tab)
- `.planning/REQUIREMENTS.md` — FRONTEND-01 (packs vs topicIds fix), FRONTEND-02 (tab-based consolidation)

### Project conventions
- `.planning/ROADMAP.md` — Full roadmap structure
- `CLAUDE.md` §Frontend Development — Component modification verification, playwriter verification requirement
- `CLAUDE.md` §API Route Standards — Shared utilities (`lib/api-response.ts`) must be used

### Existing components
- `components/report-settings-page.tsx` — Current report settings page (needs refactor into tabs)
- `components/config-page.tsx` — Current sources config page (imported into Sources tab)
- `hooks/use-api.ts` — `useReportSettings()`, `useTopics()` hooks

### Backend API
- `app/api/settings/reports/route.ts` — GET/PUT handlers; schema uses `topicIds` correctly

### Pipeline references (for field retention decisions)
- `src/reports/daily.ts` — Uses `keywordBlacklist`, `filterPrompt`, `kindPreferences`; pipeline changes deferred to Phase 3
- `src/reports/scoring/base-stage.ts` — Uses `kindPreferences` for article/tweet base scoring

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/card.ts`, `components/ui/checkbox.ts`, `components/ui/badge.ts` — Already used in report settings page
- `hooks/use-api.ts` — `useTopics()` returns `Topic[]` with id/name, no changes needed
- `components/report-settings-page.tsx` — Has all sub-components (PromptField, TagInput, NumberField) to extract into shared or keep as internal

### Established Patterns
- Tab-based navigation using shadcn/ui tabs pattern (not yet in codebase — will be new)
- SWR data fetching with `useReportSettings()` — normalize/format hooks already handle prompt escaping
- `escapePrompts()` utility from `use-api.ts` — must be called before PUT

### Integration Points
- Sidebar nav: `activeNav="settings/reports"` and `activeNav="config"` → both point to `/settings`
- Tab state: URL query param (`?tab=daily|weekly|sources`) or React state
- `ConfigPage` import: `import { ConfigPage } from "@/components/config-page"` for Sources tab

</code_context>

<specifics>
## Specific Ideas

- "Tab 合并后 /settings/reports 不存在了，旧的 URL 要做重定向"
- "ConfigPage 组件直接 import 到 Settings 页面作为 Sources tab"
- "checkbox list 方案保留，只改 label 和 field 名称"

</specifics>

<deferred>
## Deferred Ideas

### Phase 3: keywordBlacklist → Topic.excludeRules
- `keywordBlacklist` field in DailyReportConfig to be removed
- Pipeline `daily.ts` keywordBlacklist filtering logic to read `Topic.excludeRules` instead
- This requires coordinated change across: schema, API, frontend, and pipeline (belongs in Phase 3: PIPELINE-02/03)

</deferred>

---

*Phase: 01-settings-consolidation*
*Context gathered: 2026-03-30*
