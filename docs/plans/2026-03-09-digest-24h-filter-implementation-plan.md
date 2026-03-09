# Digest 24-Hour Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restrict digest output to content from the last 24 hours, using publication time when available and fetch time otherwise.

**Architecture:** Keep timestamp extraction in adapters and apply a single time-window filter inside `runDigest` before normalization. This preserves the existing pipeline and limits behavior change to digest mode.

**Tech Stack:** Bun, TypeScript, bun:test

---

### Task 1: Add failing tests for timestamp parsing and digest filtering

**Files:**
- Modify: `src/adapters/rss.test.ts`
- Modify: `src/adapters/json-feed.test.ts`
- Modify: `src/cli/run-digest.test.ts`

**Step 1: Write the failing test**

- Add RSS coverage for `pubDate` and Atom `published`.
- Add JSON Feed coverage for `date_published`.
- Add digest coverage for 24-hour filtering and fetch-time fallback.

**Step 2: Run test to verify it fails**

Run: `bun test src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/cli/run-digest.test.ts`
Expected: FAIL because the digest path does not yet filter by the 24-hour window and RSS does not yet read Atom `published`.

### Task 2: Implement the minimal filtering and timestamp parsing changes

**Files:**
- Modify: `src/adapters/rss.ts`
- Modify: `src/cli/run-digest.ts`

**Step 1: Write minimal implementation**

- Extend RSS parsing to read Atom `published`.
- Add a helper in `runDigest.ts` that:
  - computes a cutoff from `now() - 24h`
  - uses `publishedAt` when valid
  - otherwise uses `fetchedAt`
  - excludes invalid or too-old timestamps

**Step 2: Run test to verify it passes**

Run: `bun test src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/cli/run-digest.test.ts`
Expected: PASS

### Task 3: Verify no regression in digest flow

**Files:**
- No code changes expected

**Step 1: Run focused verification**

Run: `bun test src/cli/run-digest.test.ts src/adapters/rss.test.ts src/adapters/json-feed.test.ts`
Expected: PASS

**Step 2: Run smoke verification**

Run: `bun run smoke`
Expected: PASS
