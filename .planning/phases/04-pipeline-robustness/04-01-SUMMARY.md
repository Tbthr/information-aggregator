---
phase: "04"
plan: "01"
subsystem: pipeline-robustness
tags: [prisma, retry, transaction, archive]
dependency_graph:
  requires: []
  provides:
    - src/utils/retry.ts: withPrismaRetry, isTransientPrismaError, sleep, classifyError
    - src/archive/upsert-content-prisma.ts: tx-aware batch operations
  affects:
    - src/pipeline/run-collect-job.ts (will use withPrismaRetry in 04-02)
tech_stack:
  added:
    - "@prisma/client": TransactionClient type
  patterns:
    - Exponential backoff retry with jitter-free fixed powers of 2
    - Transaction client passthrough (tx ?? prisma)
    - Error annotation with retryCount for structured logging
key_files:
  created:
    - src/utils/retry.ts: withPrismaRetry wrapper, isTransientPrismaError, sleep, classifyError
  modified:
    - src/archive/upsert-content-prisma.ts: archiveContentItems, syncTopicsToPrisma, upsertSourcesBatch now accept optional tx parameter
decisions:
  - "Used block-scoped retryCount variable instead of attempt loop counter to avoid TypeScript block-scoping issues"
  - "P2003 (foreign key) treated as non-transient — will be handled in a separate plan"
metrics:
  duration_seconds: 181
  completed: "2026-03-30T21:18:18Z"
  tasks_completed: 4
  commits: 2
---

# Phase 04 Plan 01: Pipeline Robustness — Retry & Transaction Foundation

**Retry utility wrapper and tx-aware batch functions for the collection pipeline.**

## One-liner

`withPrismaRetry` exponential backoff wrapper (3 attempts, 100/200/400ms) + transaction-capable batch functions in upsert-content-prisma.

## What Was Built

### Task 1: `src/utils/retry.ts` (new file)
Created retry utility module with four exports:

- `sleep(ms)` — Promise-based delay for backoff
- `isTransientPrismaError(err)` — returns true for P2034 (deadlock), P2024 (timeout), P1000/P1001/P1002 (connection errors). All other codes (P2006 validation, P2002 unique constraint, P2025 not found, P2003 FK) return false — surfaced immediately without retry.
- `withPrismaRetry<T>(fn, options?)` — wraps any async function. Retries up to 3 times with exponential backoff (100ms, 200ms, 400ms). Non-transient errors propagate immediately. On final failure, annotates thrown error with `retryCount = attempt - 1` for structured logging.
- `classifyError(err)` — returns `"PrismaError" | "NetworkError" | "ValidationError" | "Unknown"` for log categorization.

### Tasks 2-4: `src/archive/upsert-content-prisma.ts` modifications

Three batch functions updated to accept optional `tx?: Prisma.TransactionClient` and use `const client = tx ?? prisma`:

- `archiveContentItems(items, tx?)` — all `prisma.content.findMany/createMany/update` replaced with `client.content.*`
- `syncTopicsToPrisma(topics, tx?)` — all `prisma.topic.upsert` replaced with `client.topic.upsert`
- `upsertSourcesBatch(sources, tx?)` — all `prisma.source.findMany/upsert` replaced with `client.source.*`

Functions remain fully backwards-compatible: calling without `tx` argument uses the global prisma singleton.

## Verification

| Check | Result |
|-------|--------|
| `pnpm check` (TypeScript) | PASS |
| All 4 exports in retry.ts | PASS |
| isTransientPrismaError codes P2034/P2024/P1000/P1001/P1002 = true | PASS |
| isTransientPrismaError codes P2006/P2025/P2002 = false | PASS |
| withPrismaRetry annotates thrown errors with retryCount | PASS |
| archiveContentItems tx param + client.content calls | PASS |
| syncTopicsToPrisma tx param + client.topic calls | PASS |
| upsertSourcesBatch tx param + client.source calls | PASS |
| No bare `prisma.` calls in three modified functions | PASS |

## Commits

- `4693603` feat(04-01): add withPrismaRetry wrapper and retry utilities
- `85a4494` feat(04-01): make archive batch functions tx-aware for transaction participation

## Deviations from Plan

None — plan executed exactly as written.

## Auto-Fixed Issues

None encountered.

## Notes

- retryCount implementation uses a separate `retryCount` variable rather than `attempt - 1` after loop exit to avoid TypeScript block-scoping issues with `let` in for-loop headers.
- P2003 (foreign key constraint) was intentionally NOT included in transient error list — foreign key violations indicate data integrity issues that should not be retried blindly.
- These changes are prerequisites for 04-02 which wires retry logic into runCollectJob and wraps archive calls in explicit transactions.
