# Codebase Structure

**Analysis Date:** 2026-03-30

## Directory Layout

```
information-aggregator/
├── app/                    # Next.js App Router (frontend + API routes)
├── components/             # React components
├── hooks/                  # Custom React hooks
├── lib/                    # Shared utilities and types
├── src/                    # Backend pipeline code
│   ├── adapters/           # Source adapters (RSS, JSON, website, X)
│   ├── ai/                 # AI client, providers, prompts
│   ├── archive/            # Content persistence to DB
│   ├── cache/              # In-memory caching
│   ├── config/             # Configuration loading, source ID generation
│   ├── diagnostics/        # Validation and testing framework
│   ├── pipeline/           # Collection pipeline stages
│   ├── reports/            # Daily/weekly report generation
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # Utilities (logger, date, social-post)
│   └── views/              # View registry
├── prisma/                 # Database schema and migrations
├── config/packs/           # Pack seed data (YAML)
├── scripts/                # Build/dev scripts
├── docs/                   # Documentation
├── .next-docs/             # Next.js documentation site
└── [config files]          # package.json, tsconfig.json, tailwind.config.ts, etc.
```

## Directory Purposes

### app/

**Purpose:** Next.js App Router directory containing pages and API routes

**Contains:**
- `layout.tsx` - Root layout with fonts and metadata
- `page.tsx` - Home page (routes to daily/weekly/config/x)
- `api/` - API route handlers (see API Routes section)
- `daily/page.tsx` - Daily report page
- `weekly/page.tsx` - Weekly report page
- `config/page.tsx` - Source configuration page
- `x/page.tsx` - X/Twitter feed page
- `settings/reports/page.tsx` - Report settings page

**Key files:**
- `app/layout.tsx`: Root layout with Sora font and LXGW WenKai Chinese font
- `app/page.tsx`: Home page with navigation routing

### app/api/

**Purpose:** API route handlers organized by resource

**Subdirectories:**
- `_lib/` - Shared API utilities (mappers, JSON utils, cron helpers)
- `content/` - Content CRUD endpoints
- `cron/` - Cron job triggers (collect, daily, weekly, X feeds)
- `daily/` - Daily report API
- `weekly/` - Weekly report API
- `sources/` - Source CRUD endpoints
- `topics/` - Topic endpoints
- `settings/` - Settings endpoints (reports config)
- `stats/` - Statistics endpoint
- `x-config/` - X/Twitter configuration
- `diagnostics/` - Preflight diagnostics
- `provider-configs/` - AI provider configurations

**Key files:**
- `app/api/_lib/mappers.ts` - Data transformation functions (toArticle, etc.)
- `app/api/_lib/json-utils.ts` - JSON utilities (safeJsonParse)
- `app/api/_lib.ts` - Cron route helpers (verifyCronRequest, runAfterJob)
- `app/api/cron/collect/route.ts` - Triggers collection pipeline

### components/

**Purpose:** React components organized by feature/module

**Subdirectories:**
- `ui/` - shadcn/ui base components (button, dialog, form, input, etc.)
- `sidebar/` - Sidebar navigation module
- `config/` - Configuration page components
- `daily-page.tsx` - Daily report display
- `weekly-page.tsx` - Weekly report display
- `article-card.tsx` - Article display card
- `tweet-card.tsx` - Tweet display card
- `app-layout.tsx` - App shell layout with sidebar
- `loading-skeletons.tsx` - Loading placeholder components
- `topbar.tsx` - Top navigation bar
- `reading-panel.tsx` - Content reading panel
- `scroll-progress.tsx` - Reading progress indicator
- `page-transition.tsx` - Page transition animations
- `theme-provider.tsx` - Theme context provider
- `report-settings-page.tsx` - Report settings UI
- `x-page.tsx` - X/Twitter page component
- `tweet-media-gallery.tsx` - Tweet media display

**Key files:**
- `components/sidebar.tsx` - Main sidebar with navigation
- `components/app-layout.tsx` - App shell wrapping pages
- `components/daily-page.tsx` - Daily report page component
- `components/weekly-page.tsx` - Weekly report page component
- `components/loading-skeletons.tsx` - Shared Skeleton components

### hooks/

**Purpose:** Custom React hooks for data fetching and UI state

