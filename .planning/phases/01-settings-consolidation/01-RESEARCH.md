# Phase 1: Settings Consolidation - Research

**Researched:** 2026-03-31
**Domain:** Next.js 16 App Router frontend consolidation + React state migration
**Confidence:** HIGH

## Summary

Phase 1 requires fixing a field-name mismatch bug (frontend sends `packs`, backend expects `topicIds`) and consolidating two separate settings pages into a single tabbed `/settings` interface. The backend API is already correct — the bug is entirely in the frontend component `ReportSettingsPage` and its `DailyConfig` interface. The consolidation involves creating a new `app/settings/page.tsx` using shadcn/ui `Tabs`, importing `ConfigPage` for the Sources tab, and splitting `ReportSettingsPage` into Daily and Weekly tab content. Three routing changes are needed: new `/settings` page, `/config` redirect, and `/settings/reports` redirect.

**Primary recommendation:** Create `app/settings/page.tsx` as the new unified settings page using `Tabs` from `components/ui/tabs.tsx`, extract Daily and Weekly form sections from `ReportSettingsPage` into tab content components, and fix `packs` → `topicIds` field name throughout the report settings component.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Unified `/settings` page with 3 tabs: Daily / Weekly / Sources
- **D-02:** `/config` redirects (301) to `/settings` with Sources tab active
- **D-03:** `/settings/reports` URL is replaced by `/settings`; old URL no longer exists after consolidation
- **D-04:** Sidebar "Config" nav item links to `/settings` (Sources tab); "报告设置" nav item links to `/settings` (Daily tab)
- **D-05:** Keep checkbox list UI pattern (not dropdown/multi-select)
- **D-06:** Rename label "数据源 Pack" → "数据源 Topic" in the checkbox list
- **D-07:** `useTopics()` hook already returns `Topic[]` — no hook changes needed
- **D-08:** Frontend `DailyConfig.packs: string[]` field must be renamed to `DailyConfig.topicIds: string[]`
- **D-09:** Frontend must read `settings.daily.topicIds` (not `settings.daily.packs`) from API response
- **D-10:** Frontend must send `topicIds` (not `packs`) in PUT body to `/api/settings/reports`
- **D-11:** Backend API is already correct (`topicIds` schema); no backend changes required
- **D-12:** `keywordBlacklist` — keep in UI and API; deferred to Phase 3
- **D-13:** `kindPreferences` — keep in UI and API; actively used by pipeline
- **D-14:** `filterPrompt` — keep in UI and API; actively used by `daily.ts`
- **D-15:** `ConfigPage` component imported into the tabbed `/settings` page as Sources tab content
- **D-16:** `ReportSettingsPage` component split/imported as Daily/Weekly tab content

### Deferred Ideas (OUT OF SCOPE)

- `keywordBlacklist` field merges into `Topic.excludeRules` — Phase 3 scope (PIPELINE-02/03)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FRONTEND-01 | Fix `packs` vs `topicIds` mismatch | Backend already uses `topicIds` (confirmed in `app/api/settings/reports/route.ts`); frontend `DailyConfig.packs` must be renamed to `topicIds` throughout `ReportSettingsPage` |
| FRONTEND-02 | Tab-based settings consolidation | New `app/settings/page.tsx` with shadcn/ui Tabs (Daily/Weekly/Sources); imports `ConfigPage` for Sources, extracts form sections from `ReportSettingsPage` for Daily/Weekly tabs |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 16.2.0 | 16.2.0 | App Router framework | Project baseline |
| React 19.2.4 | 19.2.4 | UI library | Project baseline |
| shadcn/ui Tabs | via `@radix-ui/react-tabs` | Tab navigation | Already in codebase at `components/ui/tabs.tsx` |
| SWR 2.4.1 | 2.4.1 | Data fetching | Required by CLAUDE.md data fetching standards |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `components/ui/tabs.tsx` | Radix-based Tabs primitive | New `/settings` page tab navigation |
| `components/ui/card.tsx` | Card container | Section grouping within tabs |
| `components/ui/checkbox.tsx` | Topic selection | Checkbox list in Daily tab |
| `components/ui/badge.tsx` | Keyword tags | TagInput component |
| `components/ui/button.tsx` | Save button | Form submission |
| `components/ui/input.tsx` | Tag input, number fields | User input |
| `components/ui/textarea.tsx` | Prompt fields | Multi-line AI prompt input |
| `components/ui/label.tsx` | Field labels | Form labels |
| `components/loading-skeletons.tsx` | PageSkeleton | Loading state |
| `hooks/use-toast.ts` | Toast notifications | Save success/failure feedback |
| `lib/api-response.ts` | `escapePrompts` | Must call before PUT to escape newlines |

### No New Dependencies

Phase 1 reuses all existing components. No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── settings/
│   └── page.tsx          # NEW: unified tabbed settings page
├── config/
│   └── page.tsx          # MODIFY: add 301 redirect to /settings
└── settings/
    └── reports/
        └── page.tsx      # MODIFY: add 301 redirect to /settings

