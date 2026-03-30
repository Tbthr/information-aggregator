# Architecture

**Analysis Date:** 2026-03-30

## Pattern Overview

**Overall:** Next.js 16 App Router frontend with a backend pipeline architecture centered on content collection, enrichment, and report generation.

**Key Characteristics:**
- **Frontend:** Next.js 16 with React 19, App Router, Tailwind CSS, shadcn/ui components
- **Backend Pipeline:** Modular stage-based pipeline (adapters -> normalize -> filter -> dedupe -> persist)
- **Database:** PostgreSQL via Prisma ORM, Supabase hosting
- **AI Integration:** Multi-provider AI client (Anthropic, OpenAI, Gemini) for content enrichment and report generation
- **Package Manager:** pnpm

## Layers

### Frontend (app/, components/, hooks/)

**Purpose:** User interface and data fetching

**Location:** `/app`, `/components`, `/hooks`

**Contains:**
- `app/page.tsx` - Home page routing to daily/weekly/config/x
- `app/api/*` - API routes for content, sources, topics, settings, cron jobs, diagnostics
- `components/` - React components organized by feature (sidebar, config, daily-page, weekly-page, tweet-card, article-card)
- `hooks/` - Custom hooks (use-api.ts for SWR data fetching, use-toast.ts for notifications)

**Depends on:** `/lib` for utilities and API client
**Used by:** Browser/client

### Adapters Layer (src/adapters/)

**Purpose:** Fetch raw content from various source types (RSS, JSON Feed, websites, X/Twitter)

**Location:** `src/adapters/`

**Contains:**
- `rss.ts` - RSS feed parsing
- `json-feed.ts` - JSON Feed format support
- `website.ts` - Generic website content extraction
- `x-bird.ts` - X/Twitter social feed collection
- `github-trending.ts` - GitHub Trending (intentionally excluded from collection pipeline per `UNSUPPORTED_SOURCE_KDS`)
- `registry.ts` - Adapter family registration system for batch registration of adapters with shared auth config
- `build-adapters.ts` - Factory that builds the adapter map used by the collection pipeline

**Depends on:** Source definitions (SourceKind, InlineSource)
**Used by:** `src/pipeline/collect.ts` during collection stage

### Pipeline Layer (src/pipeline/)

**Purpose:** Orchestrate the content collection lifecycle from source fetching to normalization

**Location:** `src/pipeline/`

**Contains:**
- `collect.ts` - Source collection with optional concurrency control, event reporting per source
- `normalize.ts` - Normalize raw items (URL canonicalization, text normalization)
- `normalize-url.ts` - URL normalization and deduplication key generation
- `normalize-text.ts` - Text normalization utilities
- `filter-by-topic.ts` - Classify items against topics using include/exclude rules, score items by topic
- `filter-by-pack.ts` - Legacy pack-based filtering (deprecated, topic-centric model is current)
- `dedupe-exact.ts` - Exact URL deduplication using normalized URL as key
- `dedupe-near.ts` - Near-duplicate detection using text similarity
- `enrich.ts` - AI content enrichment (extraction, key points, tagging) - called separately from collect pipeline
- `rank.ts` - Ranking/scoring of content candidates
- `extract-content.ts` - HTML content extraction from URLs
- `run-collect-job.ts` - **Main orchestrator** combining all pipeline stages

**Depends on:** Adapters, Archive, AI client
**Used by:** `app/api/cron/collect/route.ts` and diagnostics framework

**Pipeline Order (via runCollectJob):**
1. Load packs/topics from DB
2. Sync sources to DB
3. Collect from sources (parallel with concurrency control)
4. Normalize items
5. Filter by topic classification
6. Exact deduplication
7. Near deduplication
8. Archive to Content table

### Archive Layer (src/archive/)

**Purpose:** Persist collected content to PostgreSQL via Prisma

**Location:** `src/archive/`

**Contains:**
- `upsert-content-prisma.ts` - Main persistence functions (archiveContentItems, syncTopicsToPrisma, upsertSourcesBatch, recordSourcesSuccessBatch, recordSourceFailure)
- `index.ts` - Re-exports all archive functions

**Depends on:** Prisma client, pipeline output
**Used by:** `src/pipeline/run-collect-job.ts`

### AI Layer (src/ai/)

**Purpose:** AI provider abstraction, prompt engineering for enrichment and reports

**Location:** `src/ai/`

**Contains:**
- `client.ts` - Entry point exporting all AI types and factory functions
- `providers/` - Provider implementations:
  - `base.ts` - Base provider interface
  - `anthropic.ts` - Anthropic Claude client
  - `openai.ts` - OpenAI GPT client
  - `gemini.ts` - Google Gemini client
  - `fallback.ts` - Fallback chain logic
  - `index.ts` - Factory function createAiClient
