# Codebase Concerns

**Analysis Date:** 2026-03-30

## Tech Debt

### Signal Scoring Placeholders

**Item scoring not implemented:**
- File: `src/reports/scoring/item-score-adapter.ts`
- Issue: Returns zero signals for all article candidates until item signals are defined
- Impact: Articles receive no signal-based scoring advantage (freshness, engagement, quality, sourceWeight all 0)
- Fix approach: Define specific signals for articles (source authority, content length, etc.) and implement extraction logic

**Tweet freshness scoring not implemented:**
- File: `src/reports/scoring/tweet-score-adapter.ts` (line 70)
- Issue: `freshnessScore` always returns 0 despite TODO comment
- Impact: Tweets not ranked by recency within the signal scoring stage
- Fix approach: Implement actual freshness scoring based on `publishedAt`

### Tweet Enrichment Disabled

**AI enrichment commented out:**
- File: `app/api/cron/_lib-x.ts` (line 93-94)
- Issue: Tweet enrichment is disabled pending refactoring to Content model
- Impact: Tweets do not receive AI enrichment (topic classification, key points, etc.)
- Fix approach: Re-enable tweet enrichment with Content-based approach (mentioned in TODO)

### Hook Pending Migration

**useTweets hook waits for migration:**
- File: `hooks/use-tweets.ts` (lines 4-7)
- Issue: Comment indicates this hook should be replaced with `useContent({ kinds: 'tweet' })` after Tweet-specific fields are migrated into unified Content model
- Impact: Parallel code paths for Tweet vs Content data fetching
- Fix approach: Complete Tweet-to-Content migration and consolidate hooks

## Known Bugs

### Console.warn Instead of Proper Logging

**Diagnostic runners use console.warn:**
- Files: `src/ai/providers/fallback.ts`, `src/adapters/github-trending.ts`
- Issue: Uses `console.warn` instead of structured logger
- Impact: Inconsistent log formatting and levels
- Fix approach: Replace with `createLogger()` consistent with rest of codebase

## Security Considerations

### Environment Variables in X Adapter

**Auth tokens passed through config:**
- File: `src/adapters/x-bird.ts` (lines 57, 70)
- Issue: `authToken` and `ct0` from `process.env` are embedded in `configJson` string and passed to bird CLI
- Current mitigation: Uses environment variables (not hardcoded)
- Recommendations: Consider bird CLI approach that does not embed secrets in CLI arguments (visible in process list)

### DEBUG Output Writing to Filesystem

**Debug output saved with sensitive data:**
- File: `src/adapters/x-bird.ts` (lines 9-26)
- Issue: When `DEBUG_BIRD_OUTPUT=true`, raw bird CLI output (may contain auth tokens) is written to `out/bird-raw/`
- Current mitigation: Only enabled when env var is explicitly set
- Recommendations: Ensure `out/` directory is .gitignore'd and not committed; consider redacting auth tokens in debug output

## Performance Bottlenecks

### Large Files Requiring Refactoring

**daily.ts exceeds component size guidelines:**
- File: `src/reports/daily.ts` (534 lines)
- Why fragile: Single file handles daily report generation pipeline (scoring, topic clustering, summary generation)
- Safe modification: Extract topic clustering, summary generation, and pick selection into separate modules
- Test coverage: `daily.test.ts` (511 lines) exists but tightly coupled

**upsert-content-prisma.ts complex batching:**
- File: `src/archive/upsert-content-prisma.ts` (592 lines)
- Why complex: Handles unified Content upsert with deduplication, batching, and error recovery
- Concern: BATCH_SIZE=30 may not be optimal for all workloads

**x-bird adapter parsing logic:**
- File: `src/adapters/x-bird.ts` (417 lines)
- Why fragile: Complex JSON parsing with multiple optional fields (media, articles, quotes, threads)
- Risk: Schema changes in bird CLI output could break parsing silently

### Missing Concurrency Limits

