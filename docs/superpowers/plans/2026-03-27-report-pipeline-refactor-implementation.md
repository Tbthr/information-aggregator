# Report Pipeline Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the article collection and daily-report pipeline so article candidates are normalized, filtered, deduplicated, and persisted cleanly before daily generation, while daily reporting consumes a unified `ReportCandidate` model scored at runtime across `Item` and `Tweet`.

**Architecture:** The implementation splits into three layers. First, the article collection pipeline produces minimal `RawItem` objects, normalizes them into article-only `NormalizedItem` records, applies pack-level filters and dedupe, then persists `Item` as a cleaned candidate pool. Second, daily reporting maps persisted `Item` and `Tweet` records into a unified `ReportCandidate` runtime model. Third, a staged scoring pipeline computes runtime scores, applies a 14-day history penalty, trims to top N, and then runs existing AI filtering and topic generation on the trimmed candidate set.

**Tech Stack:** Next.js 16, TypeScript, Prisma, Supabase/PostgreSQL, Vitest/Jest-style tests already present in `src/**/*.test.ts`

---

## File Map

### Data models and shared types

- Modify: `prisma/schema.prisma`
  - Add `packId` to `Item`.
  - Add pack-level filter config fields.
  - Add daily-config kind preference fields.
  - Preserve old `Item` enhancement-result fields until read/write paths have been switched.
- Modify: `src/types/index.ts`
  - Redefine `RawItem`.
  - Redefine `NormalizedItem`.
  - Add `FilterContext`.
  - Add `ReportCandidate`, score breakdown types, and runtime score result types.
- Modify: `lib/types.ts`
  - Keep API-facing types aligned with any schema changes that surface to pages/routes.
- Modify: `app/api/settings/reports/route.ts`
  - Expose daily-config kind preferences through the existing report-settings API.
- Modify: `components/report-settings-page.tsx`
  - Surface daily-config kind preference inputs if the current settings UI owns that configuration.

### Collection pipeline

- Modify: `src/pipeline/run-collect-job.ts`
  - Create a single `jobStartedAt`.
  - Carry pack filter config into source resolution.
  - Update orchestration order to normalize -> filter -> exact dedupe -> near dedupe -> persist.
- Modify: `src/pipeline/collect.ts`
  - Thread `jobStartedAt` and `filterContext` into adapter inputs if needed.
- Modify: `src/config/load-pack-prisma.ts`
  - Load pack-level filter config from DB-backed records.
- Modify: `src/adapters/build-adapters.ts`
  - Keep article-adapter map aligned with explicitly supported sources only.
- Modify: `src/pipeline/run-collect-job.ts`
  - Add explicit gating for unsupported sources such as `github-trending` so they are skipped intentionally rather than recorded as failures.
- Modify: `src/adapters/rss.ts`
  - Produce minimal `RawItem`.
  - Parse and normalize source timestamps to UTC.
  - Apply 24h rolling-window filtering.
  - Populate `metadataJson.summary`, `metadataJson.content`, `metadataJson.authorName`, and time-audit fields.
- Modify: `src/adapters/json-feed.ts`
  - Same responsibilities as RSS adapter.
- Modify: `src/pipeline/normalize-url.ts`
  - Implement the agreed normalized URL rules: lowercase domain, strip `www.`, strip fragment, remove dynamic/tracking params, normalize trailing slash.
- Modify: `src/pipeline/normalize-text.ts`
  - Implement stronger `normalizeTitle()` and add helpers for summary/content normalization.
- Modify: `src/pipeline/normalize.ts`
  - Remove canonical-related logic.
  - Build article-only `NormalizedItem` with `normalizedUrl`, `normalizedTitle`, `normalizedSummary`, `normalizedContent`.
- Create: `src/pipeline/filter-by-pack.ts`
  - Central pack-level `mustInclude` / `exclude` filtering after normalize.