**Contains:**
- `use-api.ts` - SWR-based data fetching hooks (usePacks, useCustomViews, useBookmarks, useDaily)
- `use-toast.ts` - Toast notification hook
- `use-mobile.ts` - Mobile detection hook
- `use-x-config.ts` - X/Twitter configuration hook

**Key patterns:**
- All data fetching uses SWR with `revalidateOnFocus: false, dedupingInterval: 5000`
- Never use `useState` + `useEffect` + `isMountedRef` pattern for data fetching

### lib/

**Purpose:** Shared utilities, types, and API client

**Contains:**
- `prisma.ts` - Prisma client singleton export
- `api-client.ts` - Typed fetch client for API calls
- `api-response.ts` - Shared API response helpers (success, error, parseBody, validateBody, timing)
- `date-utils.ts` - Date/timezone utilities (beijingDayRange, beijingWeekRange, utcWeekNumber)
- `format-date.ts` - Frontend date formatting (based on Intl.DateTimeFormat, zero dependencies)
- `types.ts` - Shared domain types (Article, Tweet, Content, DailyReportData, WeeklyReportData)
- `utils.ts` - General utilities
- `tweet-utils.ts` - Tweet-specific utilities

**Key files:**
- `lib/api-response.ts` - MUST be used by all API routes for consistency
- `lib/date-utils.ts` - All timezone handling uses UTC methods only
- `lib/types.ts` - Shared frontend/backend types

### src/adapters/

**Purpose:** Source adapters for fetching raw content from various sources

**Contains:**
- `rss.ts` - RSS feed collection
- `json-feed.ts` - JSON Feed collection
- `website.ts` - Website content extraction
- `x-bird.ts` - X/Twitter social feed collection
- `github-trending.ts` - GitHub Trending (excluded from pipeline)
- `feed-discovery.ts` - Auto-discover feeds from websites
- `registry.ts` - Adapter family registration system
- `build-adapters.ts` - Factory building adapter map

**Key files:**
- `src/adapters/build-adapters.ts` - Creates the adapter map used by pipeline
- `src/adapters/registry.ts` - Batch registration of adapters with shared auth

### src/ai/

**Purpose:** AI client abstraction, providers, and prompt engineering

**Subdirectories:**
- `providers/` - AI provider implementations
- `config/` - AI configuration schema and loading

**Contains:**
- `client.ts` - Main AI client entry point
- `types.ts` - AI-specific types
- `concurrency.ts` - Concurrent processing for AI operations
- `prompts.ts` - General prompts
- `prompts-filter.ts` - Content filtering prompts
- `prompts-enrichment.ts` - Enrichment prompts (key points, tags)
- `prompts-highlights.ts` - Highlights extraction prompts
- `prompts-reports.ts` - Report generation prompts (topic clustering, summaries, editorial)
- `prompts-daily-brief.ts` - Daily brief prompts
- `prompts-x-analysis.ts` - X/Twitter analysis prompts
- `utils.ts` - AI utilities

**Key files:**
- `src/ai/client.ts` - Exports createAiClient factory
- `src/ai/prompts-reports.ts` - All report-related prompt builders
- `src/ai/providers/index.ts` - Provider factory

### src/archive/

**Purpose:** Content persistence to PostgreSQL via Prisma

**Contains:**
- `index.ts` - Re-exports all archive functions
- `upsert-content-prisma.ts` - Main persistence functions

**Key functions:**
- `archiveContentItems()` - Upsert Content records
- `syncTopicsToPrisma()` - Sync Topic records
- `upsertSourcesBatch()` - Batch upsert Source records
- `recordSourcesSuccessBatch()` - Update SourceHealth on success
- `recordSourceFailure()` - Update SourceHealth on failure
- `getArchiveStats()` - Get content statistics

### src/cache/

**Purpose:** In-memory caching for content deduplication

**Contains:**
- `content-cache.ts` - Content deduplication cache
- `unified-cache.ts` - Unified caching interface

### src/config/

**Purpose:** Configuration loading and source ID generation

**Contains:**
- `source-id.ts` - Generate stable source IDs from URLs (hash-based)
- `load-pack-prisma.ts` - Load topics/packs from Prisma with sources
- `load-auth.ts` - Auth configuration loading with mergeAuthConfig