**No global concurrency guard on collection:**
- File: `src/pipeline/collect.ts`
- Issue: While `concurrency` option exists, no global limit prevents runaway parallel source fetching
- Cause: Sources processed per-adapter without global semaphore
- Improvement path: Add global concurrency limiter at pipeline level

## Fragile Areas

### Type Assertions in Tests

**Heavy use of `as any` in test mocking:**
- File: `src/pipeline/enrich.test.ts` (multiple lines: 126, 157, 188, 215, 277, 379)
- Why fragile: Test mocks bypass type safety, making refactoring riskier
- Safe modification: Define proper mock interfaces matching `AiClient` and `ContentCache` contracts
- Test coverage gap: Cannot catch contract mismatches at compile time

### @ts-ignore for Polyfill

**DOMParser polyfill workaround:**
- File: `src/pipeline/extract-content.ts` (line 14)
- Issue: `@ts-ignore` used because linkedom's DOMParser interface differs from standard
- Risk: Could break silently if linkedom updates or if standard DOMParser behavior is expected elsewhere
- Recommendation: Create typed wrapper or contribute type definitions to linkedom

### Error Recovery in Enrich Pipeline

**Silent failures in AI scoring:**
- File: `src/pipeline/enrich.ts` (lines 101-106)
- Pattern: Catches errors, logs warning, sets fallback score of 0, continues
- Risk: AI failures result in items with `contentQualityAi: 0` being included in reports
- Current behavior may be intentional for graceful degradation

## Scaling Limits

### No Pagination for Report Candidates

**In-memory candidate collection:**
- Files: `src/reports/daily.ts`, `src/reports/weekly.ts`
- Current capacity: All candidates loaded into memory for scoring
- Limit: Large content volumes may cause OOM on memory-constrained environments
- Scaling path: Stream candidates through scoring pipeline with batch processing

### Fixed Batch Size in Archive

**BATCH_SIZE hardcoded:**
- File: `src/archive/upsert-content-prisma.ts` (line 12: `BATCH_SIZE = 30`)
- Current capacity: 30 items per batch
- Limit: May be suboptimal for very high throughput scenarios
- Scaling path: Make configurable via environment or options

## Dependencies at Risk

### linkedom Dependency

**Non-standard DOM implementation:**
- File: `src/pipeline/extract-content.ts`
- Risk: linkedom is a less-maintained polyfill; API surface differs from standard DOM
- Impact: Type mismatches (requires @ts-ignore), potential behavioral differences
- Migration plan: Consider switching to jsdom or happy-dom for better TypeScript support, or use native DOMParser where available (Edge Runtime)

## Missing Critical Features

### No viewCount/bookmarkCount for Tweets

**Engagement signals incomplete:**
- File: `src/reports/scoring/tweet-score-adapter.ts` (lines 32-33)
- Problem: TODO indicates viewCount and bookmarkCount scoring not implemented because Tweet model not extended
- Blocks: Accurate tweet ranking by true engagement
- Priority: Medium

### No Content Extraction for Social Posts

**Social post content skipped:**
- File: `src/pipeline/enrich.ts` (lines 127-135)
- Pattern: Social posts use existing `normalizedText` without URL-based content extraction
- Impact: Social posts may have lower quality summaries than extracted articles
- Priority: Low (intentional design)

## Test Coverage Gaps

### Unit Test for Scoring Not Comprehensive

**Scoring pipeline not fully tested:**
- File: `src/reports/scoring/` directory
- What's not tested: Interaction between scoring stages (base vs signals vs merge vs history penalty)
- Files: `item-score-adapter.ts`, `tweet-score-adapter.ts` are thin wrappers
- Risk: Changes to scoring weights may not be caught
- Priority: Medium

### No E2E Tests for Collection Pipeline

**Collection only verified via diagnostics:**
- Files: `src/diagnostics/runners/collection.ts`
- What's not tested: Actual collection run in test environment with controlled sources
- Risk: Adapter changes may break collection without detection until diagnostics run
- Priority: High

---

*Concerns audit: 2026-03-30*