- Modify: `src/pipeline/dedupe-exact.ts`
  - Deduplicate by `normalizedUrl`, keeping newest `publishedAt`.
- Modify: `src/pipeline/dedupe-near.ts`
  - Replace token-overlap logic with token bucketing + `SequenceMatcher`-style similarity logic implemented in TS.
- Modify: `src/archive/upsert-prisma.ts`
  - Persist `NormalizedItem` rather than raw items.
  - Upsert `Item` by normalized URL with first-pack-wins semantics.

### Daily report runtime model and scoring

- Create: `src/reports/report-candidate.ts`
  - Map persisted `Item` and `Tweet` records to unified `ReportCandidate`.
  - Include `normalizedUrl` and `normalizedTitle` for history penalty use.
  - Add `TODO: 需要优化` comment for tweet title/content mapping.
- Create: `src/reports/scoring/types.ts`
  - Define stage input/output and score breakdown structures.
- Create: `src/reports/scoring/base-stage.ts`
  - Apply kind-level base score from daily config.
- Create: `src/reports/scoring/item-score-adapter.ts`
  - Placeholder adapter boundary with `TODO: 需要优化`.
- Create: `src/reports/scoring/tweet-score-adapter.ts`
  - Score tweet candidates from persisted tweet signals such as likes/bookmarks/views/replies/reposts.
- Create: `src/reports/scoring/merge-stage.ts`
  - Merge base score and kind-specific signals into runtime score.
- Create: `src/reports/scoring/history-penalty-stage.ts`
  - Apply 14-day history penalty using normalized URL exact match and normalized title near match.
- Create: `src/reports/scoring/index.ts`
  - Orchestrate scoring stages and return scored candidates.
- Modify: `src/reports/daily.ts`
  - Read multiple packs worth of `Item`.
  - Always include `Tweet` candidates.
  - Map both to `ReportCandidate`.
  - Run scoring pipeline.
  - Trim to top N before AI filter/clustering.
  - Retain `itemIds` / `tweetIds` output shape for now and add `TODO: 需要优化`.

### Weekly/report compatibility and diagnostics

- Modify: `src/reports/weekly.ts`
  - Explicitly consume only item-based daily results under the new mixed-kind daily model.
- Modify: `src/diagnostics/reports/verify-daily.ts`
  - Update expectations for candidate sourcing and retained output shape.
- Modify: `src/diagnostics/reports/verify-weekly.ts`
  - Keep weekly assertions aligned with item-only weekly input.
- Modify: `src/diagnostics/reports/verify-integrity.ts`
  - Recheck daily/weekly cross-links and updated candidate selection semantics.

### Tests

- Create: `src/config/load-pack-prisma.test.ts`
- Modify: `src/adapters/rss.test.ts`
- Modify: `src/adapters/json-feed.test.ts`
- Modify: `src/pipeline/normalize-url.test.ts`
- Modify: `src/pipeline/normalize-text.test.ts`
- Modify: `src/pipeline/dedupe-exact.test.ts`
- Modify: `src/pipeline/dedupe-near.test.ts`
- Modify: `src/pipeline/collect.test.ts`
- Modify: `src/pipeline/run-collect-job.test.ts`
- Create: `src/pipeline/filter-by-pack.test.ts`
- Create: `src/reports/report-candidate.test.ts`
- Create: `src/reports/scoring/base-stage.test.ts`
- Create: `src/reports/scoring/tweet-score-adapter.test.ts`
- Create: `src/reports/scoring/merge-stage.test.ts`
- Create: `src/reports/scoring/history-penalty-stage.test.ts`
- Modify: `src/reports/daily.ts` tests or add `src/reports/daily.test.ts` if coverage is missing

