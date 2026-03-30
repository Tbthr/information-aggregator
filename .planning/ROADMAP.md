# Roadmap: Information Aggregator - Collection Pipeline & Report Quality Audit

## Overview

This project audits and optimizes the Information Aggregator's data collection pipeline and AI-powered report generation. Starting with a critical frontend settings bug fix, the work proceeds through pipeline field quality verification, AI call optimization, and finally pipeline robustness hardening.

## Phases

- [ ] **Phase 1: Settings Consolidation** - Fix `packs` vs `topicIds` mismatch, consolidate settings pages
- [x] **Phase 2: Pipeline Field Quality Audit** - RSS/Atom field completeness, timestamp handling (completed 2026-03-30)
- [ ] **Phase 3: Topic Configuration + AI Optimization** - Initial topic seed, batch AI calls for daily/weekly
- [ ] **Phase 4: Pipeline Robustness** - Transaction wrapping, retry logic, failure logging

## Phase Details

### Phase 1: Settings Consolidation

**Goal**: Users can save and load daily/weekly report configuration without the `packs` vs `topicIds` schema mismatch bug
**Depends on**: Nothing (first phase)
**Requirements**: FRONTEND-01, FRONTEND-02
**Success Criteria** (what must be TRUE):
  1. User can view and edit daily/weekly report settings on a unified `/settings` page with two tabs
  2. User can select topics from a dropdown and save without the `packs` field error
  3. Settings API returns `topicIds` (not `packs`) and frontend correctly displays saved topics
  4. Sources configuration is accessible via a second tab on the same page
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Fix `packs` → `topicIds` field mismatch in ReportSettingsPage
- [x] 01-02-PLAN.md — Create tabbed /settings page with routing redirects and sidebar nav update

### Phase 2: Pipeline Field Quality Audit

**Goal**: All content fetchers produce complete RawItem records with no silently discarded fields
**Depends on**: Phase 1
**Requirements**: PIPELINE-01
**Success Criteria** (what must be TRUE):
  1. RSS adapter correctly extracts Atom `<link href="...">` attribute links
  2. RSS adapter handles relative timestamps (converts to absolute)
  3. Discard rate is logged per source so abnormal losses are detectable
  4. All four fetchers (RSS, JSON Feed, Website, X/Twitter) emit complete RawItem with title, url, publishedAt, author, content, and sourceType
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Fix Website adapter (discard logging, top-level author/content, discard summary) + extend RawItem type
- [x] 02-02-PLAN.md — Fix X/Bird adapter (24h window, discard logging) + RSS/JSON Feed (top-level author/content, discard summary)

### Phase 3: Topic Configuration + AI Optimization

**Goal**: Daily and weekly reports use properly seeded topic configuration with optimized AI calls
**Depends on**: Phase 2
**Requirements**: PIPELINE-02, PIPELINE-03, PIPELINE-04
**Success Criteria** (what must be TRUE):
  1. Supabase seed initializes `DailyReportConfig.topicIds` with all active topic IDs
  2. Daily report respects configured topicIds and filters content accordingly
  3. Daily AI uses batched calls (1 request for clustering, not N per-item requests)
  4. Weekly picks generation uses a single batched AI call instead of 6 separate calls
  5. Model version is pinned to a specific version string for deterministic clustering
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Topic configuration and seeding
- [x] 03-02-PLAN.md — AI call optimization

### Phase 4: Pipeline Robustness

**Goal**: Pipeline batch operations fail safely with transaction rollback, retry logic, and actionable error logs
**Depends on**: Phase 3
**Requirements**: (cross-cutting)
**Success Criteria** (what must be TRUE):
  1. Failed upsert batches roll back completely (no partial state)
  2. Transient failures retry up to 3 times before surfacing error
  3. Failed operations log specific source identifiers for manual re-run
  4. All Prisma batch operations (`upsertSourcesBatch`, `syncTopicsToPrisma`) are wrapped in `$transaction`
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Transaction wrapping
- [ ] 04-02-PLAN.md — Retry logic and error logging

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Settings Consolidation | 2/2 | Complete | 2026-03-30 |
| 2. Pipeline Field Quality | 2/2 | Complete   | 2026-03-30 |
| 3. Topic Config + AI Opt | 0/2 | Not started | - |
| 4. Pipeline Robustness | 0/2 | Not started | - |
