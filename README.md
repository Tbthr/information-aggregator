# Information Aggregator

Local-first information aggregation MVP for collecting configured sources, deduplicating overlap, and rendering either a quick `scan` or a structured `digest`.

## What The MVP Includes

- TypeScript + Bun CLI
- SQLite persistence for sources, runs, outputs, and source health
- Config-driven source definitions, source packs, topics, and profiles
- Adapters for `rss`, `json-feed`, and `website` fallback discovery
- Deterministic normalization, exact deduplication, near-duplicate compression, ranking, and rendering
- Optional AI abstraction for later candidate scoring and narration hooks

## Configuration

Example config files live in [`config/`](./config):

- `sources.example.yaml`
- `topics.example.yaml`
- `profiles.example.yaml`
- `config/packs/ai-daily-digest-blogs.yaml`
- `config/packs/ai-news-sites.yaml`

The MVP expects local YAML files and runs entirely on local state.

Default examples:

```yaml
# config/sources.example.yaml
sources:
  - id: openai-news
    name: OpenAI News
    type: rss
    enabled: true
    url: https://openai.com/news/rss.xml

  - id: simon-willison
    name: Simon Willison
    type: website
    enabled: true
    url: https://simonwillison.net/
```

```yaml
# config/topics.example.yaml
topics:
  - id: ai-news
    name: AI News
    keywords:
      - ai
      - model
```

```yaml
# config/profiles.example.yaml
profiles:
  - id: default
    name: Default Digest
    mode: digest
    topicIds:
      - ai-news
```

The default config is curated with the five reference projects in mind. Compatible default feeds currently come from `ai-daily-digest` and `ai-news-radar`; `smaug`, `x-ai-topic-selector`, and `clawfeed` currently influence pack structure and website fallback choices rather than adding unsupported X/browser sources to the MVP defaults.

## Commands

```bash
bun install
bun test
bun run check
bun run smoke
bun run e2e
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
bun scripts/aggregator.ts config validate
```

## Output Modes

- `scan`: ranked markdown list for fast review
- `digest`: grouped markdown digest with highlights and clustered items

## Example Workflow

```bash
bun run smoke
```

For a more detailed checklist and clean-clone install flow, see [`docs/testing.md`](./docs/testing.md).

```bash
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

Example `scan` output:

```md
# Scan

- [Example title](https://example.com/post)
  - source: OpenAI News
  - score: 0.82
```

Example `digest` output:

```md
# Digest

## Top Highlights

- Example title

## Cluster: Example topic

- [Example title](https://example.com/post)
```

The codebase uses concise comments around non-obvious logic such as normalization rules, deduplication heuristics, ranking math, and adapter edge cases.

## Future Work

Planned, not part of MVP:

- X adapters such as `x_bookmarks` and `x_list`
- Hacker News and Reddit adapters
- deep enrichment and article extraction
- feedback loop and adaptive ranking
- web UI
- multi-user mode
- embeddings or vector search

These items are intentionally excluded from the current implementation.

## Implementation Status

Current project status as of 2026-03-09:

- Completed: project scaffold, Bun CLI, YAML config loading, SQLite schema, run/output/source-health persistence
- Completed: `rss`, `json-feed`, and `website` adapters
- Completed: curated default source config and source packs based on the reference projects
- Completed: collection, normalization, exact deduplication, near-duplicate compression, topic matching, ranking, clustering
- Completed: markdown scan and digest rendering
- Completed: end-to-end `scan`, `digest`, and `config validate` CLI commands
- Completed: AI client abstraction and prompt builders
- Deferred beyond MVP: real AI provider integration, richer profile/topic binding, persistent raw/normalized item writes in the full pipeline, X/HN/Reddit adapters, embeddings, web UI, multi-user support