## Task 1: Add Schema Fields and Config Surface Without Removing Old Paths

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/index.ts`
- Modify: `lib/types.ts`
- Modify: `src/config/load-pack-prisma.ts`
- Create: `src/config/load-pack-prisma.test.ts`
- Modify: `app/api/settings/reports/route.ts`
- Modify: `components/report-settings-page.tsx`

- [ ] **Step 1: Write failing type/schema tests or assertions**

Document expected additions for:
- pack-level `mustInclude` / `exclude`
- daily-config kind preferences
- `FilterContext`
- `ReportCandidate`

- [ ] **Step 2: Run targeted tests to capture current failures**

Run: `pnpm test -- src/config/load-pack-prisma.test.ts scripts/diagnostics.test.ts`
Expected: FAIL due to missing config/schema support.

- [ ] **Step 3: Update shared types**

Implement:
- `RawItem` with minimal fields plus `filterContext`
- `NormalizedItem` with `normalizedUrl`, `normalizedTitle`, `normalizedSummary`, `normalizedContent`
- `ReportCandidate` and score breakdown types

- [ ] **Step 4: Update Prisma schema with additive changes only**

Implement:
- add `packId` to `Item`
- add pack-level filter config fields
- add daily-config kind preference fields
- keep `itemIds` / `tweetIds` for now in daily outputs
- keep legacy `Item` fields for compatibility during migration

- [ ] **Step 5: Apply schema to local database and regenerate Prisma client**

Run: `npx prisma db push`
Expected: PASS

- [ ] **Step 6: Regenerate Prisma client if needed**

Run: `npx prisma generate`
Expected: PASS

- [ ] **Step 7: Wire config loader and report settings API/UI**

Expose the new DB-backed fields through loader + report settings surfaces.

- [ ] **Step 8: Run type checks**

Run: `pnpm check`
Expected: PASS or failures only in still-unmigrated collection/report paths.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma src/types/index.ts lib/types.ts src/config/load-pack-prisma.ts src/config/load-pack-prisma.test.ts app/api/settings/reports/route.ts components/report-settings-page.tsx
git commit -m "refactor: add config fields for report pipeline refactor"
```

## Task 2: Refactor RSS and JSON Feed Adapters to Produce Minimal RawItem

**Files:**
- Modify: `src/adapters/rss.ts`
- Modify: `src/adapters/json-feed.ts`
- Modify: `src/adapters/rss.test.ts`
- Modify: `src/adapters/json-feed.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Cover:
- UTC timestamp parsing
- date-only values filled to UTC `23:59:59`
- relative/invalid timestamps discarded with warnings where applicable
- `metadataJson.summary` fallback from content
- minimal `RawItem` shape only

- [ ] **Step 2: Run targeted adapter tests**

Run: `pnpm test -- src/adapters/rss.test.ts src/adapters/json-feed.test.ts`
Expected: FAIL because current adapters still emit old fields and lack window filtering.

- [ ] **Step 3: Implement adapter timestamp parsing and 24h filtering**

Implement minimal helper logic inside adapters or extracted helper if duplication becomes large.

- [ ] **Step 4: Populate `metadataJson` audit/content fields**

Include:
- `rawPublishedAt`
- `timeSourceField`
- `timeParseNote`
- `summary`
- `content`
- `authorName`

- [ ] **Step 5: Re-run adapter tests**

Run: `pnpm test -- src/adapters/rss.test.ts src/adapters/json-feed.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/adapters/rss.ts src/adapters/json-feed.ts src/adapters/rss.test.ts src/adapters/json-feed.test.ts
git commit -m "refactor: emit minimal raw items from article adapters"
```

## Task 3: Rebuild Normalize and Pack Filtering

**Files:**
- Modify: `src/pipeline/normalize-url.ts`
- Modify: `src/pipeline/normalize-text.ts`
- Modify: `src/pipeline/normalize.ts`
- Create: `src/pipeline/filter-by-pack.ts`
- Modify: `src/pipeline/normalize-url.test.ts`
- Modify: `src/pipeline/normalize-text.test.ts`
- Modify: `src/pipeline/normalize.test.ts`
- Create: `src/pipeline/filter-by-pack.test.ts`

- [ ] **Step 1: Write failing normalization/filter tests**

Cover:
- URL normalization rules
- title normalization rules
- summary/content normalization behavior
- pack `mustInclude` / `exclude` substring matching

- [ ] **Step 2: Run targeted tests**

Run: `pnpm test -- src/pipeline/normalize-url.test.ts src/pipeline/normalize-text.test.ts src/pipeline/filter-by-pack.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement URL and text normalization helpers**

