# AGENTS.md

## Project Summary

`information-aggregator` is a local-first Bun + TypeScript MVP that collects configured sources, normalizes and deduplicates results, and renders either a fast `scan` or a grouped `digest`.

Current MVP scope:

- YAML-driven source configuration
- SQLite-backed persistence for sources, runs, outputs, and source health
- adapters for `rss`, `json-feed`, and `website`
- deterministic normalization, exact dedupe, near-deduplication, ranking, clustering, and markdown rendering
- CLI commands for `scan`, `digest`, and `config validate`
- stable local smoke and end-to-end verification flows

Out of scope for the current MVP:

- X, Reddit, and Hacker News adapters
- real AI provider execution
- embeddings / vector similarity
- web UI
- multi-user support
- advanced feedback loops

## Architecture

The main runtime flow is:

```text
Sources -> Collectors -> RawItem -> Normalize -> Dedup/Cluster -> Rank -> Render
```

Module ownership:

- `src/adapters/`: source-specific fetch and parse logic only
- `src/config/`: YAML loading and validation
- `src/db/`: SQLite schema and query helpers
- `src/pipeline/`: collect, normalize, dedupe, topic match, rank, cluster
- `src/render/`: markdown output formatting
- `src/cli/`: end-to-end orchestration for `scan` and `digest`
- `src/verification/`: reusable verification helpers
- `scripts/`: runnable developer entrypoints such as smoke and real-source probes
- `docs/`: plans, testing guidance, and implementation progress

Design constraints:

- keep pipeline stages deterministic unless explicitly adding optional AI hooks
- avoid mixing fetch logic into ranking/render code
- prefer dependency injection for tests over global mocking
- keep new adapters isolated behind the existing collector pattern

## Developer Workflow

Install and baseline checks:

```bash
bun install
bun test
bun run check
```

Primary developer commands:

```bash
bun run smoke
bun run e2e
bun run e2e:real
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

## Verification Policy

Use this order unless there is a specific reason not to:

1. `bun test` for unit and focused integration coverage
2. `bun run smoke` for local CLI regression checks
3. `bun run e2e` for stable mock-source end-to-end verification
4. clean-clone install verification before publishing or handing off
5. `bun run e2e:real` as a manual real-network probe
6. skill-installation verification only when packaging/distribution behavior changes

Interpretation:

- `smoke` is the fastest default check during development
- `e2e` is the stable fetch-to-output gate
- `e2e:real` is intentionally non-CI and may fail due to upstream/network issues

## End-To-End Testing Rules

When adding or changing source/runtime behavior:

- add or update a local mock-source E2E test first
- prefer local HTTP test servers over brittle network mocks
- assert on final markdown output, not only intermediate structures
- keep real-network probes as supplemental validation, never the only test

When changing packaging or installation:

- verify the repository from a clean clone
- only add skill-installation tests when the skill entrypoint or packaging contract changes

## Documentation Rules

Keep these files aligned when behavior changes:

- `README.md`: user-facing overview and commands
- `docs/testing.md`: verification workflows and best practices
- `docs/plans/2026-03-09-information-aggregator-skill-design.md`: architecture intent and progress snapshot
- `docs/plans/2026-03-09-information-aggregator-skill-implementation-plan.md`: execution plan history

When something remains intentionally unfinished, document it instead of implying support.

## Implementation Progress

Implemented today:

- project scaffold and CLI
- config validation
- source adapters for `rss`, `json-feed`, and `website`
- SQLite bootstrap and core queries
- normalization, dedupe, topic scoring, ranking, clustering
- markdown `scan` and `digest`
- smoke verification
- mock-source E2E verification
- real-network probe verification

Still deferred by design:

- full production config/profile binding depth
- persistence of all intermediate pipeline entities in the end-to-end path
- remote AI providers
- non-MVP adapters and product surfaces

## Collaboration Notes

For future agents:

- prefer minimal, well-scoped changes
- keep commits logically grouped
- do not silently expand MVP scope
- if a feature is deferred, record it in docs rather than partially implementing it
