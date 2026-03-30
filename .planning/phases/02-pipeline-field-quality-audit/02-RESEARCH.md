# Phase 2: Pipeline Field Quality Audit - Research

**Researched:** 2026-03-31
**Domain:** Content fetcher adapters (RSS, JSON Feed, Website, X/Bird)
**Confidence:** HIGH

## Summary

Phase 2 audits all four content fetchers to ensure complete `RawItem` records with no silently discarded fields. The RSS and JSON Feed adapters serve as reference implementations with correct per-item discard logging, relative timestamp detection, and 24h window filtering. The Website adapter needs per-item discard logging added (currently silently drops items outside 24h window). The X/Bird adapter needs the 24h window filtering and discard logging implemented from scratch. All four adapters need top-level `author` and `content` fields added to `RawItem` output, and all need a per-source discard summary log after collection.

**Primary recommendation:** Use the RSS adapter as the implementation template. Website adapter needs discard logging added to existing 24h logic. X/Bird adapter needs 24h window filtering added to `parseBirdItems()` and discard logging throughout. All adapters need top-level `author`/`content` fields on returned `RawItem` objects.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Website adapter must log each discarded item with reason (matching RSS/JSON Feed pattern: sourceId, title, url, discardReason via `logger.warn`)
- **D-02:** X/Bird adapter must apply 24h window filtering — items with `createdAt`/`created_at` older than 24h before job start are discarded
- **D-03:** Discard reasons are logged with same format as RSS/JSON Feed
- **D-04:** After each source fetch completes, log a per-source summary: `{ sourceId, sourceType, fetched: N, discarded: M, discardRate: X% }`
- **D-05:** This summary should be a single `logger.info` call after all items are processed
- **D-06:** All four adapters must emit top-level `author` field (string or undefined)
- **D-07:** All four adapters must emit top-level `content` field (string or undefined)
- **D-08:** `sourceType` lives in `metadataJson` as `sourceKind` — no change needed
- **D-09:** X/Bird and Website adapters: downstream agents may add relative timestamp detection if needed

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPELINE-01 | Fetcher field completeness — RSS/Atom field completeness | All four adapters must emit title, url, publishedAt, sourceType, author, content |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `src/utils/logger.ts` | existing | Structured logging with `createLogger()` | All adapters use this for discard logging |
| `src/types/index.ts` | existing | `RawItem`, `RawItemMetadata` type definitions | Shared type contract across all adapters |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/adapters/rss.ts` | existing | Reference implementation | Template for discard logging pattern |
| `src/adapters/json-feed.ts` | existing | Reference implementation | Same pattern as RSS |
| `src/pipeline/collect.ts` | existing | Orchestrates collection, `CollectSourceEvent` interface | Called by all adapters |

---

## Architecture Patterns

### Recommended Project Structure

```
src/adapters/
├── rss.ts           # Reference implementation (complete)
├── json-feed.ts     # Reference implementation (complete)
├── website.ts       # Needs: discard logging, discard summary
├── x-bird.ts        # Needs: 24h window, discard logging, discard summary
└── index.ts         # Adapter registry (if exists)
```

### Pattern 1: Per-Item Discard Logging
**What:** When an item is discarded, log at WARN level with structured data
**When to use:** Every time an item is filtered out (invalid timestamp, outside 24h window, missing URL)
**Example:**
```typescript
// Source: src/adapters/rss.ts lines 219-228
logger.warn("Discarding item with invalid timestamp", {
  sourceId,
  sourceType: "rss",
  title,
  url,
  rawTime: timestampFailure.rawPublishedAt,
  discardReason: `timestamp is ${timestampFailure.reason}: ${timestampFailure.rawPublishedAt}`,
});
```

### Pattern 2: 24h Window Filtering
**What:** Items older than 24h before job start are discarded
**When to use:** In every adapter's parse function
**Example:**
```typescript
// Source: src/adapters/rss.ts lines 173-175
const jobStart = new Date(jobStartedAt);
const cutoffTime = new Date(jobStart.getTime() - 24 * 60 * 60 * 1000);