components/
├── report-settings-page.tsx  # REFACTOR: extract Daily/Weekly into tab content
└── config-page.tsx           # ALREADY EXISTS: imported as Sources tab
```

### Pattern 1: Tab-Based Settings Page

**What:** New `app/settings/page.tsx` using `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `components/ui/tabs.tsx`.

**When to use:** Unified settings interface with 3 distinct sections.

**Example:**
```tsx
// app/settings/page.tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DailySettingsTab } from "@/components/settings/daily-tab"
import { WeeklySettingsTab } from "@/components/settings/weekly-tab"
import { ConfigPage } from "@/components/config-page"

export default function SettingsPage() {
  return (
    <AppLayout activeNav="settings" onNav={handleNav}>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">设置</h1>
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">日报</TabsTrigger>
            <TabsTrigger value="weekly">周报</TabsTrigger>
            <TabsTrigger value="sources">数据源</TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><DailySettingsTab /></TabsContent>
          <TabsContent value="weekly"><WeeklySettingsTab /></TabsContent>
          <TabsContent value="sources"><ConfigPage /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
```

### Pattern 2: URL Query Param Tab State

**What:** Use URL search params (`?tab=daily|weekly|sources`) to persist and share tab state.

**When to use:** Deep linking to specific tabs, browser back/forward support.

**Implementation:** `useSearchParams()` from `next/navigation` to read/write tab state.

### Pattern 3: Redirect Pattern for Deprecated Routes

**What:** Next.js `redirect()` with `permanent: false` (308 temporary redirect converted to 301 by browsers).

**When to use:** `/config` and `/settings/reports` routes that no longer exist.

**Example:**
```typescript
// app/config/page.tsx
import { redirect } from "next/navigation"
export default function ConfigRoute() {
  redirect("/settings?tab=sources")
}
```

### Pattern 4: Component Extraction for Tab Content

**What:** Extract Daily and Weekly form sections from `ReportSettingsPage` into separate components for cleaner tab integration.

**Implementation approach:** Two options — (A) create `components/settings/daily-tab.tsx` and `weekly-tab.tsx`, or (B) keep `ReportSettingsPage` as a single component with internal tab state and render different sections. Per D-16, the component is split.

### Anti-Patterns to Avoid

- **Do not use `alert()` for notifications** — use `toast()` from `hooks/use-toast.ts` (enforced by CLAUDE.md)
- **Do not use bare text "加载中..."** — use `PageSkeleton` from `components/loading-skeletons.tsx`
- **Do not use local-time Date methods** (`setHours()`, `getHours()`, etc.) — but this phase is frontend-only, so not directly applicable
- **Do not use `any` type** — TypeScript strict mode is enforced

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab state management | Custom tab state with `useState` | URL query params (`useSearchParams`) | Enables deep linking and browser history support |
| Redirect logic | Custom redirect components | Next.js `redirect()` from `next/navigation` | Built-in, works at request time |
| API response parsing | Manual JSON handling | `escapePrompts()` from `hooks/use-api.ts` | Handles newline escaping/unescaping correctly |
| Loading states | Text "加载中..." | `PageSkeleton` component | Consistent with project loading patterns |

---

## Common Pitfalls

### Pitfall 1: packs → topicIds Field Rename Incomplete

**What goes wrong:** Frontend sends `packs` in PUT body, backend ignores it (expects `topicIds`), so topic selection never persists.

**Why it happens:** The `DailyConfig` interface and all usages (`setDaily`, `togglePack`, sync effect, PUT body) must be updated atomically. Missing one place leaves the bug partially fixed.

**How to avoid:** Rename all occurrences systematically:
1. `DailyConfig.packs: string[]` → `DailyConfig.topicIds: string[]`
2. `daily.packs` → `daily.topicIds` in sync effect (read from `settings.daily.topicIds`)
3. `daily.packs` → `daily.topicIds` in toggle function and PUT body
4. Rename `togglePack` → `toggleTopicId`
5. Update label "数据源 Pack" → "数据源 Topic"

**Warning signs:** After saving, topic selection reverts to previous state on page reload.

### Pitfall 2: Missing escapePrompts() Before PUT

**What goes wrong:** Newlines in prompts are stored raw but read back escaped, causing prompt content to display with literal `\n` instead of line breaks.

**Why it happens:** The `escapePrompts()` utility converts `\n` → `\\n` before send; `normalizePrompts()` converts `\\n` → `\n` after receive. Skipping either step causes mismatch.

**How to avoid:** Always call `escapePrompts()` when building the PUT body (confirmed in existing `ReportSettingsPage.handleSave`). The existing code is correct — ensure extracted tab components maintain this.

### Pitfall 3: Tab State Not Persisted in URL

**What goes wrong:** Navigating to `/settings` always shows the Daily tab, even when user bookmarked `/settings?tab=sources`. Tab state is internal only.

**Why it happens:** Tabs component uses internal `defaultValue` without syncing to URL.

