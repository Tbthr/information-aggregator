---
phase: 01-settings-consolidation
plan: "02"
subsystem: ui
tags: [nextjs, tabs, routing, react, radix]

# Dependency graph
requires:
  - phase: 01-settings-consolidation
    plan: "01"
    provides: ReportSettingsPage updated with topicIds field (plan 01 commit eb829bb)
provides:
  - Unified /settings page with Daily/Weekly/Sources tabs
  - Redirects from deprecated /config and /settings/reports URLs
  - Updated sidebar navigation with tab-aware highlighting
affects:
  - Phase 01 settings consolidation (final deliverable)
  - Any phase using settings page routing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL search params for tab state persistence (useSearchParams + router.replace)
    - Active tab prop for ReportSettingsPage to conditionally render sections
    - Nested Suspense boundaries for useSearchParams (Next.js 16 requirement)

key-files:
  created:
    - app/settings/page.tsx - New unified settings page with tabbed interface
  modified:
    - components/config-page.tsx - Extracted ConfigPageHeader component
    - components/report-settings-page.tsx - Added activeTab prop for section visibility
    - components/sidebar.tsx - Updated nav items to use settings-daily/settings-sources
    - components/topbar.tsx - Added PAGE_TITLES entries for settings nav IDs
    - app/config/page.tsx - Redirect to /settings?tab=sources
    - app/settings/reports/page.tsx - Redirect to /settings

key-decisions:
  - "Used activeTab prop on ReportSettingsPage to control section visibility instead of CSS hiding"
  - "Used separate nav IDs (settings-daily, settings-sources) for sidebar tab-aware highlighting"
  - "Nested Suspense boundaries required for useSearchParams in Next.js 16"

patterns-established:
  - "Tab state via URL params pattern: useSearchParams read initial tab, router.replace updates"
  - "ReportSettingsPage section extraction via activeTab prop"

requirements-completed: [FRONTEND-02, FRONTEND-01]

# Metrics
duration: 15min
completed: 2026-03-31
---

# Phase 01 Settings Consolidation - Plan 02 Summary

**Unified /settings page with Daily/Weekly/Sources tabs, deprecated URL redirects, and tab-aware sidebar navigation**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-31T00:00:00Z
- **Completed:** 2026-03-31T00:15:00Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments
- Created unified /settings page with URL-persisted tab state (?tab=daily|weekly|sources)
- Implemented Daily/Weekly section visibility control via activeTab prop on ReportSettingsPage
- Added redirects from deprecated /config and /settings/reports to /settings
- Updated sidebar navigation with tab-aware highlighting (settings-daily/settings-sources nav IDs)

## Task Commits

Each task was committed atomically:

1. **Task 0: Extract ConfigPageHeader** - `c1fe64b` (feat)
2. **Task 1: Create app/settings/page.tsx** - `620ea33` (feat)
3. **Task 2: Create redirect routes** - `19dfcaa` (feat)
4. **Task 3: Update sidebar navigation** - `941fa9b` (feat)

**Plan metadata:** `18aebcb` (docs: complete plan 01-01)

## Files Created/Modified
- `app/settings/page.tsx` - New unified settings page with Tabs, URL state, tab-aware activeNav
- `components/config-page.tsx` - Extracted ConfigPageHeader function, ConfigPage uses it internally
- `components/report-settings-page.tsx` - Added activeTab prop to control section visibility
- `components/sidebar.tsx` - Updated nav items: "报告设置" → /settings, "设置" → /settings?tab=sources
- `components/topbar.tsx` - Added PAGE_TITLES for settings, settings-daily, settings-sources
- `app/config/page.tsx` - Now redirects (308) to /settings?tab=sources
- `app/settings/reports/page.tsx` - Now redirects (308) to /settings

## Decisions Made
- Used nested Suspense boundaries (inner for useSearchParams content, outer for full page) to satisfy Next.js 16 static generation requirements
- Used separate nav IDs (settings-daily, settings-sources) to enable sidebar tab-aware highlighting without complicating the activeNav prop with URL parsing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Build error with useSearchParams requiring Suspense boundary - resolved by restructuring page into nested components with proper Suspense wrapping at each level where useSearchParams is used
- CSS-based section hiding (initially attempted) would not work because ReportSettingsPage renders its own DOM structure - switched to activeTab prop approach

## Next Phase Readiness
- Settings consolidation phase complete
- /settings page is the new unified settings interface
- Deprecated URLs (/config, /settings/reports) properly redirect
- All sidebar navigation links updated

---
*Phase: 01-settings-consolidation-plan-02*
*Completed: 2026-03-31*
