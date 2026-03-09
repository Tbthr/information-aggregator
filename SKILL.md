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

## Configuration Shape

Minimal local YAML examples:

```yaml
sources:
  - id: example-rss
    name: Example RSS
    type: rss
    enabled: true
    url: https://example.com/feed.xml
```

```yaml
topics:
  - id: ai-news
    name: AI News
    keywords:
      - ai
```

```yaml
profiles:
  - id: default
    mode: digest
    topicIds:
      - ai-news
```

## Source Packs

The sample source pack files in `config/packs/` show how to bundle sources for recurring scans or digests.

## Output Examples

Example `scan` output:

```md
# Scan

- [Example title](https://example.com/post)
  - source: Example RSS
  - score: 0.82
```

Example `digest` output:

```md
# Digest

## Top Highlights

- Example title
```

## Future Work

Planned, not part of MVP. Future work, intentionally excluded from current MVP:

- X, Reddit, and Hacker News adapters
- deep enrichment and feedback loops
- browser or web UI
- multi-user workflows
- embeddings-backed similarity

## Implementation Status

Implemented in the current repository state:

- CLI bootstrap and help text
- config validation from local YAML files
- SQLite bootstrap with core tables for sources, raw items, normalized items, clusters, runs, outputs, and source health
- source adapters for `rss`, `json-feed`, and `website`
- deterministic normalize, dedupe, topic-match, rank, and cluster pipeline stages
- markdown renderers for `scan` and `digest`
- optional AI abstraction without provider-specific runtime integration

Deferred on purpose:

- real provider-backed AI execution
- full production profile/topic/source-pack orchestration
- external adapters beyond the MVP set

The implementation keeps code comments concise and uses them only for non-obvious behavior such as normalization rules, deduplication heuristics, ranking math, and adapter-specific edge cases.
