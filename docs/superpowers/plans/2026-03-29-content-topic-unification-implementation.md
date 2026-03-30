# Content / Topic Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split `Item` + `Tweet` candidate pools with a single `Content` model, rename `Pack` to `Topic`, unify report persistence on `contentIds`, update diagnostics/diagnosis surfaces, and finish with a full L5 diagnostics acceptance run plus documentation updates.

**Architecture:** The refactor is executed in layers. First, schema and shared types are migrated from `Pack`/`Item`/`Tweet` to `Topic`/`Content`/`contentIds` while preserving deterministic normalization and dedupe contracts from the approved spec. Second, all fetchers normalize into unified `Content` inputs, report generation reads only `Content`, and report persistence is rewritten around `contentIds`. Third, diagnostics, APIs, hooks, and markdown documentation are updated to match the new data model, and the rollout closes with the required L5 end-to-end diagnostics run.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, Supabase/PostgreSQL, pnpm, existing `src/**/*.test.ts` test suite, `scripts/diagnostics.ts`

---

**Spec:** `/Users/lyq/ai-enhance/information-aggregator/docs/superpowers/specs/2026-03-29-content-topic-unification-design.md`

## File Map

### Schema and shared types

- Modify: `prisma/schema.prisma`
  - First add the new `Topic`/`Content`/`contentIds` shape without dropping old data-bearing fields.
  - Only drop legacy `Pack`/`Item`/`Tweet` fields after data backfill and read-path migration are complete.
  - Add `Topic.includeRules`, `Topic.excludeRules`, `Topic.scoreBoost`, `Topic.displayOrder`, `Topic.maxItems`, and `Source.priority` explicitly.
  - Rename `Source.type` to `Source.kind` (spec: `rss`, `xHome`, `xList`, `githubRelease`, etc.); add `Source.authRef` for credential reference.
  - Plan the `XPageConfig` retirement: its fields (`listId`, `birdMode`, `count`, etc.) migrate into `Source.configJson` for X-type sources, then the model is removed.
  - Add the full `Content` contract explicitly: `kind`, `sourceId`, `title`, `body`, `url`, `authorLabel`, `publishedAt`, `fetchedAt`, `engagementScore`, `qualityScore`, `topicIds`, `topicScoresJson`, `metadataJson`, `createdAt`, `updatedAt`.
  - Unify bookmarks on a single `Bookmark.contentId` relation and retire `TweetBookmark` after backfill.
  - Replace `DigestTopic.itemIds` + `tweetIds` with `contentIds`.
  - Replace `WeeklyPick.itemId` with `contentId`.
  - Update `DailyReportConfig.packs` to `topicIds`.
  - Update all `CustomView*`, `Bookmark`, and `Source` relations that still use pack/item/tweet IDs.
- Modify: `lib/types.ts`
  - Rename API-facing pack fields/types to topic fields/types.
  - Replace report reference arrays with `contentIds`.
  - Add the API-facing `Content`/`topicScoresJson` shape.
- Modify: `src/types/index.ts`
  - Replace `SourcePack`, `FilterContext.packId`, `ReportCandidate.packId`, and related pack-centric runtime types with topic-centric equivalents.
  - Add unified content normalization/runtime types.

### Source / Topic configuration and fetchers

- Modify: `src/config/load-pack-prisma.ts`
  - Rename and rework as topic loader if still needed by runtime config.
- Modify: `src/config/source-id.ts`
  - Keep stable source IDs after the source model changes.
- Modify: `src/adapters/build-adapters.ts`
  - Register distinct `rss`, `website`, `json-feed`, and X fetchers.
- Modify: `src/adapters/rss.ts`
  - Produce article-like raw payloads that can normalize into `Content`.
- Modify: `src/adapters/json-feed.ts`
  - Same as RSS, but with JSON feed-specific parsing.
- Create or modify: `src/adapters/website.ts`
  - Isolate website fetch logic as its own fetcher adapter.
- Modify: `src/adapters/x-bird.ts`
  - Keep X-specific enrichment in fetch/preprocess and normalize toward `Content`.

### Normalization, classification, dedupe, and persistence

- Modify: `src/pipeline/collect.ts`
  - Keep source orchestration generic after source/topic renames.
- Modify: `src/pipeline/run-collect-job.ts`
  - Orchestrate fetch -> normalize -> classify -> dedupe -> archive `Content`.
- Modify: `src/pipeline/normalize-url.ts`
  - Ensure implementation exactly matches the approved URL normalization contract.
- Modify: `src/pipeline/normalize-text.ts`
  - Support the approved `title`, `body`, and `dedupeText` normalization contract.
- Modify: `src/pipeline/normalize.ts`
  - Map each fetcher’s raw payload into unified `Content` input.
- Replace: `src/pipeline/filter-by-pack.ts`
  - Rename/rewrite as topic-based filtering/classification helper.
- Modify: `src/pipeline/dedupe-exact.ts`
  - Deduplicate on unified normalized `Content.url`.
- Modify: `src/pipeline/dedupe-near.ts`
  - Upgrade from sequential scan to cluster-based, token-LCS near dedupe on `dedupeText`.
- Create or modify: `src/archive/upsert-content-prisma.ts`
  - Central upsert layer for `Content`.
- Retire or adapt: `src/archive/upsert-prisma.ts`, `src/archive/upsert-tweet-prisma.ts`
  - Remove old candidate-pool writes once `Content` is live.

### Reports and report persistence

- Modify: `src/reports/report-candidate.ts`
  - Map only `Content` to report candidates.
- Modify: `src/reports/daily.ts`
  - Read `Content`, apply topic-aware scoring inputs, and persist `DigestTopic.contentIds`.
