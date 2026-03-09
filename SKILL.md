# Information Aggregator

Aggregate configured information sources into local `scan` and `digest` outputs.

## MVP Capabilities

- load YAML configuration for sources, topics, profiles, and source packs
- collect from `rss`, `json-feed`, and `website` sources
- normalize URLs and text
- remove exact duplicates and compress near-duplicates
- rank candidates with deterministic mixed scoring
- render markdown `scan` and `digest` outputs
- track runs, outputs, and source health in SQLite

## Usage

```bash
bun install
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
bun scripts/aggregator.ts config validate
```

## Source Packs

The sample source pack files in `config/packs/` show how to bundle sources for recurring scans or digests.

## Future Work

Future work, intentionally excluded from current MVP:

- X, Reddit, and Hacker News adapters
- deep enrichment and feedback loops
- browser or web UI
- multi-user workflows
- embeddings-backed similarity
