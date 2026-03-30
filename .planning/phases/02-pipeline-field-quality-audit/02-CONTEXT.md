# Phase 2: Pipeline Field Quality Audit - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit all four content fetchers (RSS, JSON Feed, Website, X/Twitter) to produce complete RawItem records with no silently discarded fields. All adapters must emit consistent field structure, log discards with reasons, and apply the 24h time window uniformly.

</domain>

<decisions>
## Implementation Decisions

### Website adapter discard logging
- **D-01:** Website adapter must log each discarded item with reason (matching RSS/JSON Feed pattern: sourceId, title, url, discardReason via `logger.warn`)

### X/Bird 24h window filtering
- **D-02:** X/Bird adapter must apply 24h window filtering — items with `createdAt`/`created_at` older than 24h before job start are discarded
- **D-03:** Discard reasons are logged with same format as RSS/JSON Feed

### Discard rate metric
- **D-04:** After each source fetch completes, log a per-source summary: `{ sourceId, sourceType, fetched: N, discarded: M, discardRate: X% }`
- **D-05:** This summary should be a single `logger.info` call after all items are processed

### RawItem completeness — all four adapters
- **D-06:** All four adapters (RSS, JSON Feed, Website, X/Bird) must emit top-level `author` field (string or undefined)
- **D-07:** All four adapters must emit top-level `content` field (string or undefined)
- **D-08:** `sourceType` lives in `metadataJson` as `sourceKind` — this is existing behavior, no change needed

### Relative timestamp handling (Claude's Discretion)
- **D-09:** X/Bird and Website adapters: downstream agents may add relative timestamp detection if they determine it's needed for data quality

### Folded Todos
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 scope
- `.planning/ROADMAP.md` §Phase 2 — Success Criteria (4 items: Atom links, relative timestamps, discard logging, complete RawItem)
- `.planning/REQUIREMENTS.md` — PIPELINE-01 (fetcher field completeness)

### Adapters (read before implementing)
- `src/adapters/rss.ts` — Reference implementation: per-item discard logging, 24h window, relative timestamp detection
- `src/adapters/json-feed.ts` — Reference implementation: same pattern as RSS
- `src/adapters/website.ts` — Needs: discard logging, 24h window (already has timestamp extraction from `<time datetime>`)
- `src/adapters/x-bird.ts` — Needs: 24h window, discard logging, per-source summary

### Types and pipeline
- `src/types/index.ts` §RawItem — Core type definition (id, sourceId, title, url, fetchedAt, metadataJson, publishedAt, author?, content?)
- `src/pipeline/collect.ts` — `CollectSourceEvent` interface and `onSourceEvent` callback; collect orchestration

### Prior phase context
- `.planning/phases/01-settings-consolidation/01-CONTEXT.md` — Phase 1 decisions on tabbed settings, topic field naming

</canonical_refs>

<codebase_context>
## Existing Code Insights

### Reusable Assets
- `src/adapters/rss.ts` — Complete reference: `parseDate()` function with relative timestamp detection, per-item discard logging, 24h window filtering
- `src/adapters/json-feed.ts` — Same pattern as RSS
- `src/pipeline/collect.ts` `CollectSourceEvent` — `onSourceEvent` callback can be extended for discard metrics

### Established Patterns
- Per-item discard logging: `logger.warn("Discarding item with...", { sourceId, sourceType, title, url, rawTime, discardReason })`
- 24h window: `cutoffTime = new Date(jobStart.getTime() - 24 * 60 * 60 * 1000)`
- RawItem metadataJson structure: `{ provider, sourceKind, contentType, rawPublishedAt, timeSourceField, timeParseNote, summary, content, authorName }`

### Integration Points
- Each adapter's `collect*Source()` function is called from `src/pipeline/collect.ts`
- Discard summary must be called after each adapter's `parse*Items()` returns
- X/Bird adapter uses `buildBirdCommand()` and `parseBirdItems()` — 24h window logic needs to be added in `parseBirdItems()`

</codebase_context>

<specifics>
## Specific Ideas

- "RSS adapter already handles Atom `<link href="...">` correctly — no change needed"
- "X/Bird should use the same 24h window calculation as RSS/JSON Feed"
- "Discard summary should be a single log line per source after collection"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 02-pipeline-field-quality-audit*
*Context gathered: 2026-03-31*