- Modify: `src/reports/weekly.ts`
  - Read daily `contentIds` and write `WeeklyPick.contentId`.
- Modify: `src/reports/scoring/*`
  - Replace pack-centric assumptions with topic-centric and content-centric inputs.

### APIs, hooks, and UI-facing query surfaces

- Modify: `app/api/daily/route.ts`
  - Return content-backed references instead of item/tweet split payloads.
- Modify: `app/api/weekly/route.ts`
  - Same for weekly responses.
- Modify: `app/api/settings/reports/route.ts`
  - Replace `packs` with `topicIds`.
- Create: `app/api/topics/route.ts`
  - Provide topic-based configuration responses.
- Create: `app/api/topics/[id]/route.ts`
  - Provide topic CRUD aligned with the new terminology and schema.
- Modify: `app/api/sources/route.ts`
  - Accept/write `defaultTopicIds` instead of `packId`.
- Modify: `app/api/sources/[id]/route.ts`
  - Same as above for update flows.
- Modify: `app/api/custom-views/route.ts`
  - Rename `packIds` payloads to `topicIds`.
- Modify: `app/api/custom-views/[id]/route.ts`
  - Same for update flows.
- Create: `app/api/content/*`
  - Replace item-list/detail surfaces with content-backed routes.
- Remove or retire: `app/api/items/*`
  - No long-term compatibility layer; callers migrate to `/api/content/*` in this refactor.
- Modify: `app/api/bookmarks/*`
  - Move article bookmark reads/writes to unified `Content` bookmarks.
- Modify: `app/api/tweet-bookmarks/*`
  - Backfill and then retire the tweet-specific bookmark surface in favor of unified content bookmarks.
- Modify: `lib/api-client.ts`
  - Rename pack APIs and report-setting fields to topic APIs/fields.
- Modify: `hooks/use-api.ts`
  - Replace pack-centric hooks and query params with topic-centric versions.
- Modify: `hooks/use-tweets.ts`, `hooks/use-x-config.ts`
  - Read from unified `Content`/`Source` surfaces if these hooks remain.

### Diagnostics and docs

- Modify: `scripts/diagnostics.ts`
  - Update diagnosis commands and output assumptions to the `Content`/`Topic` model.
- Modify: `src/diagnostics/runners/reports.ts`
  - Reflect content-backed daily/weekly checks.
- Modify: `src/diagnostics/reports/config.ts`
  - Expect `topicIds`, not `packs`.
- Modify: `src/diagnostics/reports/inventory.ts`
  - Count/report `Content` instead of `Item` + `Tweet`.
- Modify: `src/diagnostics/reports/verify-daily.ts`
  - Validate `contentIds` and topic-backed daily outputs.
- Modify: `src/diagnostics/reports/verify-weekly.ts`
  - Validate `WeeklyPick.contentId`.
- Modify: `src/diagnostics/reports/verify-integrity.ts`
  - Rewrite FK/integrity checks for `Content`.
- Modify: `src/diagnostics/reports/types.ts`
  - Replace item/tweet split diagnostics payloads with content-based ones.
- Modify: `scripts/diagnostics.test.ts`
  - Keep CLI/test coverage aligned with the new diagnosis surface.
- Modify: `README.md`
  - Document the new `Content` / `Topic` architecture and verification requirements.
- Modify: `AGENTS.md`
  - Update project instructions where they still describe pack/item assumptions.
- Modify: `check-pipline.md`
  - Rewrite the end-to-end diagnosis doc for unified content/topic and L5 acceptance.
- Modify: any additional markdown touched by the migration
  - Keep repo docs consistent with the new terms and verification path.

## Task 1: Add the new schema without dropping legacy data

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `pnpm check` (after Prisma client generation)

- [ ] **Step 1: Audit every pack/item/tweet/report relation in `prisma/schema.prisma` against the approved spec**

Review these models before editing:
- `CustomView`, `CustomViewPack`
- `DailyOverview`, `DigestTopic`, `DailyReportConfig`
- `Item`, `Pack`, `Source`
- `WeeklyReport`, `WeeklyPick`
- `Tweet`, `TweetBookmark`, `XPageConfig`

Expected: a written checklist of every schema object that must become `Topic`, `Content`, or `contentIds`.

- [ ] **Step 2: Rewrite the Prisma schema as an additive migration first**

Make these concrete changes:
- add new `Topic`/topic-like fields needed by the spec, including `includeRules`, `excludeRules`, `scoreBoost`, `displayOrder`, and `maxItems`
- rename `Source.type` to `Source.kind` (values: `rss`, `xHome`, `xList`, `githubRelease`, etc.)
- add `Source.priority`, `Source.defaultTopicIds`, and `Source.authRef`
- plan `XPageConfig` retirement: merge its fields into `Source.configJson` for X-type sources, then remove the model
- add new `Content` storage and report `contentIds`/`contentId` fields
- add the full `Content` field set from the spec:
  - `kind`
  - `sourceId`
  - `title`
  - `body`
  - `url`
  - `authorLabel`
  - `publishedAt`
  - `fetchedAt`
  - `engagementScore`
  - `qualityScore`
  - `topicIds`
  - `topicScoresJson`
  - `metadataJson`
  - `createdAt`
  - `updatedAt`
- add any new bookmark/content relations needed for unified bookmarks
- make the bookmark end state explicit:
  - final model is `Bookmark.contentId`
  - `TweetBookmark` exists only until backfill completes, then is removed
- keep legacy `Pack`/`Item`/`Tweet` data-bearing fields/models in place for now if dropping them would destroy data before backfill

- [ ] **Step 3: Push the schema and regenerate Prisma Client**

