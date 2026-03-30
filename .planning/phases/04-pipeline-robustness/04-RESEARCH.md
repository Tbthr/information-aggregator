# Phase 4: Pipeline Robustness - Research

**Researched:** 2026-03-31
**Domain:** Prisma transaction wrapping, retry logic, structured error logging
**Confidence:** HIGH

## Summary

Phase 4 adds fault tolerance to the collection pipeline's Prisma batch operations. The core change is wrapping `syncTopicsToPrisma` (step 2), `upsertSourcesBatch` (step 3), and `archiveContentItems` (step 10) in a single Prisma `$transaction` in `runCollectJob()`. Source collection errors (RSS/JSON/website/X failures) are NOT retried since they already have per-source `failedSources` tracking. Retry logic applies only to transient Prisma errors (deadlock P2034, connection P1000/P1001/P1002, timeout P2024). Structured error logs use the existing `src/utils/logger.ts` infrastructure with error types: `"PrismaError" | "NetworkError" | "ValidationError" | "Unknown"`.

**Primary recommendation:** Implement a `withPrismaRetry` wrapper function that encapsulates exponential backoff (100ms, 200ms, 400ms) and classifies errors by type. Wrap steps 2+3+10 in `prisma.$transaction(async (tx) => {...})` in `runCollectJob()`. Keep `recordSourcesSuccessBatch` and `recordSourceFailure` outside the transaction as fire-and-forget health updates.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `syncTopicsToPrisma` + `upsertSourcesBatch` + `archiveContentItems` wrapped in a single Prisma `$transaction`
- **D-02:** If any operation in the transaction fails, entire job rolls back — no partial state
- **D-03:** Transaction wrapper added to `runCollectJob()` in `src/pipeline/run-collect-job.ts` — wrap steps 2 (syncTopicsToPrisma), 3 (upsertSourcesBatch), and 10 (archiveContentItems) together
- **D-04:** Retry up to 3 times for transient Prisma failures (connection issues, timeouts, deadlocks)
- **D-05:** Exponential backoff: 100ms, 200ms, 400ms between retries
- **D-06:** Source collection errors (RSS/JSON Feed/website/X) are NOT retried — already handled by per-source `failedSources` array and `recordSourceFailure()`
- **D-07:** Failed operations log structured data: `{ sourceId, sourceUrl, sourceKind, errorType, errorMessage, timestamp, retryCount }`
- **D-08:** `errorType` categorization: `"PrismaError" | "NetworkError" | "ValidationError" | "Unknown"`
- **D-09:** Logs go to existing `src/utils/logger.ts` infrastructure (not console.error)
- **D-10:** `BATCH_SIZE = 30` constant in `upsert-content-prisma.ts` remains unchanged
- **D-11:** `archiveContentItems` query-before-write pattern stays the same, just wrapped in transaction
- **D-12:** `recordSourcesSuccessBatch` and `recordSourceFailure` called AFTER main transaction commits (step 11-12 in `runCollectJob`) — fire-and-forget health updates, not part of rollback unit

### Deferred Ideas

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| (cross-cutting) | Transaction rollback for all Prisma batch ops | `prisma.$transaction()` API confirmed; `archiveContentItems` uses multiple Prisma calls that need tx context |
| (cross-cutting) | Retry logic for transient failures | Prisma error codes P2034 (deadlock), P2024 (timeout), P1000-P1002 (connection) are transient; exponential backoff 100/200/400ms confirmed |
| (cross-cutting) | Rich structured error logs | `logger.error()` supports structured `data` object; error type classification confirmed |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.19.2 | ORM with transaction support | Already in use; `$transaction` is the standard way to batch operations atomically |
| `src/utils/logger.ts` | existing | Structured logging | Already in codebase; `logger.error()` accepts `data` object for structured fields |

### No New Dependencies Required

This phase uses only existing infrastructure. No new packages needed.

## Architecture Patterns

### Recommended Project Structure

No new files required. Changes are confined to:
- `src/pipeline/run-collect-job.ts` — add transaction wrapper and retry logic at steps 2+3+10
- `src/archive/upsert-content-prisma.ts` — modify `syncTopicsToPrisma`, `upsertSourcesBatch`, `archiveContentItems` to accept optional `tx` transaction client
- `src/utils/` — add `retry.ts` for `withPrismaRetry` wrapper

### Pattern 1: Prisma Transaction Wrapper

