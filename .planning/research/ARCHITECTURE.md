# Architecture Patterns: Settings Organization

**Domain:** Information Aggregator Settings Pages
**Project:** Frontend Settings Consolidation
**Researched:** 2026-03-30
**Confidence:** MEDIUM

---

## Executive Summary

The current architecture has two separate settings pages (`/settings/reports` and `/config`) with a critical mismatch: `ReportSettingsPage` uses a `packs` field (deprecated concept) while the backend API uses `topicIds`. The `ConfigPage` already correctly implements the `Source` + `Topic` pattern via a list-detail panel.

Three architectural decisions are needed:
1. **Settings consolidation** — Tab-based vs. separate pages
2. **Data model alignment** — Fix `packs` → `topicIds` in ReportSettingsPage
3. **Navigation structure** — Flat vs. hierarchical settings organization

---

## Current Architecture Analysis

### Problem: ReportSettingsPage Has Deprecated Field Names

```typescript
// components/report-settings-page.tsx - CURRENT (WRONG)
interface DailyConfig {
  packs: string[]  // WRONG: Pack is deprecated, should be topicIds
  maxItems: number
  minScore: number
  keywordBlacklist: string[]
  filterPrompt: string
  topicPrompt: string
  topicSummaryPrompt: string
  kindPreferences?: { ... } | null
}
```

But the API (`app/api/settings/reports/route.ts`) uses:
- `DailyReportConfig.topicIds[]` — not `packs`
- `DailyReportConfig.kindPreferences` — stored as JSON string

And `useTopics()` fetches from `/api/topics` which returns `Topic[]` objects.

**The frontend is fetching topics but calling them packs.**

### Correct Data Model

```
DailyReportConfig.topicIds[]  →  References Topic IDs to include in daily reports
Source.defaultTopicIds[]      →  Default topics for a source
Topic                         →  Category with includeRules, excludeRules, scoreBoost
```

---

## Settings Navigation Patterns

### Pattern 1: Tab-Based (RECOMMENDED for this project)

**Structure:**
```
/settings
├── Tab: "报告设置"     (Daily/Weekly config)
└── Tab: "数据源"       (Source/Topic management)
```

**When to use:**
- Related but independent setting categories
- Users need to switch between categories during a session
- Equal visual weight between categories

**Example in codebase:** shadcn/ui `Tabs` component already exists at `components/ui/tabs.tsx`

### Pattern 2: Separate Pages (CURRENT)

**Structure:**
```
/settings/reports   (Report config only)
/config             (Source/Topic management)
```

**When to use:**
- Settings have very different complexity levels
- Deep linking to specific settings is needed
- Settings belong to different user workflows

**Problem:** These two pages are conceptually coupled (both configure data collection behavior) but navigation is separated.

### Pattern 3: Drawer/Sheet

**Structure:** Settings appear as overlay panel alongside main content

**When to use:**
- Contextual settings (per-item configuration)
- Settings don't require full-page focus
- Maintaining context is important

**Example in codebase:** `components/ui/sheet.tsx` exists but is not currently used for settings

---

## Recommended Architecture

### Option A: Consolidated Settings Page (RECOMMENDED)

**Single page at `/settings` with two tabs:**

```tsx
// app/settings/page.tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ReportSettingsPage } from "@/components/report-settings-page"
import { ConfigPage } from "@/components/config-page"

export default function SettingsPage() {
  return (
    <AppLayout activeNav="settings">
      <Tabs defaultValue="reports" className="h-full">
        <TabsList>
          <TabsTrigger value="reports">报告设置</TabsTrigger>
          <TabsTrigger value="sources">数据源配置</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <ReportSettingsPage />
        </TabsContent>
        <TabsContent value="sources">
          <ConfigPage />
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
```

**Pros:**
- Conceptually coupled settings are together
- Easy to switch between report config and source management
- Uses existing components
- Single navigation entry point

**Cons:**
- Longer page load (both tabs render)
- TabsContent unmounts by default; may need `keepAlive` if state matters

### Option B: Keep Separate Pages, Fix Field Names

Keep `/settings/reports` and `/config` as separate pages, but:
1. Fix `packs` → `topicIds` in `ReportSettingsPage`
2. Rename sidebar entry from "设置" to "数据源配置" for clarity
3. Consider adding breadcrumb or parent indicator

**Pros:**
- Minimal change to existing structure
- Each page can be optimized independently

**Cons:**
- Navigation coupling is not obvious to users
- Users may not discover related settings

---

## Pack → Source/Topic Migration Fix

### Current State

`ReportSettingsPage` shows a "数据源 Pack" selection using `useTopics()`:

```tsx
// CURRENT - Wrong field name and label
<div className="space-y-2">
  <Label className="text-sm font-medium">数据源 Pack</Label>
  {packs && packs.length > 0 ? (
    <div className="grid grid-cols-2 gap-2">
      {packs.map((pack) => (
        <Checkbox checked={daily.packs.includes(pack.id)} />
      ))}
    </div>
  )}
</div>
```

### Corrected Implementation

```tsx
// CORRECTED - Topic selection for daily report
<div className="space-y-2">
  <Label className="text-sm font-medium">选择 Topics</Label>
  <p className="text-xs text-muted-foreground">
    选择用于日报数据收集的 Topic（不选则使用所有 Topic）
  </p>
  {topics && topics.length > 0 ? (
    <div className="grid grid-cols-2 gap-2">
      {topics.map((topic) => (
        <label key={topic.id} className="flex items-center gap-2 ...">
          <Checkbox
            checked={daily.topicIds.includes(topic.id)}
            onCheckedChange={() => toggleTopic(topic.id)}
          />
          <span>{topic.name}</span>
        </label>
      ))}
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">暂无可用 Topic</p>
  )}
</div>
```

### Key Changes:
1. `DailyConfig.packs` → `DailyConfig.topicIds`
2. `togglePack(packId)` → `toggleTopic(topicId)`
3. Label "数据源 Pack" → "选择 Topics"
4. Help text update

---

## Component Architecture

### Recommended File Structure

```
app/settings/
├── page.tsx              # Main settings page with tabs
├── reports/
│   └── page.tsx          # Redirect to /settings or remove
└── sources/
    └── page.tsx          # Redirect to /settings or remove

components/
├── settings-tabs.tsx     # Shared tab container
├── report-settings-page.tsx  # Daily/Weekly config (fixed field names)
└── config-page.tsx        # Source/Topic management (already correct)
```

### Cross-Cutting Concerns

| Concern | Solution |
|---------|----------|
| State preservation between tabs | Use `Tabs` with default state management; or URL param `?tab=reports` |
| Shared navigation highlight | `activeNav="settings"` parent, children manage sub-state |
| Consistent layout | Both tabs use same `max-w-3xl mx-auto px-6 py-8` wrapper |

---

## Scalability Considerations

| Scale | Pattern | Implementation |
|-------|---------|----------------|
| 2-3 setting categories | Tabs | Simple, works well |
| 4+ categories | Separate pages with grouped nav | Consider collapsible sections in sidebar |
| Very complex (50+ fields) | Wizard/stepped flow | Per-field validation, progress indicator |

Current state: 2 categories (reports, sources) — tabs are appropriate.

---

## Anti-Patterns to Avoid

### 1. Deep Nesting
**Bad:** `/settings/reports/daily/ai-prompts/topic-clustering`
**Why:** Navigation becomes a maze, URL structure implies hierarchy that doesn't exist
**Instead:** Flat structure with tabs: `/settings?tab=reports`

### 2. Inconsistent Navigation Location
**Bad:** Report prompts on `/settings/reports`, Source config on `/config`
**Why:** Users must remember which settings lives where
**Instead:** Consolidated `/settings` with clear tabs

### 3. Mixing Configuration Levels
**Bad:** Global settings + per-source settings on same page without grouping
**Why:** Cognitive load increases when scope is unclear
**Instead:** Clear visual grouping (Card components with headers)

### 4. Immediate Form Submission
**Bad:** Every field change triggers API call
**Why:** Race conditions, wasted API calls, poor UX on slow connections
**Instead:** Explicit "Save" button with loading state (current implementation is correct)

---

## Implementation Priority

### Phase 1: Fix Critical Bug (HIGH)
Fix `packs` → `topicIds` in `ReportSettingsPage`:
1. Update `DailyConfig` interface
2. Update `togglePack` → `toggleTopic`
3. Update field labels and help text
4. Verify API contract matches

### Phase 2: Settings Consolidation (MEDIUM)
Option A or B based on user feedback:
- **A:** Consolidate to single `/settings` page with tabs
- **B:** Keep separate but improve navigation clarity

### Phase 3: Enhanced UX (LOW)
- Add "reset to defaults" per section
- Add field-level validation feedback
- Consider keyboard navigation for power users

---

## Sources

| Source | Confidence | Notes |
|--------|------------|-------|
| Current codebase analysis | HIGH | Direct observation of working code |
| shadcn/ui Tabs component | HIGH | `components/ui/tabs.tsx` — Radix-based, accessible |
| Prisma schema | HIGH | `prisma/schema.prisma` — Source/Topic models |
| API route implementation | HIGH | `app/api/settings/reports/route.ts` — topicIds field |

**Research gaps:** Limited external UX research due to search API unavailability. Recommendations based on established patterns from training data and codebase analysis.