- `prompts.ts` - General prompts
- `prompts-filter.ts` - AI content filtering prompts
- `prompts-enrichment.ts` - AI enrichment prompts (key points, tags)
- `prompts-highlights.ts` - Highlights extraction prompts
- `prompts-reports.ts` - Daily/weekly report prompts (topic clustering, summaries, editorial, pick reasons)
- `prompts-daily-brief.ts` - Daily brief prompts
- `prompts-x-analysis.ts` - X/Twitter analysis prompts
- `concurrency.ts` - Concurrent processing utilities for AI operations
- `config/schema.ts` - AI configuration schema
- `config/load.ts` - AI config loading with caching
- `types.ts` - AI-specific types (AiClient, TopicSuggestion, ArticleEnrichResult, etc.)

**Depends on:** Third-party AI APIs (Anthropic, OpenAI, Gemini)
**Used by:** `src/pipeline/enrich.ts`, `src/reports/daily.ts`, `src/reports/weekly.ts`

### Reports Layer (src/reports/)

**Purpose:** Daily and weekly report generation using AI

**Location:** `src/reports/`

**Contains:**
- `daily.ts` - Daily report pipeline:
  1. Collect Content from DB (Beijing day range)
  2. Filter by topic/blacklist
  3. Map to ReportCandidate[]
  4. Score candidates (base -> signals -> merge -> history penalty)
  5. Trim to top N
  6. Optional AI pre-filter
  7. AI topic clustering + summary generation
  8. Persist to DailyOverview/DigestTopic
- `weekly.ts` - Weekly report pipeline:
  1. Collect DailyOverview records for the week
  2. Extract content IDs from DigestTopic.contentIds
  3. AI editorial generation
  4. AI weekly picks with reasons
  5. Persist to WeeklyReport/WeeklyPick
- `report-candidate.ts` - Content to ReportCandidate mapping
- `scoring/` - Runtime candidate scoring:
  - `index.ts` - Scoring pipeline orchestration
  - `base-stage.ts` - Kind preference base scoring
  - `item-score-adapter.ts` - Article/item signal scoring
  - `tweet-score-adapter.ts` - Tweet signal scoring
  - `merge-stage.ts` - Combine signals into runtimeScore
  - `history-penalty-stage.ts` - Penalize recently seen items
  - `types.ts` - Scoring types

**Depends on:** AI client, Prisma, Content table
**Used by:** `app/api/cron/daily/route.ts`, `app/api/cron/weekly/route.ts`

### Configuration Layer (src/config/, config/packs/)

**Purpose:** Pack/topic configuration management and source ID generation

**Location:** `src/config/`, `config/packs/`

**Contains:**
- `src/config/source-id.ts` - Generate stable source IDs from URLs
- `src/config/load-pack-prisma.ts` - Load topics/packs from Prisma with sources
- `src/config/load-auth.ts` - Auth configuration loading
- `config/packs/*.yaml` - Seed data YAML files (tech-news.yaml, karpathy-picks.yaml)

**Depends on:** Prisma, YAML loader
**Used by:** Pipeline stages for pack/source resolution

### Cache Layer (src/cache/)

**Purpose:** In-memory caching for content and unified cache

**Location:** `src/cache/`

**Contains:**
- `content-cache.ts` - Content deduplication cache
- `unified-cache.ts` - Unified caching interface

**Used by:** Pipeline stages for deduplication

### Diagnostics Layer (src/diagnostics/)

**Purpose:** Validation and testing framework for collection and reports

**Location:** `src/diagnostics/`

**Contains:**
- `runners/` - Test runners (collection, reports, full)
- `collection/` - Collection validation (health, inventory, run-collection)
- `reports/` - Report validation (config, verify-daily, verify-weekly)
- `core/` - Shared utilities (guards, result formatting)

**Used by:** `scripts/diagnostics.ts` for E2E validation

### Shared Library (lib/)

**Purpose:** Frontend and backend utilities

**Location:** `lib/`

**Contains:**
- `prisma.ts` - Prisma client singleton
- `api-client.ts` - Typed fetch client for API calls
- `api-response.ts` - Shared API response utilities (success, error, parseBody, validateBody, timing helpers)
- `date-utils.ts` - Date/timezone utilities (beijingDayRange, beijingWeekRange, utcWeekNumber, formatUtcDate)
- `format-date.ts` - Frontend date formatting using Intl.DateTimeFormat
- `types.ts` - Shared domain types (Article, Tweet, Content, DailyReportData, WeeklyReportData)
- `utils.ts` - General utilities
- `tweet-utils.ts` - Tweet-specific utilities

**Depends on:** Nothing (standalone)
**Used by:** All layers