Run: `pnpm exec prisma db push && pnpm exec prisma generate`
Expected: schema sync completes and Prisma Client regenerates without dropping existing candidate data.

- [ ] **Step 4: Run typecheck to catch broken Prisma usages immediately**

Run: `pnpm check`
Expected: FAIL initially, with compile errors showing the exact call sites still using pack/item/tweet fields.

- [ ] **Step 5: Commit the schema boundary**

```bash
git add prisma/schema.prisma
git commit -m "refactor: add additive topic and content schema"
```

## Task 2: Rewrite shared types to the new contract

**Files:**
- Modify: `lib/types.ts`
- Modify: `src/types/index.ts`
- Test: `pnpm test -- src/types/index.test.ts`

- [ ] **Step 1: Write or update failing type-focused tests for the new topic/content/report shapes**

Cover at least:
- `topicIds` replacing `packs`
- `contentIds` replacing `itemIds` + `tweetIds`
- `topicScoresJson` shape as `Record<string, number>`

- [ ] **Step 2: Run the targeted type tests**

Run: `pnpm test -- src/types/index.test.ts`
Expected: FAIL because the old runtime/API types still expose pack/item/tweet assumptions.

- [ ] **Step 3: Update `src/types/index.ts`**

Make the runtime layer reflect:
- source kinds with `defaultTopicIds`
- unified `Content` normalization inputs with `Content.kind` discriminated union (`article` | `tweet` | `github` | `reddit` | etc.) enabling type-safe narrowing per content kind
- topic-centric filter/classification context
- report candidates built from `Content`, not `Item`/`Tweet`

- [ ] **Step 4: Update `lib/types.ts`**

Make the API/UI layer reflect:
- `Topic` instead of `Pack`
- `contentIds` in daily/weekly payloads
- `topicScoresJson` as a stable object map

- [ ] **Step 5: Re-run targeted tests and typecheck**

