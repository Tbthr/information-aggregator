# Testing Patterns

**Analysis Date:** 2026-03-30

## Test Framework

**Test Runner:** Bun (not Jest or Vitest)
- Command: `bun test` (configured in `package.json`)
- Bun's built-in test runner with native TypeScript support

**Assertion Library:** Bun's built-in assertions
- `expect()` from `bun:test`
- `describe()`, `test()` for test structure

**Type Checking:** TypeScript (`tsc --noEmit`)
- Configured via `pnpm check`

## Test File Organization

**Location Pattern:**
- Co-located with source files using `.test.ts` suffix
- Examples:
  - `src/pipeline/rank.test.ts`
  - `src/diagnostics/reports/config.test.ts`
  - `src/adapters/rss.test.ts`

**Excluded from TypeScript:** Test files are excluded from `tsconfig.json` build:
```json
{
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

## Test Structure

**Suite Organization (bun:test):**
```typescript
import { describe, expect, test } from "bun:test";

describe("FeatureName", () => {
  test("should do something specific", async () => {
    const result = someFunction()
    expect(result).toBe(expectedValue)
  })

  test("should handle error case", async () => {
    expect(() => throwingFunction()).toThrow()
  })
})
```

**Async Testing:**
```typescript
test("should fetch data", async () => {
  const data = await fetchData()
  expect(data).toBeTruthy()
})
```

**Error Testing:**
```typescript
test("should throw on invalid input", () => {
  expect(() => validate({ invalid: true })).toThrow()
})
```

## Diagnostics Framework (E2E Testing)

**Script:** `scripts/diagnostics.ts`
**Runner:** `bun scripts/diagnostics.ts` or `npx tsx scripts/diagnostics.ts`

### Diagnostics Modes

| Mode | Purpose |
|------|---------|
| `collection` | Collection diagnostics (guards, health, inventory) |
| `reports` | Reports diagnostics (config, inventory, daily, weekly, integrity) |
| `full` | Full diagnostics (collection + reports) |

### Diagnostics Options

| Option | Purpose |
|--------|---------|
| `--run-collection` | Trigger actual collection run |
| `--config-only` | Only validate config API, skip report generation |
| `--daily-only` | Only run daily report assertions |
| `--weekly-only` | Only run weekly report assertions |
| `--cleanup` | Clean up test data after run (DANGEROUS) |
| `--allow-write` | Allow write operations in read-only modes |
| `--confirm-production` | Acknowledge production environment risk |
| `--confirm-cleanup` | Acknowledge data cleanup risk |
| `--api-url <url>` | API URL (default: http://localhost:3000) |
| `--json-output <path>` | Write JSON results to file |
| `--verbose` | Enable verbose logging |

### Diagnostics Assertions

**Assertion Structure:**
```typescript
interface DiagnosticsAssertion {
  id: string           // e.g., "B-04", "F-01"
  category: "collection" | "reports" | "system" | "api"
  status: "PASS" | "FAIL" | "WARN" | "SKIP"
  blocking: boolean    // If true, failure blocks pipeline
  message: string
  evidence?: unknown
}
```

**Example Assertion IDs:**
- `B-04`: Config validation (maxItems>200, minScore<0, pickCount=0)
- `B-05`: Weekly days validation (days=10 returns 400)
- `B-06`: Malformed JSON body rejection
- `B-08`: Nullable prompts handling
- `F-01` through `F-07`: Data integrity checks (FK validity, field completeness)

## Build Verification

### Static Type Checking

```bash
pnpm check    # tsc --noEmit
```

**Purpose:** Validates TypeScript without emitting JavaScript. Catches type errors, missing imports, invalid types.

**Expected:** Exit 0 with no errors.

### Production Build

```bash
pnpm build    # next build
```

**Steps:**
1. Runs `prisma generate` to generate Prisma client
2. Runs Next.js production build
3. Runs TypeScript check

**Expected:** Build succeeds with no errors.

### Linting

```bash
pnpm lint    # eslint src/
```

## CI/CD Pipeline

**Vercel Deployment:**
- Configured in `vercel.json`
- Build command: `prisma generate && next build`
- Install command: `pnpm install`
- Region: `hkg1` (Hong Kong)

**Vercel Cron Jobs (configured in `vercel.json`):**
```json
{
  "crons": [
    { "path": "/api/cron/collect", "schedule": "0 */30 * * * *" },
    { "path": "/api/cron/collect-x-feed", "schedule": "0 0 */6 * * *" },
    { "path": "/api/cron/collect-x-social", "schedule": "0 0 */12 * * *" },
    { "path": "/api/cron/daily", "schedule": "0 0 23 * * *" },
    { "path": "/api/cron/weekly", "schedule": "5 0 23 * * 0" }
  ]
}
```

**Note:** Vercel Cron uses UTC time. Configure Beijing (UTC+8) times by subtracting 8 hours.

## Verification Levels (Reports Pipeline)

| Level | Trigger | Command | Expected Duration |
|-------|---------|---------|-------------------|
| L1 | UI/type/Config changes | `pnpm check && pnpm build` | ~30s |
| L2 | Config API changes | `npx tsx scripts/diagnostics.ts reports --config-only` | ~10s |
| L3 | Daily report logic | `npx tsx scripts/diagnostics.ts reports --daily-only` | ~5min |
| L4 | Weekly report logic | `npx tsx scripts/diagnostics.ts reports --weekly-only` | ~5min |
| L5 | Collection pipeline | `npx tsx scripts/diagnostics.ts full --run-collection --cleanup` | ~15min |

## Pre-commit Checklist

**Before every commit:**
```bash
pnpm check    # TypeScript type check
pnpm build    # Production build
```

**Fix all errors before pushing.**

## Environment Configuration

**Test Environment:**
- Detected via `DATABASE_URL` containing "test"
- Env mismatch detection blocks execution to prevent running against wrong database

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct database connection (for Prisma)
- External API keys (RSS sources, X/Twitter, AI providers)

**Diagnostics Environment Override:**
```bash
DIAGNOSTICS_ENV=test bun scripts/diagnostics.ts reports
```

## Mocking Patterns

**No mocking framework used in this codebase.** Tests are primarily integration-style using actual database connections.

**For external services (AI, RSS, X):** Tests that require these should be skipped or use environment-based guards.

## Known Test Locations

| Path | Purpose |
|------|---------|
| `src/pipeline/*.test.ts` | Pipeline stage tests |
| `src/diagnostics/**/*.test.ts` | Diagnostics assertions tests |
| `src/adapters/*.test.ts` | Adapter tests (RSS, JSON Feed, X) |
| `src/reports/scoring/*.test.ts` | Report scoring algorithm tests |
| `src/ai/*.test.ts` | AI client and prompt tests |
| `src/cache/*.test.ts` | Cache logic tests |

## Viewing Diagnostics Results

**JSON Output:**
```bash
bun scripts/diagnostics.ts full --json-output results.json
```

**Verbose Mode:**
```bash
bun scripts/diagnostics.ts full --verbose
```

**Exit Codes:**
- `0` - All assertions passed (FAIL count = 0)
- `1` - One or more assertions failed

---

*Testing analysis: 2026-03-30*