**What:** Wraps multiple Prisma operations in a single atomic transaction.

**When to use:** Steps 2+3+10 in `runCollectJob` must all succeed or all roll back.

**Implementation approach:**
```typescript
// run-collect-job.ts — wrap steps 2+3+10
const result = await prisma.$transaction(async (tx) => {
  // Step 2: syncTopicsToPrisma (pass tx)
  await syncTopicsToPrisma(packRecords, tx);
  // Step 3: upsertSourcesBatch (pass tx)
  await upsertSourcesBatch(allSources, tx);
  // Step 10: archiveContentItems (pass tx)
  const archiveResult = await archiveContentItems(archiveInput, tx);
  return archiveResult;
}, { timeout: 30000 });
```

**Key constraint:** All three functions must accept an optional `tx` parameter to use the transaction client when provided.

### Pattern 2: Transaction-Capable Batch Functions

**What:** `syncTopicsToPrisma`, `upsertSourcesBatch`, and `archiveContentItems` accept an optional `tx` parameter.

**Signature change pattern:**
```typescript
// Before
export async function archiveContentItems(items: ContentArchiveInput[]): Promise<ContentArchiveResult>

// After — accepts optional tx for transaction participation
export async function archiveContentItems(
  items: ContentArchiveInput[],
  tx?: Prisma.TransactionClient
): Promise<ContentArchiveResult> {
  const client = tx ?? prisma;
  // Use client instead of prisma throughout
  const existingContents = await client.content.findMany({...});
  await client.content.createMany({...});
  // etc.
}
```

Same pattern for `syncTopicsToPrisma` and `upsertSourcesBatch`.

### Pattern 3: Retry with Exponential Backoff

**What:** `withPrismaRetry(fn, options?)` wraps a Prisma operation with retry logic.

**When to use:** Only Prisma write operations; NOT source collection (already has per-source error tracking).

**Implementation approach:**
```typescript
// src/utils/retry.ts
export interface RetryOptions {
  maxAttempts?: number;  // default 3
  baseDelayMs?: number;  // default 100
}

export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 100 } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      if (!isTransientPrismaError(err)) throw err; // surface immediately
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  throw lastError;
}

function isTransientPrismaError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034: Transaction nature conflict (deadlock)
    // P2024: Connection timeout
    // P1000, P1001, P1002: Connection errors
    return ["P2034", "P2024", "P1000", "P1001", "P1002"].includes(err.code);
  }
  return false;
}
```

**Backoff schedule:** Attempt 1 fails → wait 100ms. Attempt 2 fails → wait 200ms. Attempt 3 fails → throw.

### Pattern 4: Structured Error Logging

**What:** Failed operations log structured data via `logger.error()`.

**Log entry structure (D-07):**
```typescript
logger.error("Pipeline batch operation failed", {
  sourceId: "...",
  sourceUrl: "...",
  sourceKind: "rss",
  errorType: "PrismaError", // "PrismaError" | "NetworkError" | "ValidationError" | "Unknown"
  errorMessage: "...",
  timestamp: new Date().toISOString(),
  retryCount: 0,
});
```

**Error type classification (D-08):**
| Error Type | Trigger | Retry? |
|------------|---------|--------|
| `PrismaError` | Prisma known request error with transient code (P2034, P2024, P1000-P1002) | Yes |
| `NetworkError` | Connection failure, DNS failure, ECONNREFUSED | Yes |
| `ValidationError` | Prisma validation error (P2006, P2013) or similar | No |
| `Unknown` | Anything else | No |

### Anti-Patterns to Avoid

- **Wrapping source collection in transaction:** Source collection (step 5) failures are already tracked per-source via `failedSources` array and `recordSourceFailure()`. Adding transaction retry would complicate this.
- **Retrying source collection errors:** D-06 explicitly forbids retrying source collection errors. These are handled by the existing `onSourceEvent` callback and `failedSources` tracking.
- **Including health updates in transaction:** `recordSourcesSuccessBatch` and `recordSourceFailure` (steps 11-12) must remain outside the transaction (D-12). They are fire-and-forget updates.
- **Logging sensitive data:** Use `logger.maskSensitiveUrl()` from `src/utils/logger.ts` if source URLs contain tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential backoff | Custom sleep + loop | `withPrismaRetry` wrapper | Standard pattern; correctly handles interruption |
| Transaction rollback | Manual try/catch + rollback logic | `prisma.$transaction()` | Prisma handles automatic rollback on thrown error |
| Structured error logs | `console.error()` with string concatenation | `logger.error()` with data object | Already in codebase; supports JSON/text format via env |

