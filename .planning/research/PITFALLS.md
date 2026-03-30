# Domain Pitfalls: Settings Pages

**Domain:** Information Aggregator Settings Pages
**Researched:** 2026-03-30

---

## Critical Pitfalls

### Pitfall 1: Field Name Mismatch (packs vs topicIds)

**What goes wrong:**
`ReportSettingsPage` uses `DailyConfig.packs: string[]` but the API (`/api/settings/reports`) expects `DailyReportConfig.topicIds: string[]`. The frontend fetches topics via `useTopics()` but names the field `packs`.

**Why it happens:**
Pack was a deprecated concept that was removed from the schema but the frontend was not fully migrated. The backend API was updated to use `topicIds`, but the frontend component still uses `packs`.

**Consequences:**
- Topic selection in daily report settings does not persist correctly
- Users think they're configuring topics but actually setting a field the API ignores
- Empty topic selection may cause all content to be included (default behavior) or filtered unexpectedly

**Prevention:**
- Use shared TypeScript types between frontend and backend
- Add integration tests for GET -> PUT -> GET roundtrip

**Detection:**
- Check browser network tab: is `packs` being sent to API but API expects `topicIds`?
- After saving report settings, do configured "topics" actually filter content?

---

### Pitfall 2: Settings Scattered Across Multiple Pages

**What goes wrong:**
Report configuration (`/settings/reports`) and source/topic configuration (`/config`) are in separate sidebar entries, making it unclear they are related.

**Why it happens:**
Historical growth: report settings were added first, then source/topic management was added as a separate section.

**Consequences:**
- Users configure sources/topics but don't realize they need to also configure which topics appear in daily reports
- Discovery problem: where do I configure X? Users may not find related settings
- Inconsistent terminology: "Pack" vs "Topic" confusion

**Prevention:**
- Group related settings under single navigation entry
- Use tabs for sub-categorization within a settings area
- Clear breadcrumb or section headers

**Detection:**
- Low engagement with certain settings (users can't find them)
- Support questions: "where do I configure X?"

---

## Moderate Pitfalls

### Pitfall 3: Tab Content State Loss

**What goes wrong:**
When using `TabsContent`, React unmounts the inactive tab's content by default. If users enter data in Tab B, switch to Tab A, then back to Tab B, their unsaved changes in Tab B are lost.

**Why it happens:**
Radix Tabs content unmounts when not active (default behavior).

**Prevention:**
- Use `Tabs` with `keepMounted` if available, or manage state externally
- Warn users before switching tabs with unsaved changes
- Auto-save draft state to localStorage

**Detection:**
- Users report: "I filled out the weekly settings but they disappeared when I switched tabs"

---

### Pitfall 4: Mixing Related and Unrelated Settings

**What goes wrong:**
Report settings (daily/weekly AI prompts, limits) and source management (adding feeds, configuring topics) are fundamentally different:
- Report settings: global behavior, rarely changed
- Source management: frequent additions, ongoing maintenance

Putting them in the same tabbed interface may feel cramped or confusing.

**Why it happens:**
Over-consolidation to reduce navigation entries.

**Prevention:**
- Keep report settings and source management visually distinct even if consolidated under `/settings`
- Consider whether consolidation actually helps or hinders the workflow

---

## Minor Pitfalls

### Pitfall 5: Empty State Confusion in Topic Selection

**What goes wrong:**
`DailyReportConfig.topicIds = []` means "include all topics" (OR logic: no filter). But the UI label "选择 Topics (不选则使用所有 Topic)" is ambiguous.

**Why it happens:**
The semantic difference between "no selection" and "select all" is not clearly communicated.

**Prevention:**
- Add explicit checkbox "使用所有 Topics" above the topic list
- Or use a "Select All / Clear" pattern with clear count display

---

### Pitfall 6: No Validation Feedback Before Save

**What goes wrong:**
Settings are validated only on the server after save. If `maxItems = 500` (exceeds API max of 200), the save fails with an error toast. User must re-enter correct value.

**Why it happens:**
Client-side validation exists for individual fields (NumberField has min/max), but no pre-submission validation summary.

**Prevention:**
- Add real-time validation indicators on fields
- Show inline errors before attempting save

---

### Pitfall 7: Missing Loading/Error States in ConfigPage

**What goes wrong:**
`ConfigPage` shows a spinner during initial load, but if topics or sources fail to load after initial load (e.g., network error on subsequent fetch), the UI does not handle error state gracefully.

**Why it happens:**
SWR error state is not surfaced in the UI.

**Prevention:**
- Use SWR's `error` state to show error boundary
- Provide "Retry" action

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Tab-based navigation | State loss on tab switch | Use external state management or warn before switch |
| Field name fix | Breaking existing user configs | Provide migration path; test with existing data |
| API contract alignment | Frontend/backend schema drift | Shared Zod schemas, integration tests |

---

## Sources

- Codebase analysis: `components/report-settings-page.tsx`, `components/config-page.tsx`
- API analysis: `app/api/settings/reports/route.ts`
- UI pattern analysis: `components/ui/tabs.tsx` (Radix-based)
- Prisma schema: `prisma/schema.prisma`