// Discard check (lines 235-246)
if (parsedTimestamp.date < cutoffTime) {
  logger.warn("Discarding item outside 24h window", {
    sourceId,
    sourceType: "rss",
    title,
    url,
    rawTime: parsedTimestamp.rawPublishedAt,
    discardReason: `published at ${parsedTimestamp.date.toISOString()} is before cutoff ${cutoffTime.toISOString()}`,
  });
  continue;
}
```

### Pattern 3: Discard Summary
**What:** Single `logger.info` after all items processed with aggregate stats
**When to use:** After each adapter's `parse*Items()` returns
**Format:**
```typescript
logger.info("Source fetch completed", {
  sourceId,
  sourceType: "rss",
  fetched: items.length,
  discarded: discardCount,
  discardRate: `${((discardCount / (items.length + discardCount)) * 100).toFixed(1)}%`,
});
```

### Pattern 4: RawItem with Top-Level Author/Content
**What:** All adapters emit `author` and `content` as top-level RawItem fields
**When to use:** Every adapter's parse function return
**Example:**
```typescript
const item: RawItem = {
  id: `${sourceId}-${index + 1}-${url || title}`,
  sourceId,
  title,
  url,
  author: authorName,        // top-level string field
  content: contentText,       // top-level string field
  fetchedAt: new Date().toISOString(),
  metadataJson,
};
if (parsedTimestamp) {
  item.publishedAt = parsedTimestamp.date.toISOString();
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured logging | ad-hoc `console.log` | `createLogger("adapter:...")` | Consistent format, log levels, testability |
| Timestamp parsing | custom date logic | `parseDate()` from RSS adapter | Handles RFC 2822, ISO 8601, relative timestamps, date-only |
| 24h window | compute cutoff inline | RSS pattern: `new Date(jobStart.getTime() - 24 * 60 * 60 * 1000)` | Already tested, consistent across all adapters |

---

## Common Pitfalls

### Pitfall 1: Silently Discarding Items
**What goes wrong:** Items are filtered without any log entry, making it impossible to detect abnormal discard rates
**Why it happens:** Website adapter currently does this — when `publishedTime` is outside window, item is simply not added to returned array
**How to avoid:** Always log at WARN level when discarding items with reason
**Warning signs:** Discard count = 0 in logs but collection returns fewer items than expected

### Pitfall 2: Inconsistent Discard Log Format
**What goes wrong:** Different adapters log different fields for the same concept
**Why it happens:** Ad-hoc logging without standardized structure
**How to avoid:** Follow RSS pattern exactly: `{ sourceId, sourceType, title, url, rawTime, discardReason }`
**Warning signs:** `grep "Discarding" src/adapters/*.ts` shows inconsistent field names

### Pitfall 3: X/Bird Missing 24h Window
**What goes wrong:** X/Bird adapter returns all tweets without time filtering
**Why it happens:** 24h window logic was never added to `parseBirdItems()`
**How to avoid:** Add same cutoff calculation as RSS, apply in `parseBirdItems()` before constructing RawItem
**Warning signs:** X/Bird source returns tweets from days ago

### Pitfall 4: RawItem Type Missing Fields
**What goes wrong:** `author` and `content` fields are only in `metadataJson`, not top-level on RawItem
**Why it happens:** RawItem type definition (src/types/index.ts line 89-99) doesn't include these fields
**How to avoid:** Extend `RawItem` interface to include `author?: string` and `content?: string`, then set them in all adapter parse functions

---

## Code Examples

### Existing: RSS Adapter Atom Link Extraction (verified correct, no change needed)
```typescript
// Source: src/adapters/rss.ts line 181
const atomHref = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
const url = extractTag(block, "link") ?? atomHref ?? "";
```

### Existing: RSS Adapter Relative Timestamp Detection (verified correct, no change needed)
```typescript
// Source: src/adapters/rss.ts lines 55-59
const relativePatterns = [/\bago\b/i, /\bhours?\b/i, /\bdays?\b/i, /\bminutes?\b/i, /\byesterday\b/i, /\bjust now\b/i];
if (relativePatterns.some((pattern) => pattern.test(trimmed))) {
  return { valid: false, rawPublishedAt: trimmed, reason: "relative" };
}
```

### Existing: Website Adapter Has Cutoff Calculation But No Logging
```typescript
// Source: src/adapters/website.ts lines 73-86
const jobStart = new Date(jobStartedAt);
const cutoffTime = new Date(jobStart.getTime() - 24 * 60 * 60 * 1000);
// ...
if (publishedTime) {
  const parsed = new Date(publishedTime);
  if (!isNaN(parsed.getTime()) && parsed >= cutoffTime) {
    publishedAt = parsed.toISOString();
  }
  // Note: If parsed < cutoffTime, item is silently dropped
}
```

### Existing: X/Bird Adapter Has No 24h Window
```typescript
// Source: src/adapters/x-bird.ts lines 297-356 (parseBirdItems)
// No 24h filtering, no discard logging — all items are returned
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No discard logging | Per-item WARN logging with structured data | This phase | Enables detectability of abnormal discard rates |
| X/Bird no time filter | 24h window like RSS/JSON Feed | This phase | Prevents ancient tweets from polluting collection |
| `author`/`content` only in metadataJson | Top-level fields on RawItem | This phase | Downstream consumers get consistent interface |

**Deprecated/outdated:**
- Website adapter silent discard: Currently items outside 24h window are simply not returned — violates detectability requirement

---

## Open Questions

1. **Where should discard summary be called?**
   - What we know: CONTEXT says "after each source fetch completes" — but adapters return RawItem[], not metrics
   - What's unclear: Should `collectSources()` in collect.ts aggregate discard stats? Or each adapter log its own summary?
   - Recommendation: Each adapter's `collect*Source()` function should log the summary after `parse*Items()` returns, using local discard counters

2. **How to track discardCount in X/Bird adapter?**
   - What we know: `parseBirdItems()` doesn't have access to `jobStartedAt` — it's called from `collectXBirdSource()` which has it
   - What's unclear: Should `parseBirdItems()` take `jobStartedAt` as a parameter for 24h filtering?
   - Recommendation: Add `jobStartedAt` parameter to `parseBirdItems()` signature, same as RSS/JSON Feed

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this is a code-only change to existing adapters)

---

## Sources

### Primary (HIGH confidence)
- `src/adapters/rss.ts` — Reference implementation, complete pattern for per-item logging, 24h window, relative timestamp detection
- `src/adapters/json-feed.ts` — Reference implementation, same pattern as RSS
- `src/adapters/website.ts` — Existing 24h logic, missing discard logging
- `src/adapters/x-bird.ts` — Missing 24h window, discard logging
- `src/types/index.ts` — RawItem type definition (lines 89-99), RawItemMetadata (lines 139-160)
- `src/pipeline/collect.ts` — CollectSourceEvent interface (lines 8-14), adapter orchestration
- `src/utils/logger.ts` — Logger class with `warn()` and `info()` methods accepting structured data

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (D-01 through D-09) — user-locked implementation constraints

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project code
- Architecture: HIGH — RSS adapter provides clear template
- Pitfalls: HIGH — identified from code inspection

**Research date:** 2026-03-31
**Valid until:** 30 days (stable domain, no fast-moving libraries)