**Key insight:** Prisma's `$transaction` API already handles rollback on throw. Do NOT catch errors inside the transaction callback — let them propagate so Prisma can roll back.

## Runtime State Inventory

> Skip — Phase 4 is purely code-level robustness (transactions, retries, logging). No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

## Common Pitfalls

### Pitfall 1: Transaction timeout
**What goes wrong:** `archiveContentItems` with large content batches (hundreds of items) may exceed default Prisma transaction timeout (5 seconds).
**Why it happens:** The transaction wraps steps 2+3+10, and step 10 (`archiveContentItems`) does a pre-write query (`findMany`) + batch creates + batch updates. Large batches take time.
**How to avoid:** Pass `{ timeout: 30000 }` (30 seconds) to `$transaction`. The `archiveContentItems` already uses `BATCH_SIZE = 30` which limits individual batches.
**Warning signs:** `PrismaClientValidationError` or timeout errors in logs.

### Pitfall 2: Non-transient errors swallowed by retry
**What goes wrong:** A validation error (P2006: invalid value for field type) would be caught by retry logic and retried 3 times before surfacing.
**Why it happens:** `isTransientPrismaError` must correctly distinguish transient from non-transient error codes.
**How to avoid:** Only retry codes in `["P2034", "P2024", "P1000", "P1001", "P1002"]`. All other errors (validation P2006, not found P2025, unique constraint P2002) should throw immediately.

### Pitfall 3: Logging at wrong level
**What goes wrong:** Using `logger.info` for failures means logs may be silently omitted in production (if `LOG_LEVEL=WARN`).
**Why it happens:** `logger` level filtering by `LOG_LEVEL` env var.
**How to avoid:** Always use `logger.error()` for failure conditions, never `logger.warn` or `logger.info`.

### Pitfall 4: Transaction callback returning non-serializable
**What goes wrong:** Returning a non-Promise value from `$transaction` callback that includes unexecuted queries.
**Why it happens:** Prisma lazy-evaluates queries in some contexts.
**How to avoid:** Ensure all Prisma calls inside transaction callback use `await`. The `archiveResult` return from `archiveContentItems` already awaits all operations.

## Code Examples

### Modifying `archiveContentItems` for Transaction Participation

```typescript
// upsert-content-prisma.ts — add tx parameter
import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export async function archiveContentItems(
  items: ContentArchiveInput[],
  tx?: TxClient
): Promise<ContentArchiveResult> {
  const client = tx ?? prisma;

  if (items.length === 0) {
    return { newCount: 0, updateCount: 0, totalCount: 0, newContentIds: [] };
  }

  const allUrls = items.map((i) => i.url);
  const existingContents = await client.content.findMany({
    where: { url: { in: allUrls } },
    select: { id: true, url: true, topicIds: true },
  });
  // ... rest of implementation using `client` instead of `prisma`
}
```

### Modifying `syncTopicsToPrisma` for Transaction Participation

```typescript
export async function syncTopicsToPrisma(
  topics: Array<{...}>,
  tx?: TxClient
): Promise<void> {
  const client = tx ?? prisma;
  if (topics.length === 0) return;
  const upsertPromises = topics.map((topic) =>
    client.topic.upsert({...})
  );
  for (let i = 0; i < upsertPromises.length; i += BATCH_SIZE) {
    const batch = upsertPromises.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }
}
```

### Modifying `upsertSourcesBatch` for Transaction Participation

```typescript
export async function upsertSourcesBatch(
  sources: Array<{...}>,
  tx?: TxClient
): Promise<void> {
  const client = tx ?? prisma;
  // ... existing implementation, replace all `prisma.` with `client.`
}
```

### Transaction Wrapper in `runCollectJob`

```typescript
// run-collect-job.ts — steps 2+3+10 in transaction
const archiveResult = await prisma.$transaction(
  async (tx) => {
    // Step 2: syncTopicsToPrisma
    await syncTopicsToPrisma(packRecords, tx);

    // Step 3: upsertSourcesBatch
    await upsertSourcesBatch(allSources, tx);

    // Step 10: archiveContentItems
    const result = await archiveContentItems(archiveInput, tx);
    return result;
  },
  { timeout: 30000 } // 30s timeout for large batches
);
```

