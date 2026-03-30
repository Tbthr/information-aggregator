# Phase 2: Pipeline Field Quality Audit - Discussion Log

**Date:** 2026-03-31
**Phase:** 02-pipeline-field-quality-audit

---

## Discussion 1: Website Adapter Discard Logging

**Area:** Website adapter discard logging
**Question:** How should website adapter discards be handled?
**Options presented:**
1. Add same discard logging as RSS (recommended — consistent with RSS/JSON Feed pattern)
2. No discard logging needed — Website is a fallback; low volume, no need to log

**User selected:** "Add same discard logging as RSS"

---

## Discussion 2: 24h Window for X/Bird

**Area:** 24h window for X/Bird
**Question:** Should X/Bird apply 24h window filtering like RSS/JSON Feed?
**Options presented:**
1. Yes, apply 24h window (recommended — consistent filtering)
2. No window — fetch all (X/Bird is social feed; users may want historical content for weekly reports)
3. Configurable per source

**User selected:** "Yes, apply 24h window"

---

## Discussion 3: Discard Rate Metric

**Area:** Discard rate metric
**Question:** How should discard rate be logged per source?
**Options presented:**
1. Per-source summary after collection (recommended — engineer can detect abnormal patterns)
2. Keep individual warn logs only
3. Add to existing CollectSourceEvent

**User selected:** "Per-source summary after collection"

---

## Discussion 4: Complete RawItem Definition

**Area:** Complete RawItem
**Question:** What does 'complete RawItem' mean for all four adapters?
**Options presented:**
1. Minimal: id, sourceId, title, url, fetchedAt, metadataJson (only required RawItem fields)
2. Extended: also author + content fields (X/Bird produces these; add to all adapters for consistency)
3. Claude decides

**User selected:** "Extended: also author + content fields"

---

## Discussion 5: Author Field

**Area:** Author field
**Question:** Should RSS/JSON Feed/Website adapters add top-level 'author' field?
**Options presented:**
1. Yes, add top-level author (consistent with X/Bird; author stored in metadataJson AND as top-level field)
2. No — keep in metadataJson only

**User selected:** "Yes, add top-level author"

---

## Discussion 6: Relative Timestamp Detection

**Area:** Relative timestamp handling
**Question:** Should X/Bird and Website adapters have relative timestamp detection like RSS/JSON Feed?
**Options presented:**
1. Yes, add relative timestamp detection (recommended)
2. No — only RSS/JSON Feed need it
3. Claude decides

**User selected:** "Claude decides" (downstream agents may add if needed for data quality)

---

## Summary

| Area | Decision |
|------|----------|
| Website discard logging | Add same discard logging as RSS |
| X/Bird 24h window | Yes, apply 24h window |
| Discard rate metric | Per-source summary after collection |
| Complete RawItem | Extended: author + content fields for all adapters |
| Author field | Yes, add top-level author |
| Relative timestamp | Claude decides |

