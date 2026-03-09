# Information Aggregator Skill Design

Date: 2026-03-09
Status: Approved

## Implementation Progress Snapshot

Status as implemented on 2026-03-09:

- Done: standalone Bun project, local Git repo, CLI entrypoint, config examples, test suite
- Done: SQLite schema and repository functions for sources, runs, outputs, and source health
- Done: adapters for RSS, JSON Feed, and website fallback discovery
- Done: normalize, exact dedupe, near dedupe, topic scoring, ranking, clustering, and markdown renderers
- Done: end-to-end `scan` and `digest` orchestration with dry-run friendly execution
- Done: AI abstraction layer and prompt builders
- Not yet implemented by design: remote provider execution, advanced config binding, persistent writes for all intermediate pipeline entities, non-MVP adapters, web UI, multi-user workflows, embeddings

## 1. Goal

Build a reusable local-first aggregation skill that helps users collect information from multiple high-quality sources, reduce duplicates, and output high-density results in two modes:

- `daily digest`
- `interactive scan`

The system should be:

- configurable by users
- extensible with new source adapters
- stable enough for daily use
- structured for future expansion without becoming a SaaS-first system

This is a single-user, local-first platform design. It is not a multi-user product in the MVP.

## 2. Product Direction

The system is not meant to be "another feed reader". Its purpose is to:

1. ingest data from multiple sources into a unified pool
2. remove exact duplicates and compress near-duplicates
3. rank and summarize only the highest-value information

The key output unit should gradually evolve from `item list` to `cluster-aware result`, so repeated reports from different sources are grouped instead of shown as independent items.

## 3. Design Principles

- Local-first: run as a skill + CLI, not a web product in the MVP
- Config-driven: source selection, topic definition, and output mode should come from configuration
- Adapter-based: every source type is isolated behind a collector interface
- Pipeline separation: collection, normalization, deduplication, ranking, enrichment, and rendering should remain separate
- AI-late: AI is only used after candidate reduction, never for full ingestion
- Explainable output: ranking should remain interpretable enough for user tuning
- Incremental extensibility: future source types should plug in without forcing architecture changes

## 4. Scope

### 4.1 MVP Scope

The MVP should include:

- local skill + CLI entrypoint
- SQLite-backed persistence
- configuration files for:
  - `sources`
  - `source_packs`
  - `topics`
  - `profiles`
- source adapters for:
  - `rss`
  - `json_feed`
  - `website` with RSS discovery and title fallback
- unified `RawItem` and `NormalizedItem`
- exact deduplication
- lightweight near-duplicate compression
- mixed ranking strategy
- two output modes:
  - `scan`
  - `digest`
- AI used only for candidate scoring and cluster/digest summarization
- source health tracking

### 4.2 Explicitly Out of Scope for This MVP

The following are planned future capabilities and must be documented now, but they are not part of this MVP:

- `x_bookmarks` and `x_list` adapters
- Reddit and Hacker News adapters
- deep article extraction worker
- GitHub/long-article enrichment pipeline
- user feedback learning
- web UI
- multi-user mode
- remote sync
- embedding/vector store
- cross-run event evolution tracking
- shared online source marketplace

These items should be designed so they can be added later without major rewrites, but they should not be implemented in the MVP.

## Future Work Marker

The following areas are planned, not part of MVP, and intentionally deferred until after the local-first CLI baseline is stable:

- X adapters and bookmark/list ingestion
- Hacker News and Reddit ingestion
- deep enrichment and full-text extraction
- feedback loop driven ranking
- web UI
- multi-user operation
- embeddings or vector similarity

## 5. Recommended Architecture

The system should follow this unified flow:

```text
Sources -> Collectors -> RawItem -> Normalize -> Dedup/Cluster -> Rank -> Render
```

Responsibilities:

