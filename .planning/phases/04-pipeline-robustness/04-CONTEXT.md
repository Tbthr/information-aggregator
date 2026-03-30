# Phase 4: Pipeline Robustness - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline batch operations fail safely with transaction rollback, retry logic, and actionable error logs. This phase covers transaction wrapping for all Prisma batch operations, retry logic for transient failures, and rich structured error logging.

</domain>

<decisions>
## Implementation Decisions

### Transaction scope — all three ops in one transaction
- **D-01:** `syncTopicsToPrisma` + `upsertSourcesBatch` + `archiveContentItems` wrapped in a single Prisma `$transaction`
- **D-02:** If any operation in the transaction fails, the entire job rolls back — no partial state
- **D-03:** Transaction wrapper added to `runCollectJob()` in `src/pipeline/run-collect-job.ts` — wrap steps 2 (syncTopicsToPrisma), 3 (upsertSourcesBatch), and 10 (archiveContentItems) together

### Retry behavior — Prisma writes only
- **D-04:** Retry up to 3 times for transient Prisma failures (connection issues, timeouts, deadlocks)
- **D-05:** Exponential backoff: 100ms, 200ms, 400ms between retries
- **D-06:** Source collection errors (RSS/JSON Feed/website/X) are NOT retried — already handled by per-source `failedSources` array and `recordSourceFailure()`

### Error log detail — rich structured logs
- **D-07:** Failed operations log structured data: `{ sourceId, sourceUrl, sourceKind, errorType, errorMessage, timestamp, retryCount }`
- **D-08:** `errorType` categorization: `"PrismaError" | "NetworkError" | "ValidationError" | "Unknown"`
- **D-09:** Logs go to the existing `src/utils/logger.ts` infrastructure (not console.error)

### Key implementation notes
- **D-10:** The `BATCH_SIZE = 30` constant in `upsert-content-prisma.ts` remains unchanged
- **D-11:** `archiveContentItems` query-before-write pattern (find existing → separate new/update → batch create + batch update) stays the same, just wrapped in transaction
- **D-12:** `recordSourcesSuccessBatch` and `recordSourceFailure` are called AFTER the main transaction commits (step 11-12 in `runCollectJob`) — these are fire-and-forget health updates, not part of the rollback unit

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 scope
- `.planning/ROADMAP.md` §Phase 4 — Success Criteria (4 items: transaction rollback, retry logic, error logs, $transaction wrapping)
- `.planning/REQUIREMENTS.md` — No new requirements (cross-cutting phase)

### Existing code (read before implementing)
- `src/archive/upsert-content-prisma.ts` — All batch ops: `syncTopicsToPrisma` (L161-205), `upsertSourcesBatch` (L210-294), `archiveContentItems` (L50-154)
- `src/pipeline/run-collect-job.ts` — `runCollectJob()` orchestrates all pipeline steps; transaction wrapper goes here
- `src/utils/logger.ts` — Existing structured logger; use `logger.error()` for failure logs

### Prior phase context
- `.planning/phases/02-pipeline-field-quality-audit/02-CONTEXT.md` — Discard logging format established
- `.planning/phases/03-topic-configuration-ai-optimization/03-CONTEXT.md` — D-15/16: AI model via env var (out of scope for this phase)

### Conventions
- `.planning/codebase/CONVENTIONS.md` — Prisma error handling, transaction patterns
- `.planning/codebase/ARCHITECTURE.md` §Archive Layer — `archiveContentItems`, `syncTopicsToPrisma`, `upsertSourcesBatch` architecture

</canonical_refs>

<codebase_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/logger.ts` — Structured logger with `info`, `warn`, `error` methods; use `logger.error()` for failure logs
- `prisma.$transaction()` — Prisma transactional wrapper; use `prisma.$transaction(async (tx) => {...})`
- `BATCH_SIZE = 30` constant — Already defined in `upsert-content-prisma.ts`

### Established Patterns
- Source failure tracking: `SourceFailure { sourceId, error }` in `run-collect-job.ts`
- Per-source discard summary: `{ sourceId, sourceType, fetched: N, discarded: M, discardRate: X% }` (Phase 2)

### Integration Points
- `runCollectJob()` in `src/pipeline/run-collect-job.ts` — wrap steps 2+3+10 in transaction
- Health recording (`recordSourcesSuccessBatch`, `recordSourceFailure`) stays outside transaction (fire-and-forget)

</codebase_context>

<specifics>
## Specific Ideas

- "All three batch ops in one transaction — if any fails, everything rolls back"
- "Prisma writes only retry — source collection already has per-source error handling"
- "Rich structured logs with sourceId, URL, kind, error type, timestamp, retry count"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 04-pipeline-robustness*
*Context gathered: 2026-03-31*
