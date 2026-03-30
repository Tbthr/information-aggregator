---
phase: 02-pipeline-field-quality-audit
plan: "01"
type: execute
subsystem: pipeline
tags:
  - website-adapter
  - discard-logging
  - rawitem-extension
  - field-quality
dependency_graph:
  requires: []
  provides:
    - PIPELINE-01
  affects:
    - src/adapters/website.ts
    - src/types/index.ts
tech_stack:
  added: []
  patterns:
    - Website adapter discard logging follows RSS/JSON Feed pattern
    - RawItem extended with optional top-level author/content fields
key_files:
  created: []
  modified:
    - src/types/index.ts
    - src/adapters/website.ts
decisions:
  - "RawItem author and content fields are optional (?:) to maintain backward compatibility"
  - "Website adapter uses itemFetched flag (not undefined items.length) for discard summary"
  - "Discard summary uses 1+discardCount denominator since at most one item can be fetched per call"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-30"
---

# Phase 02 Plan 01 Summary: Website Adapter Fix + RawItem Extension

## Objective

Fix the Website adapter's silently discarding behavior and extend the RawItem type with top-level author and content fields.

## Completed Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Extend RawItem type with author and content fields | 6e3d07f | src/types/index.ts |
| 2 | Fix Website adapter - discard logging, author/content, summary | dc65cfb | src/adapters/website.ts |
| 3 | Verify TypeScript compilation | - | - |

## Truths Achieved

- [x] Website adapter logs each discarded item with reason (sourceId, title, url, discardReason)
- [x] Website adapter emits top-level author and content fields on RawItem
- [x] Website adapter logs a per-source discard summary after collection
- [x] RawItem type includes `author?: string` and `content?: string` fields

## Key Changes

### src/types/index.ts

Extended `RawItem` interface (lines 97-98) with two optional fields:

```typescript
author?: string;        // Top-level author field (D-06)
content?: string;       // Top-level content field (D-07)
```

### src/adapters/website.ts

Four changes made to `parseWebsiteItems()`:

1. **Discard tracking variables** (lines 77-78):
   ```typescript
   let discardCount = 0;
   let itemFetched = false;
   ```

2. **Discard logging for 3 cases** (lines 91-127):
   - `Discarding item outside 24h window` - when `parsed < cutoffTime`
   - `Discarding item with unparseable publishedTime` - when `isNaN(parsed.getTime())`
   - `Discarding item without publishedTime` - when no `publishedTime` attribute

3. **Top-level author and content fields** (lines 144-145):
   ```typescript
   author: author,           // D-06: top-level author field
   content: content,         // D-07: top-level content field
   ```

4. **Discard summary** (lines 161-168):
   ```typescript
   logger.info("Source fetch completed", {
     sourceId,
     sourceType: "website",
     fetched: itemFetched ? 1 : 0,
     discarded: discardCount,
     discardRate: itemFetched || discardCount > 0
       ? `${((discardCount / (1 + discardCount)) * 100).toFixed(1)}%`
       : "0%",
   });
   ```

## Verification Results

| Check | Result |
|-------|--------|
| `grep "author?: string" src/types/index.ts` | Found at line 97 |
| `grep "content?: string" src/types/index.ts` | Found at line 98 |
| `grep "Discarding item outside 24h window" src/adapters/website.ts` | Found at line 92 |
| `grep "Discarding item without publishedTime" src/adapters/website.ts` | Found at line 118 |
| `grep "Discarding item with unparseable publishedTime" src/adapters/website.ts` | Found at line 105 |
| `grep "Source fetch completed" src/adapters/website.ts` | Found at line 161 |
| `grep "author: author" src/adapters/website.ts` | Found at line 144 |
| `grep "content: content" src/adapters/website.ts` | Found at line 145 |
| `pnpm check` | PASSED (exit 0) |

## Commits

- `6e3d07f` feat(02-01): extend RawItem with author and content fields
- `dc65cfb` feat(02-01): fix Website adapter discard logging and add author/content fields

## Self-Check: PASSED

All files created/modified exist on disk. All commit hashes verified in git log.