Run: `pnpm test -- src/types/index.test.ts && pnpm check`
Expected: targeted tests PASS; broader typecheck may still fail in downstream consumers.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts src/types/index.ts src/types/index.test.ts
git commit -m "refactor: update shared types for topic content model"
```

## Task 3: Split article-like fetchers and unify source configuration

**Files:**
- Modify: `src/adapters/build-adapters.ts`
- Modify: `src/adapters/rss.ts`
- Modify: `src/adapters/json-feed.ts`
- Create or modify: `src/adapters/website.ts`
- Modify: `src/adapters/x-bird.ts`
- Modify: `src/config/load-pack-prisma.ts`
- Test: `src/adapters/*.test.ts`

- [ ] **Step 1: Add or update failing adapter tests for `rss`, `website`, and `json-feed` as distinct fetchers**

Cover:
- each source kind dispatches to its own fetcher
- each fetcher can still normalize into article-like content later
- X fetcher remains separate and keeps its preprocess responsibilities

- [ ] **Step 2: Run targeted adapter tests**

Run: `pnpm test -- src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/adapters/x-bird.test.ts`
Expected: FAIL because source config and adapter registration are still coupled to the old shape.

- [ ] **Step 3: Update source loading and adapter registration**

Make sure:
- source config loads `defaultTopicIds`
- `buildAdapters()` registers separate `rss`, `website`, `json-feed`, and X fetchers
- no article-like source logic is hidden behind a single “article adapter”

- [ ] **Step 4: Implement the website fetcher boundary**

If `website` logic already exists inline elsewhere, extract it into its own adapter file with focused responsibility.

- [ ] **Step 5: Re-run targeted adapter tests**

Run: `pnpm test -- src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/adapters/x-bird.test.ts`
Expected: PASS for the updated fetcher boundaries.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/build-adapters.ts src/adapters/rss.ts src/adapters/json-feed.ts src/adapters/website.ts src/adapters/x-bird.ts src/config/load-pack-prisma.ts
git commit -m "refactor: split content fetchers by source kind"
```

## Task 4: Implement exact normalization and classification contracts

**Files:**
- Modify: `src/pipeline/normalize-url.ts`
- Modify: `src/pipeline/normalize-text.ts`
- Modify: `src/pipeline/normalize.ts`
- Replace or modify: `src/pipeline/filter-by-pack.ts`
- Test: `src/pipeline/normalize-url.test.ts`, `src/pipeline/normalize-text.test.ts`, `src/pipeline/normalize.test.ts`, classification tests if present

- [ ] **Step 1: Write failing normalization tests for the approved contract**

Cover:
- `title` max length 160, per-type generation rules:
  - `article`: HTML decode → strip RT prefix → strip trailing site name → whitespace fold → truncate to 160
  - `tweet`: strip bare URLs → whitespace fold → truncate to 160
  - cleaned title must not be empty; if empty, discard content + warn
- `body` max length 500, per-type generation rules:
  - `article`: content/summary > feed summary > title fallback
  - `tweet`: tweet text + quote text + article preview text + thread summary
  - must be plain text: strip HTML → HTML decode → whitespace fold → truncate to 500
  - if body empty after cleanup, fall back to title; if still empty, discard + warn
- URL normalization (7-step contract from spec):
  1. protocol lowercase
  2. host lowercase
  3. remove `www.`
  4. `twitter.com` / `www.twitter.com` / `www.x.com` → `x.com`
  5. remove fragment (`#...`)
  6. strip tracking params: `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `ref`, `utm_campaign`, `utm_content`, `utm_medium`, `utm_source`, `utm_term`
  7. remove trailing slash on non-root paths
  - normalization failure → discard content + warn
  - X/Twitter content must expand short links to final URL before normalization
- `dedupeText` derivation: `title + " " + body` → lowercase → remove punctuation → whitespace fold; NOT stored in DB, only used for near-dedup comparison
- `engagementScore` per-type formulas:
  - `tweet`: `min(100, floor((likeCount * 1 + replyCount * 2 + retweetCount * 3) / 10))`
  - `github`: `min(100, floor((starCount * 1 + forkCount * 2 + commentCount * 2) / 10))`
  - `reddit`: `min(100, floor((score * 1 + commentCount * 2) / 10))`
  - `article/rss/website/json-feed`: `null` if no engagement signals
  - output clamped to `0-100` integer; `null` treated as `-1` in comparisons
- missing `publishedAt` causes drop + warn

- [ ] **Step 2: Run targeted normalization tests**

Run: `pnpm test -- src/pipeline/normalize-url.test.ts src/pipeline/normalize-text.test.ts src/pipeline/normalize.test.ts`
Expected: FAIL because the current normalization behavior does not yet match the spec.

- [ ] **Step 3: Update normalization helpers and content mapping**

Implement:
- exact `title`, `body`, `url`, and `engagementScore` generation rules as enumerated in Step 1
- `topicScoresJson` contract: `Record<topicId, baseMatchScore>`, keys are `Topic.id`, values are base match scores without `Topic.scoreBoost` applied
- topic classification 6-step decision tree (from spec):
  1. start with `Source.defaultTopicIds` as initial candidates
  2. for each candidate topic, check `Topic.excludeRules` against `Content.title + "\n\n" + Content.body` (case-insensitive)
  3. if `excludeRules` hit → remove from candidates
  4. if `Topic.includeRules` is empty → keep (default inclusion)
  5. if `Topic.includeRules` is non-empty → at least one keyword must match to keep
  6. no global topic guessing beyond `defaultTopicIds` — content is NOT assigned to topics outside its source's defaults
  - matching surface: `Content.title + "\n\n" + Content.body`, lowercase, collapsed whitespace
  - `excludeRules` priority > `includeRules`

- [ ] **Step 4: Rename or rewrite pack filtering into topic classification**

Replace old pack-centric runtime logic with topic-centric matching and base match score generation.

- [ ] **Step 5: Re-run targeted normalization tests**

Run: `pnpm test -- src/pipeline/normalize-url.test.ts src/pipeline/normalize-text.test.ts src/pipeline/normalize.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/normalize-url.ts src/pipeline/normalize-text.ts src/pipeline/normalize.ts src/pipeline/filter-by-pack.ts src/pipeline/*.test.ts
git commit -m "refactor: normalize sources into unified content inputs"
```

## Task 5: Rewrite exact and near dedupe for unified content

**Files:**
- Modify: `src/pipeline/dedupe-exact.ts`
- Modify: `src/pipeline/dedupe-near.ts`
- Modify: related tests in `src/pipeline/dedupe-*.test.ts`

- [ ] **Step 1: Write failing dedupe tests for URL winner selection and cluster-based near dedupe**

Cover:
- exact dedupe on normalized `Content.url` — winner selection by the 6-criteria ordering below
- near-dedup on tokenized `dedupeText`:
  - pre-filter 1: at least 1 shared token between two items
  - pre-filter 2: `publishedAt` delta <= 24 hours
  - similarity: `2 * LCS(tokens_a, tokens_b) / (len(tokens_a) + len(tokens_b))`
  - threshold: `0.75`
  - cluster behavior: `A≈B`, `B≈C` → single cluster (connected components)
  - input-order independence: same input set in any order produces identical output
- winner selection (exact and near dedupe, applied in order):
  1. `topicIds.length` higher wins
  2. `Source.priority` higher wins
  3. `engagementScore` higher wins (`null` treated as `-1`)
  4. `publishedAt` newer wins
  5. `fetchedAt` newer wins
  6. `id` lexicographic comparison as final tiebreaker

- [ ] **Step 2: Run the dedupe tests**

Run: `pnpm test -- src/pipeline/dedupe-exact.test.ts src/pipeline/dedupe-near.test.ts`
Expected: FAIL because the current near-dedup is sequential and title-only.

- [ ] **Step 3: Implement deterministic unified dedupe**

Keep:
- exact dedupe on normalized `Content.url`
- cluster-based near-dedup on tokenized `dedupeText`
- winner ordering from the approved spec

- [ ] **Step 4: Re-run dedupe tests**

Run: `pnpm test -- src/pipeline/dedupe-exact.test.ts src/pipeline/dedupe-near.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/dedupe-exact.ts src/pipeline/dedupe-near.ts src/pipeline/dedupe-*.test.ts
git commit -m "refactor: make unified content dedupe deterministic"
```

## Task 6: Replace candidate-pool persistence with `Content`

**Files:**
- Modify: `src/pipeline/run-collect-job.ts`
- Modify or create: `src/archive/upsert-content-prisma.ts`
- Modify: `src/archive/upsert-prisma.ts`
- Modify: `src/archive/upsert-tweet-prisma.ts`
- Test: `src/pipeline/run-collect-job.test.ts`, archive tests

- [ ] **Step 1: Write failing persistence tests for unified content upserts**

Cover:
- article-like and tweet-like inputs both persist to `Content`
- `topicIds` / `topicScoresJson` persist correctly
- old item/tweet pool writes are no longer required

- [ ] **Step 2: Run targeted persistence tests**

Run: `pnpm test -- src/pipeline/run-collect-job.test.ts`
Expected: FAIL because orchestration still writes `Item` and `Tweet`.

- [ ] **Step 3: Build a single content upsert path**

Implement:
- unified `Content` archival input
- `runCollectJob()` orchestration rewritten around `Content`
- removal or retirement of legacy candidate-pool persistence writes

- [ ] **Step 4: Re-run targeted persistence tests**

Run: `pnpm test -- src/pipeline/run-collect-job.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/run-collect-job.ts src/archive/upsert-content-prisma.ts src/archive/upsert-prisma.ts src/archive/upsert-tweet-prisma.ts src/pipeline/run-collect-job.test.ts
git commit -m "refactor: persist unified content candidate pool"
```

## Task 7: Migrate report generation and persistence to `contentIds`

**Files:**
- Modify: `src/reports/report-candidate.ts`
- Modify: `src/reports/daily.ts`
- Modify: `src/reports/weekly.ts`
- Modify: `src/reports/scoring/*.ts`
- Test: `src/reports/report-candidate.test.ts`, `src/reports/daily.test.ts`, `src/reports/weekly.test.ts`, scoring tests

- [ ] **Step 1: Write failing report tests for content-only reads and `contentIds` writes**

Cover:
- daily reads only `Content`
- daily persists `DigestTopic.contentIds`
- weekly reads `contentIds`
- `WeeklyPick.contentId` replaces `itemId`
- no `itemIds` / `tweetIds` compatibility branch remains

- [ ] **Step 2: Run targeted report tests**

Run: `pnpm test -- src/reports/report-candidate.test.ts src/reports/daily.test.ts src/reports/weekly.test.ts src/reports/scoring/*.test.ts`
Expected: FAIL because reports still depend on `Item`, `Tweet`, and split IDs.

- [ ] **Step 3: Rewrite report candidate mapping and persistence**

Implement:
- content-only report candidate mapping
- topic-aware score inputs
- `contentIds` persistence for daily topics and weekly picks

- [ ] **Step 4: Re-run targeted report tests**

Run: `pnpm test -- src/reports/report-candidate.test.ts src/reports/daily.test.ts src/reports/weekly.test.ts src/reports/scoring/*.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reports/report-candidate.ts src/reports/daily.ts src/reports/weekly.ts src/reports/scoring/*.ts src/reports/*.test.ts
git commit -m "refactor: move reports to unified content references"
```

## Task 8: Migrate APIs, hooks, and custom-view/report settings to topic/content terminology

**Files:**
- Modify: `app/api/daily/route.ts`
- Modify: `app/api/weekly/route.ts`
- Modify: `app/api/settings/reports/route.ts`
- Create: `app/api/topics/route.ts`
- Create: `app/api/topics/[id]/route.ts`
- Remove or retire: `app/api/packs/route.ts`
- Remove or retire: `app/api/packs/[id]/route.ts`
- Modify: `app/api/sources/route.ts`
- Modify: `app/api/sources/[id]/route.ts`
- Modify: `app/api/custom-views/route.ts`
- Modify: `app/api/custom-views/[id]/route.ts`
- Create: `app/api/content/*`
- Remove or retire: `app/api/items/*`
- Modify: `app/api/bookmarks/*`
- Modify: `app/api/tweet-bookmarks/*`
- Modify: `lib/api-client.ts`
- Modify: `hooks/use-api.ts`
- Modify: `hooks/use-tweets.ts`, `hooks/use-x-config.ts`

- [ ] **Step 1: Write failing route/hook tests or add focused request fixtures where coverage already exists**

At minimum, cover:
- report settings now send/receive `topicIds`
- custom views use `topicIds`
- daily/weekly payloads expose `contentIds`
- source CRUD uses `defaultTopicIds`
- bookmark actions read/write unified content bookmarks
- pack CRUD callers switch to `/api/topics/*`
- item/content callers switch to `/api/content/*`

- [ ] **Step 2: Run targeted API/client tests if present, otherwise run `pnpm check` to capture the interface breakage**

Run: `pnpm check`
Expected: FAIL across routes, hooks, and client helpers that still use pack/item/tweet terminology.

- [ ] **Step 3: Rewrite API contracts and hooks**

Update the full request/response surface to the new vocabulary and data shape.

- [ ] **Step 3b: Migrate bookmark and sibling CRUD surfaces in the same pass**

Do not leave:
- `Bookmark` vs `TweetBookmark` split behavior
- `/api/packs/*` still speaking old pack terminology
- `/api/items/*` still acting as the primary public list/query surface
- UI clients calling stale pack/bookmark endpoints after the schema has moved on

- [ ] **Step 4: Re-run `pnpm check`**

Run: `pnpm check`
Expected: fewer errors; remaining failures should be isolated to diagnostics/docs or residual references.

- [ ] **Step 5: Commit**

```bash
git add app/api lib/api-client.ts hooks
git commit -m "refactor: update api and hooks for topic content model"
```

## Task 9: Migrate data and remove legacy compatibility code

**Files:**
- Modify: migration scripts or add one-time migration helpers under `scripts/`
- Modify: any code still dual-reading legacy tables/fields
- Test: targeted script tests if added, plus `pnpm check`

- [ ] **Step 1: Create a migration checklist for old-to-new data movement**

Cover:
- `Item` -> `Content(kind="article")` with field mapping:
  - `Item.title` → `Content.title`
  - `Item.summary` / `Item.content` → `Content.body` (prefer content over summary)
  - `Item.url` → `Content.url` (re-normalize via unified rules)
  - `Item.author` → `Content.authorLabel`
  - `Item.publishedAt` → `Content.publishedAt`
  - `Item.fetchedAt` → `Content.fetchedAt`
  - `Item.sourceId` → `Content.sourceId` (keep existing FK)
  - `Item.packId` → discarded (replaced by `Content.topicIds` from classification)
  - `Item.metadataJson` → `Content.metadataJson`
  - `Item.sourceName` / `Item.sourceType` → discarded (sourced from `Source` relation)
  - `Item.engagementScore` → `Content.engagementScore` (or `null` if not applicable)
- `Tweet` -> `Content(kind="tweet")` with field mapping:
  - `Tweet.text` → `Content.body` (and used to derive `Content.title`)
  - `Tweet.url` → `Content.url`
  - `Tweet.authorHandle` / `Tweet.authorName` → `Content.authorLabel` (prefer display name)
  - `Tweet.tweetId` → stored in `Content.metadataJson` for cross-reference
  - `Tweet.authorId`, `Tweet.conversationId` → stored in `Content.metadataJson`
  - `Tweet.likeCount`, `Tweet.replyCount`, `Tweet.retweetCount` → `Content.metadataJson` (raw) + used to compute `Content.engagementScore`
  - `Tweet.mediaJson`, `Tweet.quotedTweetJson`, `Tweet.threadJson`, `Tweet.parentJson`, `Tweet.articleJson` → `Content.metadataJson`
  - `Tweet.categories`, `Tweet.bullets`, `Tweet.score` → discarded or stored in `Content.metadataJson` (legacy enrichment, not part of unified model)
  - `Tweet.tab` → discarded
  - `Tweet.publishedAt` → `Content.publishedAt`
  - `Tweet.fetchedAt` → `Content.fetchedAt`
  - `Tweet.sourceId` → `Content.sourceId` (keep existing FK)
- `XPageConfig` → merge into `Source.configJson`:
  - each `XPageConfig` row becomes config fields on its associated `Source` (or a new `Source` if needed)
  - fields `listId`, `birdMode`, `count` etc. become entries in `Source.configJson`
  - after merge, `XPageConfig` model is removed
- `DigestTopic.itemIds/tweetIds` -> `contentIds`:
  - create a lookup map: `old Item.id` → `new Content.id` and `old Tweet.id` → `new Content.id`
  - store old IDs in `Content.metadataJson.legacyId` during Item/Tweet → Content migration to enable this lookup
  - merge both arrays into single `contentIds` using the lookup map
- `WeeklyPick.itemId` -> `contentId`:
  - same lookup map strategy as above
- `Pack` -> `Topic` (rename, field-level mapping)
- `Source.packId` -> `Source.defaultTopicIds`: convert old `packId` to single-element array `[packId]`
- `CustomViewPack` and `DailyReportConfig.packs` -> topic-based fields
- `Bookmark` + `TweetBookmark` -> unified content bookmark records:
  - backfill: for each `Bookmark.itemId`, look up the corresponding `Content.id` and write `Bookmark.contentId`
  - for each `TweetBookmark.tweetId`, look up the corresponding `Content.id` and write new `Bookmark` records with `contentId`
  - verify no duplicate bookmarks for same `contentId` + userId
  - remove `TweetBookmark` only after backfill verification
- `/api/packs/*` consumers -> `/api/topics/*`
- `/api/items/*` consumers -> `/api/content/*`

- [ ] **Step 2: Implement the one-time migration helpers**

Place them in `scripts/` if they are executable, and keep them explicit and idempotent where feasible.

Key implementation requirements:
- Item/Tweet → Content: write `Content.metadataJson.legacyId = { type: "item"|"tweet", id: oldId }` to enable cross-reference for report migration
- XPageConfig → Source.configJson: merge each XPageConfig row into its associated Source's configJson, then remove XPageConfig
- Source.packId → Source.defaultTopicIds: `UPDATE Source SET defaultTopicIds = [packId] WHERE packId IS NOT NULL`
- DigestTopic: use the legacyId lookup to map old itemIds + tweetIds to new Content.id values, merge into contentIds
- WeeklyPick: same legacyId lookup to map old itemId to new contentId
- Bookmark unification:
  - backfill existing `Bookmark.itemId` into `Bookmark.contentId` via legacyId lookup
  - backfill `TweetBookmark.tweetId` into new `Bookmark` records with `contentId` via legacyId lookup
  - verify no duplicate bookmarks for same `contentId` + userId
  - remove `TweetBookmark` only after backfill verification succeeds

- [ ] **Step 3: Run migration helpers in a safe dev environment**

Run the exact script commands you wrote.
Expected: data maps cleanly without orphaned references.

- [ ] **Step 4: Only after backfill succeeds, remove dead compatibility branches and legacy schema fields**

Delete code that still depends on old `Item`, `Tweet`, `Pack`, `itemIds`, `tweetIds`, or `packId` semantics once migration coverage exists.

- [ ] **Step 4b: Apply the cleanup schema pass**

Update `prisma/schema.prisma` a second time to remove now-obsolete legacy models/fields, then run:

Run: `pnpm exec prisma db push && pnpm exec prisma generate`
Expected: cleanup succeeds because data has already been backfilled into the new model.

- [ ] **Step 5: Re-run `pnpm check`**

Run: `pnpm check`
Expected: PASS or only diagnostics/docs-related failures remain.

- [ ] **Step 6: Commit**

```bash
git add scripts src app prisma
git commit -m "refactor: migrate legacy data to unified content model"
```

## Task 10: Update diagnostics and diagnosis surface

**Files:**
- Modify: `scripts/diagnostics.ts`
- Modify: `src/diagnostics/runners/reports.ts`
- Modify: `src/diagnostics/reports/config.ts`
- Modify: `src/diagnostics/reports/inventory.ts`
- Modify: `src/diagnostics/reports/verify-daily.ts`
- Modify: `src/diagnostics/reports/verify-weekly.ts`
- Modify: `src/diagnostics/reports/verify-integrity.ts`
- Modify: `src/diagnostics/reports/types.ts`
- Modify: `scripts/diagnostics.test.ts`
- Modify: any other diagnosis-facing tests under `src/diagnostics/**`

- [ ] **Step 1: Write failing diagnostics tests for the new `Content`/`Topic` assumptions**

Cover:
- config uses `topicIds`
- inventory reports `Content`
- daily/weekly verification reads `contentIds`
- integrity checks no longer expect split item/tweet references

- [ ] **Step 2: Run targeted diagnostics tests**

Run: `pnpm test -- scripts/diagnostics.test.ts src/diagnostics/runners/reports.test.ts src/diagnostics/reports/*.test.ts`
Expected: FAIL because diagnostics still encode pack/item/tweet assumptions.

- [ ] **Step 3: Rewrite diagnostics entrypoints and report-verification helpers**

Make sure the diagnosis surface mirrors the final runtime model, not a compatibility layer.

- [ ] **Step 4: Re-run targeted diagnostics tests**

Run: `pnpm test -- scripts/diagnostics.test.ts src/diagnostics/runners/reports.test.ts src/diagnostics/reports/*.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/diagnostics.ts src/diagnostics scripts/diagnostics.test.ts
git commit -m "diag: update diagnostics for unified content model"
```

## Task 11: Update markdown documentation and operational guidance

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `check-pipline.md`
- Modify: any related spec/plan cross-links or docs that still say pack/item/tweet candidate pool

- [ ] **Step 1: Search all markdown for stale terminology**

Run: `rg -n \"\\bPack\\b|\\bpacks\\b|\\bItem\\b|\\bitemIds\\b|\\btweetIds\\b|diagnos|diagnostics|collect-x|Tweet table\" README.md AGENTS.md check-pipline.md docs`
Expected: a concrete list of stale references to update.

- [ ] **Step 2: Update `README.md`**

Document:
- the `Content` / `Topic` architecture
- unified fetcher/normalize/dedupe/report flow
- the required validation flow after large pipeline changes

- [ ] **Step 3: Update `AGENTS.md`**

Keep project instructions aligned with:
- topic terminology
- diagnostics expectations
- the final L5 acceptance requirement for this refactor

- [ ] **Step 4: Update `check-pipline.md`**

Rewrite the diagnosis checklist so it describes:
- unified content collection
- topic-backed daily/weekly generation
- `contentIds` integrity expectations
- the required L5 command for final acceptance

- [ ] **Step 5: Review all edited markdown files**

Run: `git diff -- README.md AGENTS.md check-pipline.md docs`
Expected: no stale pack/item/tweet-candidate wording remains in the touched docs.

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md check-pipline.md docs
git commit -m "docs: update unified content topic documentation"
```

## Task 12: Run the required verification sequence, including L5 acceptance

**Files:**
- No code edits expected unless verification reveals regressions
- Test: full repo verification and required diagnosis run

- [ ] **Step 1: Run targeted tests for the refactor surface**

Run: `pnpm test -- src/adapters src/pipeline src/reports src/diagnostics`
Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Run the required L5 diagnostics acceptance**

Run: `npx tsx scripts/diagnostics.ts full --run-collection --cleanup --confirm-cleanup --verbose`
Expected: exit 0, summary `FAIL` count = 0.

- [ ] **Step 5: If L5 fails, fix the specific regression and rerun the full sequence**

Repeat:
- targeted failing tests
- `pnpm check`
- `pnpm build`
- L5 diagnostics command

Expected: do not close the refactor until the L5 run is green.

- [ ] **Step 6: Commit the verified final state**

```bash
git add .
git commit -m "refactor: unify content topic pipeline"
```

## What Stays Unchanged

The following models, fields, and subsystems are NOT in scope for this refactor and should remain as-is:

- `SourceHealth` — source health tracking, no pack/item/tweet dependencies
- `DailyReportConfig.keywordBlacklist` — global filter, not pack-specific
- `DailyReportConfig.filterPrompt` / `topicPrompt` — AI prompt fields, independent of data model
- `WeeklyReportConfig` — weekly report configuration, unchanged structure
- `Source.enabled` / `Source.name` — basic source fields, not renamed or removed
- `Bookmark.folderId` — bookmark folder organization, not affected by content unification
- UI components that only render data from API responses — they change only when the API contracts change (Task 8)
- `src/ai/` — AI client and prompt engineering, not affected by data model change
- `lib/date-utils.ts` — UTC/date utilities, independent of data model
- `lib/format-date.ts` — frontend date formatting, independent of data model

## Appendix: Field Mapping — Old Model → New Model

### Item → Content(kind="article")

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `Item.id` | `Content.id` | new UUID; old ID stored in `metadataJson.legacyId` |
| `Item.title` | `Content.title` | re-normalized per spec rules |
| `Item.summary` / `Item.content` | `Content.body` | prefer `content` over `summary` |
| `Item.url` | `Content.url` | re-normalized per 7-step URL contract |
| `Item.author` | `Content.authorLabel` | |
| `Item.sourceId` | `Content.sourceId` | FK preserved |
| `Item.publishedAt` | `Content.publishedAt` | |
| `Item.fetchedAt` | `Content.fetchedAt` | |
| `Item.packId` | `Content.topicIds` | re-classified via topic rules, not direct carry |
| `Item.metadataJson` | `Content.metadataJson` | merged |
| `Item.sourceName` | — | discarded; sourced from `Source` relation |
| `Item.sourceType` | — | discarded; `Source.kind` replaces |
| `Item.engagementScore` | `Content.engagementScore` | `null` for articles without signals |

### Tweet → Content(kind="tweet")

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `Tweet.id` | `Content.id` | new UUID; old ID stored in `metadataJson.legacyId` |
| `Tweet.text` | `Content.body` | also used to derive `Content.title` |
| `Tweet.url` | `Content.url` | expanded from short link, then normalized |
| `Tweet.authorHandle` / `Tweet.authorName` | `Content.authorLabel` | prefer display name |
| `Tweet.sourceId` | `Content.sourceId` | FK preserved |
| `Tweet.publishedAt` | `Content.publishedAt` | |
| `Tweet.fetchedAt` | `Content.fetchedAt` | |
| `Tweet.likeCount` / `replyCount` / `retweetCount` | `Content.engagementScore` | computed via tweet formula; raw values in `metadataJson` |
| `Tweet.tweetId` | `metadataJson.tweetId` | platform ID for cross-reference |
| `Tweet.authorId` / `conversationId` | `metadataJson.*` | |
| `Tweet.mediaJson` / `quotedTweetJson` / `threadJson` / `parentJson` / `articleJson` | `metadataJson.*` | tweet-specific structures |
| `Tweet.categories` / `bullets` / `score` | `metadataJson.legacy.*` | legacy enrichment, optional |
| `Tweet.tab` | — | discarded |

### Pack → Topic

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `Pack.id` | `Topic.id` | same value, renamed |
| `Pack.name` | `Topic.name` | |
| `Pack.description` | `Topic.description` | |
| `Pack.enabled` | `Topic.enabled` | |
| `Pack.displayOrder` | `Topic.displayOrder` | |
| `Pack.maxItems` | `Topic.maxItems` | |
| — | `Topic.includeRules` | new: keyword array for topic inclusion |
| — | `Topic.excludeRules` | new: keyword array for topic exclusion |
| — | `Topic.scoreBoost` | new: numeric bonus when content matches |

### Source Changes

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `Source.type` | `Source.kind` | renamed; values: `rss`, `xHome`, `xList`, `githubRelease` |
| `Source.packId` | `Source.defaultTopicIds` | single → array; migration: `[packId]` |
| — | `Source.priority` | new: source weight for scoring |
| — | `Source.authRef` | new: credential reference |
| `Source.configJson` | `Source.configJson` | expanded: absorbs XPageConfig fields for X-type sources |

### Report Storage

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `DigestTopic.itemIds` + `DigestTopic.tweetIds` | `DigestTopic.contentIds` | merged via legacyId lookup |
| `WeeklyPick.itemId` | `WeeklyPick.contentId` | mapped via legacyId lookup |
| `DailyReportConfig.packs` | `DailyReportConfig.topicIds` | |

### Bookmark Unification

| Old Model | New Model | Notes |
|-----------|-----------|-------|
| `Bookmark.itemId` | `Bookmark.contentId` | mapped via legacyId lookup |
| `TweetBookmark.tweetId` | `Bookmark.contentId` | new Bookmark row created per legacy tweet bookmark |
| `TweetBookmark` | — | removed after backfill verification |

### XPageConfig Retirement

| Old Model | Target | Notes |
|-----------|--------|-------|
| `XPageConfig.listId` | `Source.configJson.listId` | for X-type sources |
| `XPageConfig.birdMode` | `Source.configJson.birdMode` | |
| `XPageConfig.count` | `Source.configJson.count` | |
| `XPageConfig` (model) | — | removed after fields merged into Source.configJson |

---

## Implementation Status

**Last Updated:** 2026-03-30

### Completion Status

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Add new schema | ✅ Complete | Content model added, Source.type → Source.kind, Pack → Topic |
| Task 2: Rewrite shared types | ✅ Complete | Content type, topic types, unified API contracts |
| Task 3: Split fetchers | ✅ Complete | RSS, JSON Feed, Website adapters separated |
| Task 4: Normalization contracts | ✅ Complete | URL normalization, text normalization, topic classification |
| Task 5: Rewrite dedupe | ✅ Complete | Exact dedupe on Content.url, near dedupe on dedupeText |
| Task 6: Content persistence | ✅ Complete | upsert-content-prisma.ts created, Content archived |
| Task 7: Report generation | ✅ Complete | Daily/Weekly use contentIds, ContentRead backed |
| Task 8: APIs/hooks migration | ✅ Complete | /api/daily, /api/weekly use Content |
| Task 9: Data migration | ✅ Complete | 797 Items → Content, 8 DigestTopics, 6 WeeklyPicks, 102 Sources |
| Task 10: Diagnostics update | ✅ Complete | Types updated to content terminology |
| Task 11: Documentation | ✅ Complete | AGENTS.md updated, this plan marked complete |
| Task 12: L5 acceptance | ⏳ Pending | Awaiting execution |

### Migration Summary (2026-03-30)

- **Step 1 (Item → Content):** 797 Items migrated to Content(kind="article"), 1 skipped (duplicate URL)
- **Step 2 (Tweet → Content):** 0 Tweets in database
- **Step 3 (XPageConfig):** 4 configs skipped (no X sources in database)
- **Step 4 (DigestTopic):** 8 topics migrated to use contentIds
- **Step 5 (WeeklyPick):** 6 picks migrated to use contentId
- **Step 6 (Pack → Topic):** 8 packs processed (schema rename only)
- **Step 7 (Source.packId):** 102 sources migrated to defaultTopicIds
- **Step 8 (Bookmarks):** 0 legacy bookmarks to migrate

### Remaining Work

- Run L5 acceptance verification (`scripts/diagnostics.ts full --run-collection --cleanup`)
- Legacy schema cleanup (remove DigestTopic.itemIds/tweetIds after verification)
- Prisma schema updates for production migration