**How to avoid:** Use `useSearchParams` to read initial tab and `router.replace` with updated search param on tab change.

### Pitfall 4: ConfigPage Wrapped in Extra AppLayout

**What goes wrong:** `ConfigPage` already contains its own layout wrapper (border-b header with "数据源配置"), but when imported as tab content, it may render inside `AppLayout` of the parent `settings/page.tsx`, causing double-wrapping or layout breaks.

**Why it happens:** `ConfigPage` was designed as a standalone page route, not as a tab content component.

**How to avoid:** Review `ConfigPage` — it has its own header strip with `bg-sidebar px-6 py-3`. The new `app/settings/page.tsx` should render the tab bar separately from the tab content, and `ConfigPage` content should slot directly into `TabsContent` without its own header. Consider passing a prop to suppress the header or extract just the `EngineConfig` function as the tab content.

---

## Code Examples

### Verified: Tab Usage from components/ui/tabs.tsx

```tsx
// Source: components/ui/tabs.tsx (already in codebase)
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

<Tabs defaultValue="daily">
  <TabsList>
    <TabsTrigger value="daily">日报</TabsTrigger>
    <TabsTrigger value="weekly">周报</TabsTrigger>
    <TabsTrigger value="sources">数据源</TabsTrigger>
  </TabsList>
  <TabsContent value="daily">{/* Daily tab content */}</TabsContent>
  <TabsContent value="weekly">{/* Weekly tab content */}</TabsContent>
  <TabsContent value="sources">{/* Sources tab content */}</TabsContent>
</Tabs>
```

### Verified: Redirect Pattern

```typescript
// Source: Next.js 16 App Router
import { redirect } from "next/navigation"
// In a page component:
redirect("/settings?tab=sources") // 308 redirect, browsers treat as 301
```

### Verified: escapePrompts Usage

```typescript
// Source: existing ReportSettingsPage.handleSave (line 255)
body: JSON.stringify({
  daily: escapePrompts({
    topicIds: daily.topicIds, // renamed from packs
    // ...
  }),
  // ...
})
```

### Confirmed: Backend topicIds Schema

```typescript
// Source: app/api/settings/reports/route.ts line 10
const dailyConfigSchema = z.object({
  topicIds: z.array(z.string()).optional(),  // Already correct
  // ...
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/settings/reports` standalone page | Unified `/settings` with tabs | Phase 1 | Single settings entry point |
| `packs` field in frontend | `topicIds` field in frontend | Phase 1 | API field mismatch fixed |
| Two separate nav items | Single settings nav, tab-based | Phase 1 | Cleaner nav UX |
| `/config` standalone page | `/config` redirects to `/settings?tab=sources` | Phase 1 | Backward compatibility maintained |

**Deprecated/outdated:**
- `packs` field in frontend — replaced by `topicIds` (Phase 1 fix, not new pattern)

---

## Open Questions

1. **ConfigPage header handling**
   - What we know: `ConfigPage` renders its own header strip with "数据源配置" label and border
   - What's unclear: Whether the `ConfigPage` header should be shown when embedded in the Sources tab, or if the tab bar itself should serve as the header
   - Recommendation: The tab bar serves as the page-level navigation; `ConfigPage` should be used without its own header strip when embedded. Either pass a `hideHeader` prop to `ConfigPage`, extract `EngineConfig` directly, or accept the double header (tab bar + ConfigPage header are visually distinct).

2. **Sidebar nav active state**
   - What we know: Sidebar has two nav items: "报告设置" (activeNav="settings/reports") and "Config" (activeNav="config")
   - What's unclear: Whether these should merge into a single "设置" nav item or remain separate with different `activeNav` values pointing to `/settings` with different tab params
   - Recommendation: Per D-04, they point to different tabs (报告设置 → Daily, Config → Sources). Both `activeNav` values can be handled by checking if the target starts with "settings" — or use a single `activeNav="settings"` and differentiate via URL.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Phase 1 is frontend-only with existing codebase components and API routes already deployed locally).

---

## Sources

### Primary (HIGH confidence)
- `app/api/settings/reports/route.ts` — Confirmed `topicIds` is the correct backend field
- `components/ui/tabs.tsx` — Confirmed Radix-based Tabs component exists and is importable
- `hooks/use-api.ts` — Confirmed `escapePrompts()` and `normalizePrompts()` utilities
- `components/report-settings-page.tsx` — Confirmed current implementation with `packs` field bug
- `components/config-page.tsx` — Confirmed existing ConfigPage component for Sources tab import

### Secondary (MEDIUM confidence)
- CLAUDE.md — Project conventions for SWR, toast, skeleton, API response utilities
- 01-UI-SPEC.md — Confirmed shadcn/ui component inventory and design tokens
- 01-CONTEXT.md — All locked decisions and deferred ideas

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in codebase
- Architecture: HIGH — routing and component patterns verified against existing files
- Pitfalls: MEDIUM — field rename pitfall identified from code analysis; ConfigPage header handling is a new issue not seen in prior phases

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable project, no fast-moving dependencies in scope)
