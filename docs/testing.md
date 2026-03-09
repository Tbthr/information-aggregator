# Testing Guide

## Fastest MVP Check

Use the smoke command during active development:

```bash
bun run smoke
```

This runs the current recommended verification chain:

```bash
bun test
bun run check
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

## Manual Acceptance Checklist

- `bun run smoke` passes without manual fixes
- `bun scripts/aggregator.ts --help` shows `scan`, `digest`, and `config validate`
- `bun scripts/aggregator.ts config validate` succeeds with example config
- `bun scripts/aggregator.ts scan` returns markdown output
- `bun scripts/aggregator.ts digest` returns markdown output
- example config files remain readable and in sync with the documented commands

## End-To-End Checks

Stable local end-to-end baseline:

```bash
bun run e2e
```

This starts no external dependency and verifies the full fetch-to-render path against local mock HTTP sources.

Optional real-network probe:

```bash
bun run e2e:real
```

This hits current public feeds and confirms the runtime still works against real sources. It should not be treated as a stable CI gate because upstream availability can change.

## Installation Test

For release-style verification, use a clean directory and verify the repository like an external user would:

```bash
git clone <repo-url> information-aggregator-test
cd information-aggregator-test
bun install
bun run smoke
```

This is usually enough before introducing a formal skill-installation flow.

## Current Best Practice

Use a layered verification order:

1. Unit tests for pure pipeline logic.
2. `bun run smoke` for local CLI integration.
3. `bun run e2e` for stable fetch-to-output integration.
4. Clean-clone install test before sharing or publishing.
5. `bun run e2e:real` as a manual public-network probe.
6. Skill-installation test only when the skill packaging or distribution path changes.

For this MVP stage, the recommended default is local CLI verification first, because it isolates core runtime issues from packaging issues.