### src/diagnostics/

**Purpose:** Validation and testing framework for collection and reports

**Subdirectories:**
- `runners/` - Test runners
- `collection/` - Collection validation tests
- `reports/` - Report validation tests
- `core/` - Shared utilities

**Key files:**
- `src/diagnostics/runners/full.test.ts` - Full E2E test runner
- `src/diagnostics/collection/health.ts` - Health check tests
- `src/diagnostics/reports/verify-daily.test.ts` - Daily report verification

### src/pipeline/

**Purpose:** Content collection pipeline stages

**Contains:**
- `collect.ts` - Source collection with concurrency control
- `normalize.ts` - Item normalization (text, URL)
- `normalize-url.ts` - URL normalization
- `normalize-text.ts` - Text normalization
- `filter-by-topic.ts` - Topic classification and scoring
- `filter-by-pack.ts` - Legacy pack filtering (deprecated)
- `dedupe-exact.ts` - Exact deduplication
- `dedupe-near.ts` - Near-duplicate detection
- `enrich.ts` - AI content enrichment
- `rank.ts` - Content ranking
- `extract-content.ts` - HTML content extraction
- `run-collect-job.ts` - Main orchestrator combining all stages

**Key files:**
- `src/pipeline/run-collect-job.ts` - Full pipeline orchestration
- `src/pipeline/collect.ts` - Collection with adapter dispatch

### src/reports/

**Purpose:** Daily and weekly report generation

**Subdirectories:**
- `scoring/` - Runtime candidate scoring pipeline

**Contains:**
- `daily.ts` - Daily report pipeline
- `weekly.ts` - Weekly report pipeline
- `report-candidate.ts` - Content to ReportCandidate mapping

**Key files:**
- `src/reports/daily.ts` - Daily report generation with AI clustering
- `src/reports/weekly.ts` - Weekly report generation with editorial

### src/types/

**Purpose:** Shared TypeScript types for the backend pipeline

**Contains:**
- `index.ts` - Main type exports (RawItem, NormalizedItem, Content, ReportCandidate, Source, Topic, etc.)
- `ai-response.ts` - AI response types
- `validation.ts` - Validation types

### src/utils/

**Purpose:** General utilities

**Contains:**
- `logger.ts` - Structured logging
- `date-utils.ts` - Additional date utilities
- `metadata.ts` - RawItem metadata parsing
- `social-post.ts` - Social post utilities

### src/views/

**Purpose:** View registry for pack-based content grouping

**Contains:**
- `registry.ts` - View registry

### prisma/

**Purpose:** Database schema and migrations

**Contains:**
- `schema.prisma` - Full database schema with all models
- `migrations/` - Migration history

**Key models:**
- `Content` - Unified content model
- `Topic` - Topic definitions
- `Source` - Source definitions
- `SourceHealth` - Source health tracking
- `DailyOverview` - Daily report overviews
- `DigestTopic` - Topics within daily reports
- `DailyReportConfig` - Daily report settings
- `WeeklyReport` - Weekly reports
- `WeeklyPick` - Weekly selected content
- `WeeklyReportConfig` - Weekly report settings
- `XPageConfig` - X/Twitter page settings

### config/packs/

**Purpose:** Pack seed data in YAML format

**Contains:**
- `tech-news.yaml` - Tech news pack configuration
- `karpathy-picks.yaml` - Karpathy picks pack configuration

### scripts/

**Purpose:** Development and diagnostic scripts

**Contains:**
- `diagnostics.ts` - E2E validation script (full, reports, collection modes)

## Key File Locations

### Entry Points

**Frontend:**
- `app/layout.tsx`: Root layout
- `app/page.tsx`: Home page (entry point)

**API:**
- `app/api/cron/collect/route.ts`: Collection trigger
- `app/api/cron/daily/route.ts`: Daily report trigger
- `app/api/cron/weekly/route.ts`: Weekly report trigger

**Pipeline:**
- `src/pipeline/run-collect-job.ts`: Main pipeline orchestrator

**Reports:**
- `src/reports/daily.ts`: Daily report generation
- `src/reports/weekly.ts`: Weekly report generation

### Configuration

