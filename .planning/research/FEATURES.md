# Feature Landscape: Settings Pages

**Domain:** Information Aggregator Settings Pages
**Researched:** 2026-03-30

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Current State | Complexity | Notes |
|---------|--------------|---------------|------------|-------|
| Report configuration (daily/weekly) | Core value proposition | Implemented but has bug (`packs` vs `topicIds`) | Low | Fix field names |
| Source management | Content originates from sources | Fully implemented in ConfigPage | Low | Working correctly |
| Topic management | Categorization system | Fully implemented in ConfigPage | Low | Working correctly |
| AI prompt configuration | Customize report style | Implemented with PromptField component | Low | Expandable textarea, good UX |
| Topic selection for daily reports | Scope which topics appear in daily | Buggy: uses `packs` name, correct API uses `topicIds` | Low | Easy fix |
| Numeric settings (maxItems, minScore, etc.) | Control report scope | Implemented with NumberField component | Low | Good UX with min/max validation |

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Current State | Complexity | Notes |
|---------|-------------------|---------------|------------|-------|
| Tab-based settings consolidation | All config in one discoverable location | Not implemented; two separate pages | Low | Recommendation: single `/settings` page with tabs |
| Visual source health indicators | Quickly see which sources are working | Partially implemented in TopicListPanel (colored dots) | Low | Expand to show last success/failure |
| Preview estimated content count | Validate topic selection before saving | Not implemented | Medium | Requires API enhancement |
| Per-topic prompt customization | Different tones for different topics | Not implemented; global prompts only | High | Would require significant refactoring |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Deeply nested settings pages | Creates maze-like navigation, URL bloat | Flat structure with tabs: `/settings?tab=reports` |
| Per-source AI prompts | Adds configuration complexity, marginal value | Use global prompts with topic-level overrides (future) |
| Real-time settings preview | Complex to implement, may encourage over-configuration | Keep save-and-run workflow |
| Settings import/export | Adds attack surface, rarely used | Document current config via API for debugging |

---

## Feature Dependencies

```
[Source Configuration]
         │
         ├── Source has defaultTopicIds[]
         │
         ▼
[Topic Configuration]
         │
         ├── Topic has includeRules, excludeRules, scoreBoost
         │
         ▼
[DailyReportConfig.topicIds] ──filters──> [Content to include in daily]
         │
         ▼
[Report Settings]
         ├── maxItems, minScore, keywordBlacklist
         ├── AI prompts (filterPrompt, topicPrompt, topicSummaryPrompt)
         └── kindPreferences (article vs tweet weighting)
```

### Dependency Notes

- `DailyReportConfig.topicIds[]` must reference existing `Topic.id` values
- `Source.defaultTopicIds[]` determines which topics a source's content belongs to
- Content filtering uses OR logic across topicIds (any match = included)

---

## MVP Recommendation

**Phase 1: Fix the Bug**
- Correct `packs` → `topicIds` in ReportSettingsPage
- Update labels from "数据源 Pack" to "选择 Topics"
- Verify API contract matches frontend state

**Phase 2: Navigation Clarity**
- Option A: Single `/settings` page with tabs
- Option B: Keep separate pages, improve sidebar labels

**Phase 3 (defer):**
- Visual source health status in list
- Preview estimated content count before saving
- Per-topic maxItems override

---

## Sources

- Codebase analysis of `components/report-settings-page.tsx`, `components/config-page.tsx`
- API analysis of `app/api/settings/reports/route.ts`
- Prisma schema analysis of `prisma/schema.prisma`
- shadcn/ui component library for available patterns