Implement:
- strip `www.`
- strip fragments and tracking params
- normalize title with RT/site-name/punctuation cleanup
- summary/content cleanup with truncation to 500 chars for content

- [ ] **Step 4: Simplify `normalize.ts`**

Remove canonical logic and produce article-only `NormalizedItem`.

- [ ] **Step 5: Implement pack filter stage**

Apply lowercased substring matching with `exclude` first, `mustInclude` second.

- [ ] **Step 6: Re-run targeted tests**

Run: `pnpm test -- src/pipeline/normalize-url.test.ts src/pipeline/normalize-text.test.ts src/pipeline/normalize.test.ts src/pipeline/filter-by-pack.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/pipeline/normalize-url.ts src/pipeline/normalize-text.ts src/pipeline/normalize.ts src/pipeline/filter-by-pack.ts src/pipeline/*.test.ts
git commit -m "refactor: normalize article candidates and apply pack filters"
```

## Task 4: Replace Exact/Near Dedupe with New Rules

**Files:**
- Modify: `src/pipeline/dedupe-exact.ts`
- Modify: `src/pipeline/dedupe-near.ts`
- Modify: `src/pipeline/dedupe-exact.test.ts`
- Modify: `src/pipeline/dedupe-near.test.ts`

- [ ] **Step 1: Write failing dedupe tests**

Cover:
- exact dedupe keeps newest `publishedAt`
- near dedupe uses token buckets before similarity checks
- similarity threshold `0.75`
- summary/content do not affect near dedupe decisions

- [ ] **Step 2: Run dedupe tests**