- `prisma/schema.prisma`: Database schema
- `config/packs/*.yaml`: Pack seed data
- `src/config/source-id.ts`: Source ID generation
- `src/config/load-pack-prisma.ts`: Pack loading from DB

### API Response Utilities

- `lib/api-response.ts`: **MUST be used** by all API routes

### Data Fetching

- `hooks/use-api.ts`: SWR hooks for all data types

## Naming Conventions

### Files

- **TypeScript source:** `kebab-case.ts` (e.g., `normalize-url.ts`, `use-api.ts`)
- **React components:** `PascalCase.tsx` (e.g., `DailyPage.tsx`, `ArticleCard.tsx`)
- **Config files:** `kebab-case.config.ts` or `camelCase.config.ts`
- **Test files:** `*.test.ts` or `*.spec.ts`
- **YAML packs:** `kebab-case.yaml`

### Directories

- **Next.js directories:** `app/`, `components/`, `hooks/`, `lib/`
- **Backend modules:** `src/adapters/`, `src/ai/`, `src/pipeline/`, `src/reports/`
- **Feature modules:** `src/config/`, `src/cache/`, `src/diagnostics/`

### Variables and Functions

- **Functions:** `camelCase` (e.g., `collectSources`, `generateDailyReport`)
- **Types/Interfaces:** `PascalCase` (e.g., `RawItem`, `ReportCandidate`, `ContentKind`)
- **Constants:** `SCREAMING_SNAKE_CASE` for module-level constants
- **Enums:** `PascalCase` with `SCREAMING_SNAKE_CASE` values

## Where to Add New Code

### New Feature/Module

1. **Determine the appropriate location based on the module type:**

| Module Type | Location |
|------------|----------|
| API route | `app/api/{resource}/route.ts` |
| React component | `components/{feature}/` |
| Custom hook | `hooks/` |
| Shared utility | `lib/` |
| Pipeline stage | `src/pipeline/` |
| Adapter | `src/adapters/` |
| AI prompt | `src/ai/prompts-{feature}.ts` |
| Report type | `src/reports/` |

2. **Add test file alongside:**
   ```
   src/pipeline/new-feature.ts
   src/pipeline/new-feature.test.ts
   ```

3. **Update the orchestrator if needed:**
   - Pipeline stages: update `src/pipeline/run-collect-job.ts`
   - API routes: add to `app/api/` directory

### New API Route

1. Create `app/api/{resource}/route.ts`
2. Use shared utilities from `lib/api-response.ts`:
   ```typescript
   import { success, error, parseBody, validateBody, timing, handlePrismaError } from "@/lib/api-response"
   ```
3. Follow existing patterns in `app/api/_lib/` for mappers and JSON utils

### New React Component

1. **Small, single-purpose component:** Put in `components/` root or appropriate subdirectory
2. **Large, multi-file module:** Create `components/{feature}/` subdirectory:
   ```
   components/{feature}/
   ├── types.ts
   ├── {sub-component}.tsx
   └── index.tsx
   ```

### New Pipeline Stage

1. Create `src/pipeline/{stage-name}.ts`
2. Add test `src/pipeline/{stage-name}.test.ts`
3. Integrate in `src/pipeline/run-collect-job.ts`
4. Export types from `src/types/index.ts` if shared

### New AI Prompt

1. Add to existing `src/ai/prompts-*.ts` file or create new `src/ai/prompts-{feature}.ts`
2. Include `build*Prompt()` and `parse*Result()` functions
3. Add types to `src/ai/types.ts`

## Special Directories

### .next-docs/

**Purpose:** Next.js official documentation site content

**Generated:** Yes (by Next.js)
**Committed:** Yes
**Contents:** Markdown documentation files

### .planning/

**Purpose:** GSD planning documents (this directory)

**Generated:** By GSD commands
**Committed:** Yes (but `.planning/codebase/` is new, check gitignore)

### .superpowers/

**Purpose:** Unknown/miscellaneous

**Generated:** Unknown
**Committed:** Yes

### node_modules/

**Purpose:** npm/pnpm dependencies

**Generated:** By package manager
**Committed:** No (gitignored)

### .next/

**Purpose:** Next.js build output

**Generated:** Yes
**Committed:** No (gitignored)

---

*Structure analysis: 2026-03-30*