### Retry Wrapper

```typescript
// src/utils/retry.ts
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 100 } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      if (!isTransientPrismaError(err)) throw err;
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  throw lastError;
}
```

### Structured Error Logging

```typescript
// In runCollectJob or retry wrapper, on final failure:
logger.error("Pipeline batch operation failed", {
  sourceId: sourceId ?? "unknown",
  sourceUrl: sourceUrl ?? "unknown",
  sourceKind: sourceKind ?? "unknown",
  errorType: classifyError(error),
  errorMessage: error instanceof Error ? error.message : String(error),
  timestamp: new Date().toISOString(),
  retryCount: attempt - 1,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No transaction wrapping | `$transaction` wraps steps 2+3+10 | Phase 4 | Partial state impossible; all-or-nothing semantics |
| No retry logic | `withPrismaRetry` with exponential backoff | Phase 4 | Transient failures (deadlocks, timeouts) auto-recover |
| String-concatenated error logs | Structured `logger.error()` with typed fields | Phase 4 | Easier log aggregation and alerting |

**Deprecated/outdated:**
- Fire-and-forget Prisma writes without transaction: No longer acceptable after Phase 4 — all batch writes must be in a transaction.

## Open Questions

1. **What happens to `candidates` array if transaction rolls back?**
   - The `candidates` build (step 10a) happens BEFORE `archiveContentItems`. If the transaction rolls back after step 10b, `candidates` would be stale.
   - Recommendation: Move `candidates` build to happen after successful archival, or accept that candidates reflect the dedup output regardless of archival outcome.

2. **Should `recordSourceFailure` itself retry?**
   - D-12 says these are fire-and-forget health updates outside the transaction. If `recordSourceFailure` fails, it should not cause the job to fail.
   - Recommendation: Wrap steps 11-12 in `Promise.allSettled` to ensure failures don't propagate.

3. **Does `archiveContentItems` need to change its internal batching behavior within a transaction?**
   - Within a transaction, multiple round-trips to the database are made (findMany, createMany, findMany again for new IDs, updateMany). Each `await` is a separate database call within the transaction.
   - The `BATCH_SIZE = 30` and the query-before-write pattern remain unchanged (D-10, D-11).

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely code changes (transaction wrapping, retry logic, structured logging) with no external tool dependencies beyond those already in the project.

## Validation Architecture

> This section is intentionally brief as Phase 4 is cross-cutting infrastructure. Validation is performed through the existing diagnostics framework (`scripts/diagnostics.ts`) after Phase 4 changes are deployed.

### Test Approach

| What to Verify | How | Pass Criterion |
|----------------|-----|----------------|
| Transaction rollback on failure | Mock one of the three ops to throw; verify all three roll back | No partial records in DB |
| Retry on transient Prisma error | Mock Prisma to throw P2034 twice then succeed | 3rd attempt succeeds |
| No retry on validation error | Mock Prisma to throw P2006 | Immediate error, no retries |
| Structured error log format | Trigger failure; inspect log output | Log contains sourceId, errorType, timestamp, retryCount |
| Health updates outside transaction | Verify `recordSourcesSuccessBatch` not in transaction | Health updates succeed even if archival rolls back |

### L5 Full E2E Still Valid
After Phase 4 changes, running `npx tsx scripts/diagnostics.ts full --run-collection --cleanup` (L5 from CLAUDE.md) remains the authoritative end-to-end validation. All Phase 4 changes are backwards-compatible with existing diagnostics.

## Sources

### Primary (HIGH confidence)
- Prisma 6.19.2 `$transaction` API — standard Prisma documentation
- `src/utils/logger.ts` — confirmed existing logger with structured `data` support
- `src/archive/upsert-content-prisma.ts` — confirmed batch operation functions to modify
- `src/pipeline/run-collect-job.ts` — confirmed transaction wrapper insertion point

### Secondary (MEDIUM confidence)
- Prisma error code classification (P2034, P2024, P1000-P1002) — standard Prisma error reference, confirmed via Prisma docs

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — only uses existing Prisma + logger infrastructure
- Architecture: HIGH — `prisma.$transaction` + retry wrapper is canonical pattern
- Pitfalls: HIGH — all pitfalls identified from existing codebase patterns

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, Prisma transaction API has been stable for years)
