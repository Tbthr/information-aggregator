---
phase: "04"
plan: "02"
subsystem: pipeline-robustness
tags: [prisma, retry, transaction, archive, structured-logging]
dependency_graph:
  requires:
    - src/utils/retry.ts: withPrismaRetry, classifyError (from 04-01)
    - src/archive/upsert-content-prisma.ts: tx-aware batch functions (from 04-01)
  provides:
    - src/pipeline/run-collect-job.ts: transaction-wrapped pipeline with retry
tech_stack:
  added: []
  patterns:
    - Transaction wrapper with 30s timeout around sync+archive operations
    - Exponential backoff retry (3 attempts, 100/200/400ms) via withPrismaRetry
    - Structured error logging with sourceId/sourceUrl/sourceKind/errorType/errorMessage/timestamp/retryCount
    - Error annotation with retryCount for accurate retry counting in logs
key_files:
  modified:
    - src/pipeline/run-collect-job.ts: transaction wrapper, retry, structured error logging
decisions:
  - "Restructured transaction block to run AFTER steps 4-9 to satisfy data dependency (archiveInput built from afterNear)"
  - "firstSource used as context for error logging since allSources[0] is available before steps 4-9 run"
metrics:
  duration_seconds: 250
  completed: "2026-03-30T21:23:11Z"
  tasks_completed: 3
  commits: 3
---

# Phase 04 Plan 02: Pipeline Robustness — Transaction Wrapper & Structured Error Logging

**Wire transaction wrapping, retry logic, and structured error logging into runCollectJob.**

## One-liner

Transaction-wrapped sync+archive pipeline (steps 2+3+10) with withPrismaRetry, 30s timeout, and structured error logging with sourceId/sourceUrl/sourceKind/errorType/errorMessage/timestamp/retryCount.

## What Was Built

### Task 1: Add imports
Added two imports to `src/pipeline/run-collect-job.ts`:
- `import { prisma } from "../../lib/prisma"` — needed for `prisma.$transaction`
- `import { withPrismaRetry, classifyError } from "../utils/retry"` — retry wrapper and error classifier

### Task 2: Wrap steps 2+3+10 in transaction with retry

**Code structure** (steps 4-9 run first to produce `afterNear`, then archiveInput is built, then the transaction wraps steps 2+3+10):

```typescript
// archiveInput built from afterNear (steps 4-9 output) — BEFORE transaction
let archiveResult: { newCount: number; updateCount: number } = { newCount: 0, updateCount: 0 };

try {
  archiveResult = await withPrismaRetry(
    async () => {
      return await prisma.$transaction(
        async (tx) => {
          await syncTopicsToPrisma(packRecords, tx);      // Step 2
          await upsertSourcesBatch(allSources, tx);       // Step 3
          const result = await archiveContentItems(archiveInput, tx);  // Step 10
          return { newCount: result.newCount, updateCount: result.updateCount };
        },
        { timeout: 30000 }  // 30s timeout for large batches
      );
    },
    { maxAttempts: 3, baseDelayMs: 100 }  // exponential backoff: 100, 200, 400ms
  );
} catch (err) {
  const firstSource = allSources[0];
  const annotatedErr = err as { retryCount?: number };
  logger?.error("Pipeline batch operation failed", {
    sourceId: firstSource?.id ?? "unknown",
    sourceUrl: firstSource?.url ?? "unknown",
    sourceKind: firstSource?.kind ?? "unknown",
    errorType: classifyError(err),
    errorMessage: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString(),
    retryCount: annotatedErr.retryCount ?? 0,
  });
  throw err;
}
```

### Task 3: Post-transaction code correctly uses archiveResult
All references to `archiveResult` after the transaction block use the outer variable set by the transaction return value. The `counts.archivedNew`, `counts.archivedUpdated`, and `archived` return fields all correctly reference `archiveResult.newCount` and `archiveResult.updateCount`.

## Verification

| Check | Result |
|-------|--------|
| `pnpm check` (TypeScript) | PASS |
| `prisma.$transaction` present | PASS (line 360) |
| `withPrismaRetry` wraps transaction | PASS (line 358) |
| `syncTopicsToPrisma(packRecords, tx)` | PASS (line 363) |
| `upsertSourcesBatch(allSources, tx)` | PASS (line 366) |
| `archiveContentItems(archiveInput, tx)` | PASS (line 369) |
| `classifyError(err)` in catch | PASS (line 387) |
| `logger?.error` with all 7 structured fields | PASS (lines 383-391) |
| `retryCount: annotatedErr.retryCount ?? 0` | PASS (line 390) |
| `recordSourcesSuccessBatch` outside tx | PASS (line 411) |
| `recordSourceFailure` outside tx | PASS (line 400) |

## Commits

- `5478348` feat(04-02): add prisma and retry imports to run-collect-job.ts
- `39c0652` feat(04-02): wrap steps 2+3+10 in prisma transaction with retry and structured error logging
- `1c5bde0` fix(04-02): restructure transaction block after steps 4-9 to fix data dependency

## Deviations from Plan

**Rule 3 - Auto-fixed blocking issue: Data dependency required restructuring**

- **Found during:** Task 2 implementation
- **Issue:** The plan's example showed `archiveInput` available inside the transaction block at the position of steps 2+3. However, `archiveInput` is built from `afterNear` which is the output of steps 4-9 (collection through near-dedup). In the original code structure, steps 4-9 ran AFTER the transaction position in the plan.
- **Fix:** Restructured so steps 4-9 run FIRST to produce `afterNear`, then `archiveInput` is built, then the transaction wraps steps 2+3+10. This is the only valid topological ordering that satisfies the data dependencies while keeping all three operations in one transaction.
- **Files modified:** src/pipeline/run-collect-job.ts
- **Commits:** 39c0652, 1c5bde0

## Auto-Fixed Issues

None beyond the structural restructuring.

## Notes

- The data dependency issue (archiveInput depends on afterNear from steps 4-9) was not apparent in the plan's example because the example showed the transaction block in isolation without showing where archiveInput comes from. This was auto-fixed per Rule 3.
- `firstSource` is used as the context for error logging because `allSources[0]` is computed as part of step 3 preparation before steps 4-9 run, making it available for the catch block.
- `recordSourcesSuccessBatch` and `recordSourceFailure` remain at steps 11-12, outside the transaction, per D-12 decision.
- Phase 04 (pipeline-robustness) is now COMPLETE — all 4 plans from both waves have been executed.