Run: `pnpm test -- src/pipeline/dedupe-exact.test.ts src/pipeline/dedupe-near.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement exact dedupe by `normalizedUrl`**

Keep earliest record identity irrelevant; keep newest published candidate.

- [ ] **Step 4: Implement near dedupe algorithm**

Implement bucket-by-significant-tokens + final title similarity check.

- [ ] **Step 5: Re-run dedupe tests**

Run: `pnpm test -- src/pipeline/dedupe-exact.test.ts src/pipeline/dedupe-near.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/dedupe-exact.ts src/pipeline/dedupe-near.ts src/pipeline/dedupe-*.test.ts
git commit -m "refactor: apply normalized url and title dedupe rules"
```

## Task 5: Persist NormalizedItem into Item Candidate Pool

**Files:**
- Modify: `src/archive/upsert-prisma.ts`
- Modify: `src/pipeline/run-collect-job.ts`
- Modify: `src/adapters/build-adapters.ts`
- Modify: `src/pipeline/collect.test.ts`
- Modify: `src/pipeline/run-collect-job.test.ts`

- [ ] **Step 1: Write failing persistence/orchestration tests**

Cover:
- normalize -> filter -> exact dedupe -> near dedupe -> persist ordering
- `Item.url = normalizedUrl`
- first-pack-wins semantics on conflicting URLs
- updated fields overwrite on repeated URL in same pack
- unsupported sources such as `github-trending` are intentionally skipped, not emitted as failures

- [ ] **Step 2: Run targeted orchestration tests**

Run: `pnpm test -- src/pipeline/collect.test.ts src/pipeline/run-collect-job.test.ts`
Expected: FAIL

- [ ] **Step 3: Update orchestration in `run-collect-job.ts`**

Create a single `jobStartedAt`, thread filter config, remove old raw-item archival assumptions, and gate unsupported source types explicitly.

- [ ] **Step 4: Update Prisma upsert path**

Persist `NormalizedItem` field mappings agreed in spec.

- [ ] **Step 5: Keep legacy Item fields populated or harmlessly defaulted until read-path migration completes**

Do not delete or break existing readers yet.

- [ ] **Step 6: Re-run targeted tests**

Run: `pnpm test -- src/pipeline/collect.test.ts src/pipeline/run-collect-job.test.ts`
Expected: PASS

- [ ] **Step 7: Run typecheck**

Run: `pnpm check`
Expected: PASS or remaining report-layer failures only.

- [ ] **Step 8: Commit**

```bash
git add src/archive/upsert-prisma.ts src/pipeline/run-collect-job.ts src/adapters/build-adapters.ts src/pipeline/collect.test.ts src/pipeline/run-collect-job.test.ts
git commit -m "refactor: persist normalized article candidates"
```

## Task 6: Introduce ReportCandidate and Scoring Pipeline

**Files:**
- Create: `src/reports/report-candidate.ts`
- Create: `src/reports/scoring/types.ts`
- Create: `src/reports/scoring/base-stage.ts`
- Create: `src/reports/scoring/item-score-adapter.ts`
- Create: `src/reports/scoring/tweet-score-adapter.ts`
- Create: `src/reports/scoring/merge-stage.ts`
- Create: `src/reports/scoring/history-penalty-stage.ts`
- Create: `src/reports/scoring/index.ts`
- Create: `src/reports/report-candidate.test.ts`
- Create: `src/reports/scoring/base-stage.test.ts`
- Create: `src/reports/scoring/tweet-score-adapter.test.ts`
- Create: `src/reports/scoring/merge-stage.test.ts`
- Create: `src/reports/scoring/history-penalty-stage.test.ts`

- [ ] **Step 1: Write failing runtime-model and scoring tests**

Cover:
- `Item -> ReportCandidate`
- `Tweet -> ReportCandidate`
- tweet title/summary/sourceLabel mapping
- base score by kind preference
- tweet signal scoring
- history penalty over 14 days using normalized URL/title

- [ ] **Step 2: Run targeted tests**

Run: `pnpm test -- src/reports/report-candidate.test.ts src/reports/scoring/*.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `ReportCandidate` mapping**

Add `TODO: 需要优化` comments for tweet mapping and item score adapter placeholder boundaries.

- [ ] **Step 4: Implement staged scoring pipeline**

Implement base stage, tweet score adapter, merge stage, and history penalty stage.

- [ ] **Step 5: Re-run targeted tests**

Run: `pnpm test -- src/reports/report-candidate.test.ts src/reports/scoring/*.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/reports/report-candidate.ts src/reports/scoring src/reports/*.test.ts
git commit -m "feat: add unified daily report candidate scoring pipeline"
```

## Task 7: Refactor Daily Report to Use Runtime Candidates and Top-N Before AI

**Files:**
- Modify: `src/reports/daily.ts`
- Create or Modify: `src/reports/daily.test.ts`

- [ ] **Step 1: Write failing daily-report tests**

Cover:
- reading multiple packs worth of items
- always including tweets
- mapping to `ReportCandidate`
- scoring before AI
- top N trimming before AI filter/clustering
- retaining `itemIds` / `tweetIds` output shape with `TODO: 需要优化`

- [ ] **Step 2: Run targeted daily tests**

Run: `pnpm test -- src/reports/daily.test.ts`
Expected: FAIL

- [ ] **Step 3: Refactor daily generation**

Update read path and runtime pipeline ordering per spec.

- [ ] **Step 4: Re-run daily tests**

Run: `pnpm test -- src/reports/daily.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reports/daily.ts src/reports/daily.test.ts
git commit -m "refactor: generate daily reports from scored runtime candidates"
```

## Task 8: Keep Weekly and Diagnostics Compatible

**Files:**
- Modify: `src/reports/weekly.ts`
- Modify: `src/diagnostics/reports/verify-daily.ts`
- Modify: `src/diagnostics/reports/verify-weekly.ts`
- Modify: `src/diagnostics/reports/verify-integrity.ts`

- [ ] **Step 1: Write/adjust failing report verification tests**

Cover:
- weekly consumes item-based daily results only
- daily/weekly integrity checks still pass with retained `itemIds` / `tweetIds`

- [ ] **Step 2: Run targeted diagnostics/report tests**

Run: `pnpm test -- src/diagnostics/reports/*.test.ts`
Expected: FAIL where old assumptions remain.

- [ ] **Step 3: Update weekly and diagnostics**

Make compatibility rules explicit.

- [ ] **Step 4: Re-run targeted tests**

Run: `pnpm test -- src/diagnostics/reports/*.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reports/weekly.ts src/diagnostics/reports/*.ts
git commit -m "refactor: align weekly and diagnostics with report pipeline changes"
```

## Task 9: Remove Legacy Item Fields and Old Read Assumptions

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/reports/daily.ts`
- Modify: `src/reports/weekly.ts`
- Modify: `app/api/daily/route.ts`
- Modify: `app/api/weekly/route.ts`
- Modify: `app/api/_lib/mappers.ts`
- Modify: `app/api/items/types.ts`
- Modify: `app/api/items/_lib.ts`
- Modify: `app/api/views/[id]/route.ts`
- Modify: `lib/types.ts`
- Modify: `lib/api-client.ts`
- Modify: `components/daily-page.tsx`
- Modify: `components/weekly-page.tsx`
- Modify: `components/article-card.tsx`
- Modify: `components/reading-panel.tsx`

- [ ] **Step 1: Write failing compatibility tests**

Cover removal of persisted `Item.score`, `bullets`, `categories`, `imageUrl` assumptions in remaining readers, including API shapers and visible UI consumers.

- [ ] **Step 2: Run targeted tests**

Run: `pnpm test -- src/reports/daily.test.ts src/diagnostics/reports/*.test.ts`
Expected: FAIL if any reader still depends on removed fields.

- [ ] **Step 3: Run a repo-wide search for residual legacy field readers**

Run: `rg -n "\\.score\\b|bullets\\b|categories\\b|imageUrl\\b" app lib src components -g '!node_modules'`
Expected: a reviewable list of remaining `Item` field consumers to migrate or intentionally retain for non-Item models such as `Tweet`.

- [ ] **Step 4: Remove legacy schema fields and cleanup remaining readers**

Remove old `Item` enhancement-result fields only after write/read paths have fully switched, and update all remaining API/UI readers that still expect those fields.

For `/api/items` specifically:
- remove `score`, `bullets`, `categories`, `imageUrl` from the response contract
- remove persisted-score-based `sort=ranked` behavior
- update API types/client/UI consumers accordingly

- [ ] **Step 5: Apply schema and regenerate Prisma client**

Run: `npx prisma db push`
Expected: PASS

- [ ] **Step 6: Regenerate Prisma client if needed**

Run: `npx prisma generate`
Expected: PASS

- [ ] **Step 7: Re-run targeted tests**

Run: `pnpm test -- src/reports/daily.test.ts src/diagnostics/reports/*.test.ts`
Expected: PASS

- [ ] **Step 8: Re-run typecheck and build to catch leftover UI/API readers**

Run: `pnpm check && pnpm build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma src/reports/daily.ts src/reports/weekly.ts app/api/daily/route.ts app/api/weekly/route.ts app/api/_lib/mappers.ts app/api/items/types.ts app/api/items/_lib.ts app/api/views/[id]/route.ts lib/types.ts lib/api-client.ts components/daily-page.tsx components/weekly-page.tsx components/article-card.tsx components/reading-panel.tsx
git commit -m "refactor: remove legacy item enhancement fields"
```

## Task 10: End-to-End Verification and Cleanup

**Files:**
- Modify: any touched files from previous tasks only if verification uncovers issues

- [ ] **Step 1: Run full typecheck**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Run targeted pipeline/report test suites**

Run: `pnpm test -- src/adapters src/pipeline src/reports src/diagnostics/reports`
Expected: PASS

- [ ] **Step 4: Run report diagnostics at minimum required level**

Run: `npx tsx scripts/diagnostics.ts full --run-collection --cleanup --confirm-cleanup --verbose`
Expected: PASS with FAIL count = 0

- [ ] **Step 5: If the full diagnostics reveal report-only regressions, rerun focused report diagnostics for faster iteration**

Run: `npx tsx scripts/diagnostics.ts reports --daily-only`
Expected: PASS

- [ ] **Step 6: Commit final fixes if verification required follow-ups**

```bash
git add <touched-files>
git commit -m "fix: resolve verification issues in report pipeline refactor"
```

## Task 11: Update Project Markdown Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `check-pipline.md`

- [ ] **Step 1: Review current docs against the new pipeline design**

Check for stale references to:
- YAML-based pack config as the source of truth
- canonical URL logic in article normalize flow
- `Item.score` or enhancement-result fields in `Item`
- old daily input assumptions

- [ ] **Step 2: Update `README.md`**

Document:
- article collection pipeline overview
- DB-backed pack/source config
- rolling 24h semantics
- daily runtime candidate/scoring flow at a high level

- [ ] **Step 3: Update `AGENTS.md`**

Document:
- article pipeline boundaries
- `Item` candidate-pool semantics
- daily uses `Item + Tweet`
- retained TODO areas such as tweet mapping and daily output references

- [ ] **Step 4: Update `check-pipline.md`**

Align the checklist with:
- normalized-item persistence
- runtime scoring
- retained `itemIds` / `tweetIds`
- new diagnostics expectations

- [ ] **Step 5: Review the edited markdown files**

Run: `git diff -- README.md AGENTS.md check-pipline.md`
Expected: only documentation updates aligned with the spec.

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md check-pipline.md
git commit -m "docs: update pipeline documentation for report refactor"
```

## Task 12: Update Diagnostics and Diagnosis Surface

**Files:**
- Modify: `scripts/diagnostics.ts`
- Modify: `src/diagnostics/runners/reports.ts`
- Modify: `src/diagnostics/reports/config.ts`
- Modify: `src/diagnostics/reports/inventory.ts`
- Modify: `src/diagnostics/reports/types.ts`
- Modify: `scripts/diagnostics.test.ts`

- [ ] **Step 1: Write failing diagnostics tests for the new pipeline assumptions**

Cover:
- article candidates are sourced from normalized persisted `Item`
- daily report no longer depends on persisted `Item.score`
- diagnostics wording/expectations reflect runtime scoring and mixed-kind daily inputs

- [ ] **Step 2: Run targeted diagnostics CLI tests**

Run: `pnpm test -- scripts/diagnostics.test.ts src/diagnostics/runners/reports.test.ts`
Expected: FAIL where old copy or assumptions remain.

- [ ] **Step 3: Update diagnostics entrypoints and report diagnostics helpers**

Align command descriptions, result formatting, and report assertions with the refactored pipeline semantics.

- [ ] **Step 4: Re-run targeted diagnostics tests**

Run: `pnpm test -- scripts/diagnostics.test.ts src/diagnostics/runners/reports.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/diagnostics.ts src/diagnostics/runners/reports.ts src/diagnostics/reports/config.ts src/diagnostics/reports/inventory.ts src/diagnostics/reports/types.ts scripts/diagnostics.test.ts
git commit -m "diag: update diagnostics for report pipeline refactor"
```
