# Phase 4: Pipeline Robustness - Discussion Log

**Phase:** 04-pipeline-robustness
**Date:** 2026-03-31
**Mode:** discuss

---

## Area 1: Transaction scope

**Question:** Should archiveContentItems also be wrapped in a transaction, or only the meta-level ops (syncTopicsToPrisma, upsertSourcesBatch)?

**Options presented:**
1. All three in one transaction (Recommended) — syncTopicsToPrisma + upsertSourcesBatch + archiveContentItems = single atomic unit. Simplest, strongest guarantees.
2. Meta ops only — Only syncTopicsToPrisma + upsertSourcesBatch get transaction wrapping. archiveContentItems stays as-is (already skipDuplicates safe).

**Selection:** All three in one transaction (Recommended)

**Notes:** User confirmed the recommended option.

---

## Area 2: Retry strategy

**Question:** Which operations should have retry logic for transient failures?

**Options presented:**
1. Prisma writes only (Recommended) — Retry 3x for DB connection issues. Source collection (RSS/X) already has per-source error handling via failedSources array.
2. Both Prisma and collection — Retry 3x for both DB operations and external source fetches (RSS/JSON Feed/website/X). More resilient but adds latency.

**Selection:** Prisma writes only (Recommended)

**Notes:** User confirmed the recommended option.

---

## Area 3: Error log detail

**Question:** How detailed should failure logs be for manual re-run?

**Options presented:**
1. Rich structured logs (Recommended) — Include: sourceId, source URL, sourceKind, error type, error message, timestamp, retry count. Full context for debugging.
2. Minimal (sourceId + error) — Just sourceId and error message. Simpler logs, less verbosity.

**Selection:** Rich structured logs (Recommended)

**Notes:** User confirmed the recommended option.

---

## Summary

All three gray areas resolved with recommended options. Phase 4 scope is now fully specified:
- Transaction: all three ops in one `$transaction`
- Retry: Prisma writes only, 3x with exponential backoff (100ms, 200ms, 400ms)
- Error logs: rich structured format with full context for debugging