- `Sources`: user-configured inputs, source packs, topic and profile binding
- `Collectors`: fetch source-specific data and return unified raw records
- `RawItem`: canonical ingestion layer for all source types
- `Normalize`: URL cleanup, title/text normalization, signal extraction, topic hints
- `Dedup/Cluster`: exact dedup first, near dedup second, clustering later in the pipeline
- `Rank`: combine rule-based and AI-based scoring
- `Render`: produce `digest` or `scan`

## 6. Repository Layout

```text
information-aggregator/
├── SKILL.md
├── README.md
├── package.json
├── config/
│   ├── sources.example.yaml
│   ├── topics.example.yaml
│   ├── profiles.example.yaml
│   └── packs/
│       ├── ai-daily-digest-blogs.yaml
│       └── ai-news-sites.yaml
├── data/
│   ├── aggregator.db
│   └── cache/
├── output/
├── scripts/
│   └── aggregator.ts
├── src/
│   ├── cli/
│   ├── config/
│   ├── adapters/
│   │   ├── rss.ts
│   │   ├── json-feed.ts
│   │   ├── website.ts
│   │   ├── hn.ts
│   │   ├── reddit.ts
│   │   └── x-bird.ts
│   ├── pipeline/
│   │   ├── collect.ts
│   │   ├── normalize.ts
│   │   ├── dedupe.ts
│   │   ├── cluster.ts
│   │   ├── rank.ts
│   │   └── enrich.ts
│   ├── render/
│   │   ├── digest.ts
│   │   ├── scan.ts
│   │   └── json.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── queries.ts
│   │   └── migrations/
│   ├── ai/
│   │   ├── client.ts
│   │   ├── prompts.ts
│   │   └── scoring.ts
│   └── types/
└── docs/
    └── plans/
```

Module boundaries:

- `adapters`: collect only, return `RawItem[]`
- `pipeline`: normalize, dedupe, cluster, rank, enrich
- `render`: format output only
- `db`: persistence only
- `ai`: model clients and structured scoring only
- `config`: config loading, merging, validation

## 7. Core Data Model

### 7.1 `sources`

Defines reusable source entries.

```ts
type Source = {
  id: string
  name: string
  type: 'rss' | 'json_feed' | 'website' | 'hn' | 'reddit' | 'x_bookmarks' | 'x_list'
  enabled: boolean
  url?: string
  configJson: string
  tagsJson?: string
  weight?: number
  createdAt: string
  updatedAt: string
}
```

### 7.2 `source_packs`

Defines reusable bundles of sources.

```ts
type SourcePack = {
  id: string
  name: string
  description?: string
  sourceIdsJson: string
  tagsJson?: string
}
```

### 7.3 `raw_items`

Unified ingestion records.

```ts
type RawItem = {
  id: string
  sourceId: string
  externalId?: string
  title: string
  url: string
  author?: string
  content?: string
  excerpt?: string
  publishedAt?: string
  fetchedAt: string
  language?: string
  metadataJson: string
  dedupKey?: string
}
```

### 7.4 `normalized_items`

Stores deterministic post-processing output.

```ts
type NormalizedItem = {
  id: string
  rawItemId: string
  canonicalUrl?: string
  normalizedTitle: string
  normalizedText?: string
  topicHintsJson?: string
  qualitySignalsJson?: string
  exactDedupKey?: string
  nearDedupKey?: string
  processedAt: string
}
```

### 7.5 `clusters`

Represents grouped candidates for a single run.

```ts
type Cluster = {
  id: string
  runId: string
  canonicalItemId: string
  itemIdsJson: string
  topicJson?: string
  summary?: string
  score?: number
  createdAt: string
}
```

### 7.6 `runs`

Tracks a single execution.

```ts
type Run = {
  id: string
  mode: 'scan' | 'digest'
  sourceSelectionJson: string
  topicProfileId?: string
  paramsJson: string
  status: 'running' | 'succeeded' | 'failed'
  createdAt: string
  finishedAt?: string
}
```

### 7.7 `outputs`

Stores final render results.