### Database (prisma/)

**Purpose:** Data persistence schema and migrations

**Location:** `prisma/schema.prisma`

**Models:**
- `Content` - Unified content model (replaced legacy Item/Tweet models)
- `Topic` - Topic definitions with include/exclude rules
- `Source` - Source definitions with kind, url, priority, defaultTopicIds
- `SourceHealth` - Source health tracking (last success/failure, consecutive failures)
- `DailyOverview` - Daily report overview with topic count
- `DigestTopic` - Topic within daily report (contains contentIds array)
- `DailyReportConfig` - Daily report configuration (topicIds, maxItems, minScore, prompts)
- `WeeklyReport` - Weekly report with editorial
- `WeeklyPick` - Weekly selected content with reason
- `WeeklyReportConfig` - Weekly report configuration (days, pickCount, editorialPrompt, pickReasonPrompt)
- `XPageConfig` - X/Twitter page configuration

## Data Flow

### Collection Pipeline

```
User/Scheduler triggers POST /api/cron/collect
    |
    v
runCollectJob() [src/pipeline/run-collect-job.ts]
    |
    +-- loadAllTopicsFromDb() --> Topic[] with sources
    |
    +-- syncTopicsToPrisma() --> upsert Topic records
    |
    +-- upsertSourcesBatch() --> upsert Source records
    |
    +-- resolveSourcesForCollection() --> filter unsupported types
    |
    +-- collectSources() [src/pipeline/collect.ts]
    |       |
    |       +-- For each source: adapter(source) --> RawItem[]
    |       |   Adapters: rss, json-feed, website, x
    |       |
    |       +-- normalizeCollectedItem() --> enrich metadata
    |
    +-- normalizeItems() [src/pipeline/normalize.ts]
    |       |
    |       +-- normalizeUrl() --> canonical URL
    |       +-- normalizeText() --> cleaned title/content
    |
    +-- classifyItemTopics() [src/pipeline/filter-by-topic.ts]
    |       |
    |       +-- Match against topic include/exclude rules
    |
    +-- dedupeExact() [src/pipeline/dedupe-exact.ts]
    |       |
    |       +-- URL-based deduplication
    |
    +-- dedupeNear() [src/pipeline/dedupe-near.ts]
    |       |
    |       +-- Text similarity deduplication
    |
    +-- archiveContentItems() [src/archive/upsert-content-prisma.ts]
    |       |
    |       +-- upsert Content records (new + updated)
    |
    +-- recordSourcesSuccessBatch() / recordSourceFailure()
            |
            +-- Update SourceHealth records
```

### Daily Report Pipeline

```
Scheduler triggers POST /api/cron/daily
    |
    v
generateDailyReport() [src/reports/daily.ts]
    |
    +-- collectData() --> Content[] for Beijing day range
    |
    +-- filterContent() --> topicIds + blacklist filtering
    |
    +-- collectCandidates() --> ReportCandidate[]
    |
    +-- scoreCandidates() [src/reports/scoring/]
    |       |
    |       +-- applyBaseStage() --> kind preferences
    |       +-- applyTweetSignalScoring() / applyItemSignalScoring() --> signals
    |       +-- applyMergeStage() --> runtimeScore
    |       +-- applyHistoryPenaltyStage() --> finalScore
    |
    +-- trimTopN() --> top N by finalScore
    |
    +-- aiFilter() [optional] --> AI pre-filter with filterPrompt
    |
    +-- topicClustering() [src/ai/prompts-reports.ts]
    |       |
    |       +-- buildTopicClusteringPrompt() --> AI clustering
    |       +-- parseTopicClusteringResult()
    |
    +-- generateTopicSummaries() [parallel]
    |       |
    |       +-- buildTopicSummaryPrompt() --> per-topic AI summary
    |
    +-- persistResults()
            |
            +-- upsert DailyOverview + DigestTopic records
```

### Weekly Report Pipeline

```
Scheduler triggers POST /api/cron/weekly
    |
    v
generateWeeklyReport() [src/reports/weekly.ts]
    |
    +-- collectData() --> DailyOverview[] for week
    |       |
    |       +-- Extract contentIds from DigestTopic.contentIds
    |       +-- Fetch Content records for enrichment
    |
    +-- generateEditorial()
    |       |
    |       +-- buildEditorialPrompt() --> AI editorial generation
    |
    +-- generateWeeklyPicks()
    |       |
    |       +-- For each content: buildPickReasonPrompt() --> AI reason
    |
    +-- persistResults()
            |
            +-- upsert WeeklyReport + WeeklyPick records
```

## Key Abstractions

### RawItem

**Purpose:** Initial standardized item from any adapter

**Location:** `src/types/index.ts`

