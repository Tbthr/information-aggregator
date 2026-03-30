# Technology Stack: Settings Pages

**Project:** Frontend Settings Consolidation
**Researched:** 2026-03-30

---

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js 16 App Router | 16.x | Page routing, layouts | Project standard, Server Components support |
| React 19 | 19.x | UI framework | Project standard |
| TypeScript | 5.x | Type safety | Required per project standards |

### UI Components
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | latest | Component library | Already in use, accessible, customizable |
| `@radix-ui/react-tabs` | via shadcn | Tab navigation | Already in `components/ui/tabs.tsx`, accessible |

### Data Fetching
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SWR | 2.x | Client-side data fetching | Project standard, already in `hooks/use-api.ts` |
| fetch API | native | API calls | Already in use |

### Form Handling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zod | 3.x | Runtime validation | Already in API routes, used in `app/api/settings/reports/route.ts` |
| Native React state | useState | Local form state | Simple forms, no heavy state management needed |

### Styling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 3.x | Utility CSS | Project standard |
| CSS variables | native | Theme tokens | Via shadcn/ui design tokens |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Tab navigation | shadcn/ui Tabs | Custom implementation | Radix-based, accessible, already in codebase |
| Form validation | Zod | React Hook Form | Zod already in use for API validation; overhead not justified for settings forms |
| State management | React useState | Redux/Zustand | Settings are page-local, simple state is sufficient |
| Settings layout | Tabs (single page) | Separate routes | Keeps related settings together; easier to discover |

---

## Installation

No new packages required. All needed components are already in the project:

```bash
# Existing components used
ls components/ui/tabs.tsx      # Tab navigation (Radix-based)
ls components/ui/card.tsx      # Card container
ls components/ui/checkbox.tsx  # Topic selection
ls components/ui/badge.tsx     # Tags display
ls components/ui/input.tsx     # Form inputs
ls components/ui/textarea.tsx  # Prompt editing
ls components/ui/label.tsx     # Field labels
ls components/ui/button.tsx    # Actions
```

---

## Source Code References

| Component | Path | Purpose |
|-----------|------|---------|
| Tabs | `components/ui/tabs.tsx` | Tab navigation pattern |
| ReportSettingsPage | `components/report-settings-page.tsx` | Daily/Weekly config (needs fix) |
| ConfigPage | `components/config-page.tsx` | Source/Topic management |
| TopicListPanel | `components/config/topic-list-panel.tsx` | List-detail pattern |
| TopicDetailPanel | `components/config/topic-detail-panel.tsx` | Topic editing |
| use-api | `hooks/use-api.ts` | SWR hooks for data fetching |
| Settings API | `app/api/settings/reports/route.ts` | Report config API (uses topicIds) |