```ts
type Output = {
  id: string
  runId: string
  format: 'markdown' | 'json'
  path?: string
  content?: string
  createdAt: string
}
```

## 8. Configuration Model

Configuration should be split into four layers:

1. `sources`
2. `source_packs`
3. `topics`
4. `profiles`

### 8.1 Topics

```ts
type TopicProfile = {
  id: string
  name: string
  includeKeywords: string[]
  excludeKeywords: string[]
  includeTags?: string[]
  excludeTags?: string[]
  preferredSources?: string[]
  blockedSources?: string[]
}
```

### 8.2 Profiles

Profiles should bind:

- source packs or source ids
- topic profile
- default output mode
- window and topN settings
- AI enablement preferences

This allows the same system to support both scheduled digest use and temporary scan runs.

## 9. Source Adapter Strategy

Each source adapter should only transform external content into `RawItem[]`.

Suggested interface:

```ts
interface SourceAdapter {
  supports(source: SourceConfig): boolean
  collect(source: SourceConfig, context: CollectContext): Promise<RawItem[]>
}
```

Adapters must not handle:

- final ranking
- cross-source deduplication
- final summarization
- final rendering

### 9.1 MVP Adapters

- `rss`
- `json_feed`
- `website`

### 9.2 Planned Adapters for Later

- `hn`
- `reddit`
- `x_bookmarks`
- `x_list`

## 10. Runtime Flow

Unified high-level flow:

```text
resolve config
-> select sources
-> collect raw items
-> normalize
-> exact dedup
-> near dedup
-> rank candidates
-> branch to scan or digest render
```

### 10.1 `interactive scan`

Use cases:

- temporary topic exploration
- ad hoc source selection
- narrow time-window review

Flow:

1. resolve run config
2. collect selected source items
3. normalize records
4. apply exact dedup and near dedup
5. rank candidates
6. optionally AI-score top candidates
7. render concise scan output

### 10.2 `daily digest`

Use cases:

- repeatable daily workflow
- fixed profile and source packs
- structured digest output

Flow:

1. resolve default profile
2. collect and normalize data
3. deduplicate candidates
4. produce ranked candidate pool
5. cluster top candidates
6. enrich top clusters with AI summary and why-it-matters
7. render long-form digest

## 11. Deduplication and Clustering

Deduplication should happen in three levels.

### 11.1 Exact Dedup

Purpose:

- remove URL-level duplicates
- remove tracking and canonicalization noise

Inputs:

- canonical URL
- normalized title
- source-specific stable ids

### 11.2 Near Dedup

Purpose:

- compress lightly rewritten duplicates

Candidate techniques:

- normalized title overlap
- title plus excerpt similarity
- same-window comparison constraints

The MVP should use lightweight text similarity instead of embeddings.

### 11.3 Event Cluster

Purpose:

- group related items across sources into one result cluster
- retain multiple source perspectives
- expose one canonical entry plus supporting entries

The MVP should support run-scoped clusters only. Global historical event tracking is a future capability.

## 12. Ranking Strategy

Ranking should use a mixed scoring formula instead of pure AI sorting.

```text
final_score =
  source_weight_score * 0.20 +
  freshness_score     * 0.15 +
  engagement_score    * 0.10 +
  topic_match_score   * 0.25 +
  content_quality_ai  * 0.30
```

Signal meaning:

- `source_weight_score`: trust and importance of source
- `freshness_score`: recency
- `engagement_score`: social/public signal when available
- `topic_match_score`: rule-based relevance to configured themes
- `content_quality_ai`: AI-assisted candidate quality judgment

This keeps ranking stable, configurable, and interpretable.

## 13. AI Responsibilities

AI should be used only after candidate reduction.

### 13.1 Allowed AI Roles

1. relevance scoring
2. quality scoring
3. cluster summary
4. final digest narration

### 13.2 Disallowed AI Roles

AI should not be used for:

- full ingestion filtering
- URL/title exact dedup
- source detection
- adapter failure recovery
- full dataset classification