**Structure:**
```typescript
interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  fetchedAt: string;
  metadataJson: string;
  publishedAt?: string;
  filterContext?: FilterContext;
}
```

### NormalizedItem

**Purpose:** Cleaned, URL-canonicalized item after normalization stage

**Location:** `src/types/index.ts`

**Structure:**
```typescript
interface NormalizedItem {
  id: string;
  sourceId: string;
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
  filterContext?: FilterContext;
}
```

### ReportCandidate

**Purpose:** Unified candidate model for report generation (replaces legacy Item/Tweet)

**Location:** `src/types/index.ts`

**Structure:**
```typescript
interface ReportCandidate {
  id: string;
  kind: ContentKind; // 'article' | 'tweet' | ...
  topicId: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  sourceLabel: string;
  normalizedUrl: string;
  normalizedTitle: string;
  engagementScore?: number;
}
```

### Content (Database Model)

**Purpose:** Persisted unified content record in PostgreSQL

**Location:** `prisma/schema.prisma`

**Structure:**
```prisma
model Content {
  id               String   @id @default(cuid())
  kind             String
  sourceId         String
  title            String?
  body             String?  @db.Text
  url              String
  authorLabel      String?
  publishedAt      DateTime @db.Timestamptz
  fetchedAt        DateTime @default(now()) @db.Timestamptz
  engagementScore  Int?
  qualityScore     Float?
  topicIds         String[]
  topicScoresJson  String?  @db.Text
  metadataJson     String?  @db.Text
  @@unique([url])
}
```

## Entry Points

### API Routes (app/api/)

| Endpoint | File | Purpose |
|----------|------|---------|
| POST /api/cron/collect | `app/api/cron/collect/route.ts` | Triggers content collection |
| POST /api/cron/daily | `app/api/cron/daily/route.ts` | Triggers daily report generation |
| POST /api/cron/weekly | `app/api/cron/weekly/route.ts` | Triggers weekly report generation |
| GET/POST /api/daily | `app/api/daily/route.ts` | Get/create daily report |
| GET/POST /api/weekly | `app/api/weekly/route.ts` | Get/create weekly report |
| GET/POST /api/sources | `app/api/sources/route.ts` | List/create sources |
| GET/PUT /api/settings/reports | `app/api/settings/reports/route.ts` | Report configuration |
| GET /api/stats | `app/api/stats/route.ts` | System statistics |

### Frontend Pages (app/)

| Page | File | Purpose |
|------|------|---------|
| / | `app/page.tsx` | Home (redirects to /daily) |
| /daily | `app/daily/page.tsx` | Daily report view |
| /weekly | `app/weekly/page.tsx` | Weekly report view |
| /config | `app/config/page.tsx` | Source configuration |
| /x | `app/x/page.tsx` | X/Twitter feed |
| /settings/reports | `app/settings/reports/page.tsx` | Report settings |

## Error Handling

**Strategy:** Structured error tracking with step-by-step failure recording

**Patterns:**

1. **Pipeline errors:** Each stage records errors via `errorSteps` array in result objects
   - Example in `src/reports/daily.ts`:
   ```typescript
   const errorSteps: string[] = [];
   // On failure:
   errorSteps.push("dataCollection");
   await persistResults(date, dayLabel, [], "数据收集失败", errorSteps);
   ```

2. **API errors:** Use `lib/api-response.ts` helpers
   ```typescript
   import { success, error, handlePrismaError } from "@/lib/api-response";
   return error("message", 400);
   ```

3. **Prisma errors:** Use `handlePrismaError` with typed error messages
   ```typescript
   handlePrismaError(err, { p2002: "唯一键冲突", p2025: "记录不存在" });
   ```

4. **Fallback patterns:** AI failures fall back to heuristic/category-based approaches
   - Daily report: `fallbackCategoryGrouping()` groups by sourceLabel
   - Weekly report: concatenates topic summaries as editorial fallback

## Cross-Cutting Concerns

**Logging:** Custom logger in `src/utils/logger.ts` with structured logging (info, error, warn)

**Validation:**
- Zod schemas in `src/api/schemas/query.ts` for API input validation
- `lib/api-response.ts` `validateBody()` for Zod validation

**Authentication:**
- Cron routes verify requests via `verifyCronRequest()` in `app/api/cron/_lib.ts`
- Auth configs loaded per-source via `src/config/load-auth.ts`

**Timezone:**
- All DateTime fields in Prisma use `@db.Timestamptz`
- Backend uses UTC methods only (`setUTCHours()`, `getUTCDay()`, etc.)
- Frontend converts via `lib/format-date.ts` using `Intl.DateTimeFormat`
- Reports use Beijing timezone via `beijingDayRange()` / `beijingWeekRange()`

---

*Architecture analysis: 2026-03-30*