## 14. Error Handling

Errors should be handled in layers.

### 14.1 Source-level failure

- one source failure must not fail the whole run
- record source id, adapter type, error, timestamp, retry count

### 14.2 Item-level failure

- keep partial item if possible
- skip broken fields, not the entire run

### 14.3 AI-level failure

- fall back to rule-only ranking
- omit optional summaries if needed

### 14.4 Run-level failure

Only fail a run if:

- no source succeeded, or
- critical persistence failed

## 15. Source Health Management

Each source should keep health state:

```ts
type SourceHealth = {
  sourceId: string
  lastFetchedAt?: string
  lastSucceededAt?: string
  lastError?: string
  errorCount: number
  zeroItemCount: number
  averageItemCount?: number
  disabledBySystem?: boolean
}
```

Suggested policy:

- 3 consecutive failures: warning
- 5 consecutive failures: auto-skip by default
- 7 consecutive zero-item runs: mark stale
- successful recovery resets error count

## 16. Reference Project Mapping

### 16.1 `ai-daily-digest`

Reuse:

- high-quality blog source pack
- digest presentation ideas

Do not reuse directly:

- single-file structure
- hand-rolled parsing as the long-term base

### 16.2 `ai-news-radar`

Reuse:

- ingestion flow
- source normalization
- source status tracking
- RSS/OPML handling ideas

### 16.3 `smaug`

Reuse later:

- enrichment worker ideas
- CLI-first integration patterns
- content expansion patterns

### 16.4 `x-ai-topic-selector`

Reuse later:

- X-specific source handling ideas
- thread expansion strategy

Do not use as the default ingestion model because browser-driven scraping is too brittle for the platform core.

### 16.5 `clawfeed`

Reuse:

- source and pack modeling direction
- long-term `raw_items` and digest architecture

Do not treat current codebase as a ready-made general collector implementation.

## 17. Implementation Constraints

The implementation should include necessary code comments where logic is not self-evident.

Guidelines:

- keep comments concise
- use comments to explain intent and non-obvious tradeoffs
- avoid trivial comments that restate code
- add comments around:
  - normalization rules
  - dedup heuristics
  - ranking math
  - adapter-specific edge cases

## 18. Future Work

The following should be tracked as future work but not implemented in this MVP.

### 18.1 Additional Source Adapters

- Hacker News
- Reddit
- X bookmarks
- X lists
- GitHub and other structured APIs

### 18.2 Enrichment

- article body extraction
- GitHub README extraction
- long-form content expansion
- source-aware deep summarization

### 18.3 Smarter Clustering

- embeddings
- vector index
- cross-run cluster evolution
- persistent topic memory

### 18.4 Feedback Loop

- keep/downrank/mute controls
- source-level preference learning
- topic profile auto-tuning

### 18.5 Productization

- web UI
- multi-user support
- remote storage and sync
- shared source packs

## 19. Recommended Delivery Plan

### Phase 1

- local skill + CLI
- SQLite schema
- config system
- `rss/json_feed/website` adapters
- dedup/rank/render
- `scan` and `digest`

### Phase 2

- Hacker News
- Reddit
- better website fallback
- stronger source health tracking

### Phase 3

- X adapters, preferably `bird`-based first
- social interaction signals in ranking

### Phase 4

- enrichment worker
- feedback loop
- stronger clustering

## 20. Final Recommendation

Build the system as a local-first, SQLite-backed, config-driven aggregation platform with adapter-based ingestion and cluster-aware outputs.

The MVP should optimize for:

- correct data boundaries
- strong source configurability
- stable ingestion
- practical deduplication
- high-quality digest and scan output

It should not optimize for:

- maximum number of source types on day one
- UI completeness
- heavy platform abstraction
- full AI automation

The most important long-term success factor is getting the architecture right around:

- source configuration
- `RawItem` and `NormalizedItem`
- exact and near dedup
- ranking explainability
- output quality
