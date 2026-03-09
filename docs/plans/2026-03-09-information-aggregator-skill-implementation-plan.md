# Information Aggregator Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP of a local-first, SQLite-backed information aggregation skill that supports configurable sources, exact and near deduplication, and two output modes: `scan` and `digest`.

**Architecture:** The implementation should follow an adapter-based pipeline. Source adapters collect external data into `RawItem` records, the pipeline normalizes and deduplicates them, then a ranker and renderer produce either a concise scan report or a structured daily digest. SQLite stores stable config state, raw items, normalized items, runs, and outputs.

**Tech Stack:** TypeScript, Bun or Node.js, SQLite, YAML config files, Markdown output, JSON output, test runner via Bun test or Node test.

---

### Task 1: Initialize Project Skeleton

**Files:**
- Create: `information-aggregator/package.json`
- Create: `information-aggregator/README.md`
- Create: `information-aggregator/SKILL.md`
- Create: `information-aggregator/scripts/aggregator.ts`
- Create: `information-aggregator/src/types/index.ts`
- Create: `information-aggregator/src/cli/index.ts`
- Create: `information-aggregator/config/sources.example.yaml`
- Create: `information-aggregator/config/topics.example.yaml`
- Create: `information-aggregator/config/profiles.example.yaml`
- Create: `information-aggregator/config/packs/ai-daily-digest-blogs.yaml`
- Create: `information-aggregator/config/packs/ai-news-sites.yaml`
- Test: `information-aggregator/src/cli/index.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { getCliVersion } from "./index";

describe("cli bootstrap", () => {
  test("returns a version string", () => {
    expect(getCliVersion()).toBe("0.1.0");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/cli/index.test.ts`
Expected: FAIL with module or function not found.

**Step 3: Write minimal implementation**

```ts
export function getCliVersion(): string {
  return "0.1.0";
}
```

Create `scripts/aggregator.ts` to invoke the CLI entrypoint and print version/help.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/cli/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator
git commit -m "feat: scaffold information aggregator skill"
```

### Task 2: Define Core Types

**Files:**
- Modify: `information-aggregator/src/types/index.ts`
- Test: `information-aggregator/src/types/index.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import type { RawItem, RunMode } from "./index";

describe("core types", () => {
  test("RunMode includes scan and digest", () => {
    const modes: RunMode[] = ["scan", "digest"];
    expect(modes).toHaveLength(2);
  });

  test("RawItem supports basic ingestion fields", () => {
    const item: RawItem = {
      id: "item-1",
      sourceId: "source-1",
      title: "Example",
      url: "https://example.com",
      fetchedAt: "2026-03-09T00:00:00Z",
      metadataJson: "{}",
    };
    expect(item.sourceId).toBe("source-1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/types/index.test.ts`
Expected: FAIL with missing types.

**Step 3: Write minimal implementation**

Define:
- `RunMode`
- `Source`
- `SourcePack`
- `RawItem`
- `NormalizedItem`
- `Cluster`
- `RunRecord`
- `OutputRecord`
- `TopicProfile`

Include comments only where the type encodes non-obvious intent.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/types/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/types/index.ts information-aggregator/src/types/index.test.ts
git commit -m "feat: add core aggregator types"
```

### Task 3: Add Config Loader

**Files:**
- Create: `information-aggregator/src/config/load.ts`
- Create: `information-aggregator/src/config/validate.ts`
- Test: `information-aggregator/src/config/load.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { loadSourcesConfig } from "./load";

describe("loadSourcesConfig", () => {
  test("loads example source definitions", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    expect(Array.isArray(sources)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/config/load.test.ts`
Expected: FAIL with loader missing.

**Step 3: Write minimal implementation**

Implement:
- YAML file reading
- source array parsing
- minimal validation for required fields

Keep validation strict for:
- `id`
- `name`
- `type`
- `enabled`

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/config/load.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/config information-aggregator/config
git commit -m "feat: add configuration loading"
```

### Task 4: Create SQLite Schema and DB Bootstrap

**Files:**
- Create: `information-aggregator/src/db/schema.ts`
- Create: `information-aggregator/src/db/client.ts`
- Create: `information-aggregator/src/db/migrations/001_init.sql`
- Test: `information-aggregator/src/db/client.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "./client";

describe("createDb", () => {
  test("opens database and creates core tables", () => {
    const db = createDb(":memory:");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.some((t: { name: string }) => t.name === "sources")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/db/client.test.ts`
Expected: FAIL because DB client is missing.

**Step 3: Write minimal implementation**

Implement DB bootstrap to create:
- `sources`
- `source_packs`
- `raw_items`
- `normalized_items`
- `clusters`
- `runs`
- `outputs`
- `source_health`

Add concise comments in schema files only where constraints are non-obvious.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/db/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/db
git commit -m "feat: add sqlite schema and bootstrap"
```

### Task 5: Implement Source Repository Functions

**Files:**
- Create: `information-aggregator/src/db/queries/sources.ts`
- Test: `information-aggregator/src/db/queries/sources.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { insertSource, listSources } from "./sources";

describe("source queries", () => {
  test("inserts and lists sources", () => {
    const db = createDb(":memory:");
    insertSource(db, {
      id: "rss-1",
      name: "Example RSS",
      type: "rss",
      enabled: true,
      url: "https://example.com/feed.xml",
      configJson: "{}",
    });
    const sources = listSources(db);
    expect(sources).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/db/queries/sources.test.ts`
Expected: FAIL with missing repository functions.

**Step 3: Write minimal implementation**

Implement:
- `insertSource`
- `upsertSource`
- `listSources`
- `listEnabledSources`

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/db/queries/sources.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/db/queries
git commit -m "feat: add source persistence queries"
```

### Task 6: Build URL Normalization Helpers

**Files:**
- Create: `information-aggregator/src/pipeline/normalize-url.ts`
- Test: `information-aggregator/src/pipeline/normalize-url.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { normalizeUrl } from "./normalize-url";

describe("normalizeUrl", () => {
  test("removes tracking parameters", () => {
    expect(
      normalizeUrl("https://example.com/post?utm_source=x&ref=test&id=1")
    ).toBe("https://example.com/post?id=1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/normalize-url.test.ts`
Expected: FAIL because helper does not exist.

**Step 3: Write minimal implementation**

Implement normalization rules for:
- lowercased scheme and host
- fragment removal
- known tracking query param removal
- trailing slash cleanup where safe

Add a brief comment explaining why the tracking param list is centralized.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/normalize-url.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/normalize-url.ts information-aggregator/src/pipeline/normalize-url.test.ts
git commit -m "feat: add url normalization helpers"
```

### Task 7: Implement Text Normalization

**Files:**
- Create: `information-aggregator/src/pipeline/normalize-text.ts`
- Test: `information-aggregator/src/pipeline/normalize-text.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { normalizeTitle } from "./normalize-text";

describe("normalizeTitle", () => {
  test("collapses whitespace and lowercases text", () => {
    expect(normalizeTitle("  Hello   World  ")).toBe("hello world");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/normalize-text.test.ts`
Expected: FAIL with missing function.

**Step 3: Write minimal implementation**

Implement helpers for:
- title normalization
- lightweight snippet normalization
- optional empty-string guards

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/normalize-text.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/normalize-text.ts information-aggregator/src/pipeline/normalize-text.test.ts
git commit -m "feat: add text normalization helpers"
```

### Task 8: Implement RSS Adapter

**Files:**
- Create: `information-aggregator/src/adapters/rss.ts`
- Test: `information-aggregator/src/adapters/rss.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { parseRssItems } from "./rss";

describe("parseRssItems", () => {
  test("extracts title and link from RSS items", () => {
    const xml = `
      <rss><channel>
        <item><title>Hello</title><link>https://example.com/1</link></item>
      </channel></rss>
    `;
    const items = parseRssItems(xml, "rss-1");
    expect(items[0]?.title).toBe("Hello");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/adapters/rss.test.ts`
Expected: FAIL because adapter functions are missing.

**Step 3: Write minimal implementation**

Implement:
- RSS/Atom parsing helper
- `collectRssSource(source, fetchImpl)`
- mapping to `RawItem`

Add a comment around namespaced XML handling if it is non-obvious.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/adapters/rss.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/adapters/rss.ts information-aggregator/src/adapters/rss.test.ts
git commit -m "feat: add rss adapter"
```

### Task 9: Implement JSON Feed Adapter

**Files:**
- Create: `information-aggregator/src/adapters/json-feed.ts`
- Test: `information-aggregator/src/adapters/json-feed.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { parseJsonFeedItems } from "./json-feed";

describe("parseJsonFeedItems", () => {
  test("extracts items from JSON Feed", () => {
    const payload = {
      version: "https://jsonfeed.org/version/1.1",
      items: [{ id: "1", title: "Hello", url: "https://example.com/1" }],
    };
    const items = parseJsonFeedItems(payload, "json-1");
    expect(items[0]?.url).toBe("https://example.com/1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/adapters/json-feed.test.ts`
Expected: FAIL with missing parser.

**Step 3: Write minimal implementation**

Implement:
- JSON Feed schema checks
- item extraction into `RawItem`
- fallback to `content_text` or `content_html` excerpt

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/adapters/json-feed.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/adapters/json-feed.ts information-aggregator/src/adapters/json-feed.test.ts
git commit -m "feat: add json feed adapter"
```

### Task 10: Implement Website Adapter with RSS Discovery

**Files:**
- Create: `information-aggregator/src/adapters/website.ts`
- Test: `information-aggregator/src/adapters/website.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { discoverFeedUrl } from "./website";

describe("discoverFeedUrl", () => {
  test("finds alternate rss links in html", () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
      </head></html>
    `;
    expect(discoverFeedUrl("https://example.com", html)).toBe("https://example.com/feed.xml");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/adapters/website.test.ts`
Expected: FAIL because helper is missing.

**Step 3: Write minimal implementation**

Implement:
- RSS alternate link discovery
- page title fallback extraction
- optional downgrade to a single `RawItem` when feed discovery fails

Add a concise comment explaining why website mode is only a fallback in the MVP.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/adapters/website.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/adapters/website.ts information-aggregator/src/adapters/website.test.ts
git commit -m "feat: add website adapter with rss discovery"
```

### Task 11: Build Collector Orchestrator

**Files:**
- Create: `information-aggregator/src/pipeline/collect.ts`
- Test: `information-aggregator/src/pipeline/collect.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { collectSources } from "./collect";

describe("collectSources", () => {
  test("collects from multiple sources and flattens results", async () => {
    const items = await collectSources(
      [
        { id: "s1", name: "A", type: "rss", enabled: true, configJson: "{}", url: "https://a.com/feed" },
      ],
      {
        adapters: {
          rss: async () => [
            {
              id: "item-1",
              sourceId: "s1",
              title: "Hello",
              url: "https://a.com/1",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: "{}",
            },
          ],
        },
      }
    );
    expect(items).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/collect.test.ts`
Expected: FAIL because orchestrator does not exist.

**Step 3: Write minimal implementation**

Implement:
- source-to-adapter dispatch
- per-source error isolation
- flattened item return
- source health event collection hook

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/collect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/collect.ts information-aggregator/src/pipeline/collect.test.ts
git commit -m "feat: add collection orchestrator"
```

### Task 12: Implement Normalization Pipeline

**Files:**
- Create: `information-aggregator/src/pipeline/normalize.ts`
- Test: `information-aggregator/src/pipeline/normalize.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { normalizeItems } from "./normalize";

describe("normalizeItems", () => {
  test("produces normalized items with canonical url and normalized title", () => {
    const normalized = normalizeItems([
      {
        id: "raw-1",
        sourceId: "s1",
        title: " Hello World ",
        url: "https://example.com/post?utm_source=x",
        fetchedAt: "2026-03-09T00:00:00Z",
        metadataJson: "{}",
      },
    ]);
    expect(normalized[0]?.normalizedTitle).toBe("hello world");
    expect(normalized[0]?.canonicalUrl).toBe("https://example.com/post");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/normalize.test.ts`
Expected: FAIL with missing normalization pipeline.

**Step 3: Write minimal implementation**

Implement deterministic normalization from `RawItem` to `NormalizedItem`.

Add comments for:
- exact dedup key intent
- why normalization is stored separately from raw data

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/normalize.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/normalize.ts information-aggregator/src/pipeline/normalize.test.ts
git commit -m "feat: add normalization pipeline"
```

### Task 13: Implement Exact Deduplication

**Files:**
- Create: `information-aggregator/src/pipeline/dedupe-exact.ts`
- Test: `information-aggregator/src/pipeline/dedupe-exact.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { dedupeExact } from "./dedupe-exact";

describe("dedupeExact", () => {
  test("keeps one item per exact dedup key", () => {
    const items = [
      { id: "1", exactDedupKey: "a", processedAt: "2026-03-09T00:00:00Z" },
      { id: "2", exactDedupKey: "a", processedAt: "2026-03-09T01:00:00Z" },
    ];
    const deduped = dedupeExact(items as never);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/dedupe-exact.test.ts`
Expected: FAIL because function is missing.

**Step 3: Write minimal implementation**

Implement exact dedup:
- group by `exactDedupKey`
- keep the latest processed or best candidate

Add a comment explaining the winner-selection rule.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/dedupe-exact.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/dedupe-exact.ts information-aggregator/src/pipeline/dedupe-exact.test.ts
git commit -m "feat: add exact deduplication"
```

### Task 14: Implement Near-Duplicate Compression

**Files:**
- Create: `information-aggregator/src/pipeline/dedupe-near.ts`
- Test: `information-aggregator/src/pipeline/dedupe-near.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { dedupeNear } from "./dedupe-near";

describe("dedupeNear", () => {
  test("compresses highly similar titles in the same run", () => {
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", canonicalUrl: "https://a.com", processedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "openai released new model", canonicalUrl: "https://b.com", processedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items as never);
    expect(deduped.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/dedupe-near.test.ts`
Expected: FAIL because near dedup is missing.

**Step 3: Write minimal implementation**

Implement lightweight similarity:
- tokenize normalized title
- compare overlap ratio
- merge only when above threshold and within same time window

Add a comment explaining why the MVP uses lightweight similarity instead of embeddings.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/dedupe-near.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/dedupe-near.ts information-aggregator/src/pipeline/dedupe-near.test.ts
git commit -m "feat: add near duplicate compression"
```

### Task 15: Add Topic Matching Logic

**Files:**
- Create: `information-aggregator/src/pipeline/topic-match.ts`
- Test: `information-aggregator/src/pipeline/topic-match.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { scoreTopicMatch } from "./topic-match";

describe("scoreTopicMatch", () => {
  test("scores include keywords positively and exclude keywords negatively", () => {
    const score = scoreTopicMatch(
      { normalizedTitle: "ai model release tutorial", normalizedText: "" },
      { includeKeywords: ["ai", "tutorial"], excludeKeywords: ["crypto"] }
    );
    expect(score).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/topic-match.test.ts`
Expected: FAIL because matcher does not exist.

**Step 3: Write minimal implementation**

Implement topic matching for:
- include keywords
- exclude keywords
- preferred sources
- blocked sources

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/topic-match.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/topic-match.ts information-aggregator/src/pipeline/topic-match.test.ts
git commit -m "feat: add topic matching"
```

### Task 16: Implement Rule-Based Ranker

**Files:**
- Create: `information-aggregator/src/pipeline/rank.ts`
- Test: `information-aggregator/src/pipeline/rank.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { rankCandidates } from "./rank";

describe("rankCandidates", () => {
  test("orders candidates by final score descending", () => {
    const ranked = rankCandidates([
      { id: "a", sourceWeightScore: 0.1, freshnessScore: 0.1, engagementScore: 0, topicMatchScore: 0.1, contentQualityAi: 0 },
      { id: "b", sourceWeightScore: 0.9, freshnessScore: 0.9, engagementScore: 0, topicMatchScore: 0.9, contentQualityAi: 0 },
    ] as never);
    expect(ranked[0]?.id).toBe("b");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/rank.test.ts`
Expected: FAIL because ranker is missing.

**Step 3: Write minimal implementation**

Implement score aggregation using the documented weight formula.

Add a comment explaining why the ranker is mixed-score rather than AI-only.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/rank.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/rank.ts information-aggregator/src/pipeline/rank.test.ts
git commit -m "feat: add ranking pipeline"
```

### Task 17: Add Run and Output Persistence

**Files:**
- Create: `information-aggregator/src/db/queries/runs.ts`
- Create: `information-aggregator/src/db/queries/outputs.ts`
- Test: `information-aggregator/src/db/queries/runs.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { createRun, finishRun } from "./runs";

describe("run persistence", () => {
  test("creates and finishes a run", () => {
    const db = createDb(":memory:");
    createRun(db, { id: "run-1", mode: "scan", sourceSelectionJson: "[]", paramsJson: "{}", status: "running", createdAt: "2026-03-09T00:00:00Z" });
    finishRun(db, "run-1", "succeeded", "2026-03-09T00:01:00Z");
    const row = db.prepare("SELECT status FROM runs WHERE id = ?").get("run-1") as { status: string };
    expect(row.status).toBe("succeeded");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/db/queries/runs.test.ts`
Expected: FAIL because run queries are missing.

**Step 3: Write minimal implementation**

Implement:
- `createRun`
- `finishRun`
- `createOutput`

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/db/queries/runs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/db/queries/runs.ts information-aggregator/src/db/queries/outputs.ts information-aggregator/src/db/queries/runs.test.ts
git commit -m "feat: add run and output persistence"
```

### Task 18: Render Scan Output

**Files:**
- Create: `information-aggregator/src/render/scan.ts`
- Test: `information-aggregator/src/render/scan.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { renderScanMarkdown } from "./scan";

describe("renderScanMarkdown", () => {
  test("renders a ranked list of results", () => {
    const markdown = renderScanMarkdown([
      { title: "Hello", url: "https://example.com", finalScore: 0.9, sourceName: "Example" },
    ] as never);
    expect(markdown).toContain("Hello");
    expect(markdown).toContain("https://example.com");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/render/scan.test.ts`
Expected: FAIL because renderer is missing.

**Step 3: Write minimal implementation**

Render:
- title
- source
- score
- URL
- optional short rationale

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/render/scan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/render/scan.ts information-aggregator/src/render/scan.test.ts
git commit -m "feat: add scan renderer"
```

### Task 19: Render Digest Output

**Files:**
- Create: `information-aggregator/src/render/digest.ts`
- Test: `information-aggregator/src/render/digest.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { renderDigestMarkdown } from "./digest";

describe("renderDigestMarkdown", () => {
  test("renders top sections and grouped highlights", () => {
    const markdown = renderDigestMarkdown({
      highlights: ["Top trend"],
      clusters: [
        { title: "New model released", summary: "Why it matters", url: "https://example.com" },
      ],
    } as never);
    expect(markdown).toContain("Top trend");
    expect(markdown).toContain("New model released");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/render/digest.test.ts`
Expected: FAIL because renderer is missing.

**Step 3: Write minimal implementation**

Render sections:
- highlights
- top clusters
- supporting items appendix

Use a stable format so later AI narration can slot in without changing layout.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/render/digest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/render/digest.ts information-aggregator/src/render/digest.test.ts
git commit -m "feat: add digest renderer"
```

### Task 20: Add AI Client Abstraction

**Files:**
- Create: `information-aggregator/src/ai/client.ts`
- Create: `information-aggregator/src/ai/prompts.ts`
- Test: `information-aggregator/src/ai/client.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createAiClient } from "./client";

describe("createAiClient", () => {
  test("returns null when no provider config exists", () => {
    expect(createAiClient({})).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/ai/client.test.ts`
Expected: FAIL because client module is missing.

**Step 3: Write minimal implementation**

Implement:
- AI client interface
- null-safe factory
- prompt builders for:
  - candidate quality scoring
  - cluster summary
  - digest narration

Do not integrate the client into the main pipeline yet.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/ai/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/ai
git commit -m "feat: add ai client abstraction"
```

### Task 21: Add Cluster Builder

**Files:**
- Create: `information-aggregator/src/pipeline/cluster.ts`
- Test: `information-aggregator/src/pipeline/cluster.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { buildClusters } from "./cluster";

describe("buildClusters", () => {
  test("creates clusters from ranked candidate items", () => {
    const clusters = buildClusters([
      { id: "1", normalizedTitle: "openai released a new model", finalScore: 0.9 },
      { id: "2", normalizedTitle: "openai releases new model", finalScore: 0.8 },
    ] as never, "run-1");
    expect(clusters.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/pipeline/cluster.test.ts`
Expected: FAIL because clustering is missing.

**Step 3: Write minimal implementation**

Implement run-scoped cluster creation using lightweight similarity.

Keep this logic simple:
- reuse near-dup style similarity
- choose highest-ranked item as canonical entry

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/pipeline/cluster.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/pipeline/cluster.ts information-aggregator/src/pipeline/cluster.test.ts
git commit -m "feat: add cluster builder"
```

### Task 22: Wire the Scan Pipeline End-to-End

**Files:**
- Modify: `information-aggregator/src/cli/index.ts`
- Create: `information-aggregator/src/cli/run-scan.ts`
- Test: `information-aggregator/src/cli/run-scan.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { runScan } from "./run-scan";

describe("runScan", () => {
  test("returns markdown output for scan mode", async () => {
    const result = await runScan({
      profileId: "default",
      dryRun: true,
    }, {
      collectSources: async () => [],
    } as never);
    expect(typeof result.markdown).toBe("string");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/cli/run-scan.test.ts`
Expected: FAIL because orchestration does not exist.

**Step 3: Write minimal implementation**

Implement orchestration:
- create run record
- collect
- normalize
- dedupe
- topic match
- rank
- render scan
- persist output

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/cli/run-scan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/cli/index.ts information-aggregator/src/cli/run-scan.ts information-aggregator/src/cli/run-scan.test.ts
git commit -m "feat: add end-to-end scan flow"
```

### Task 23: Wire the Digest Pipeline End-to-End

**Files:**
- Create: `information-aggregator/src/cli/run-digest.ts`
- Test: `information-aggregator/src/cli/run-digest.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { runDigest } from "./run-digest";

describe("runDigest", () => {
  test("returns markdown output for digest mode", async () => {
    const result = await runDigest({
      profileId: "default",
      dryRun: true,
    }, {
      collectSources: async () => [],
      buildClusters: () => [],
    } as never);
    expect(typeof result.markdown).toBe("string");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/cli/run-digest.test.ts`
Expected: FAIL because digest orchestration is missing.

**Step 3: Write minimal implementation**

Implement orchestration:
- create run
- collect
- normalize
- dedupe
- rank
- build clusters
- render digest
- persist output

AI hooks should remain optional and easy to disable.

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/cli/run-digest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/cli/run-digest.ts information-aggregator/src/cli/run-digest.test.ts
git commit -m "feat: add end-to-end digest flow"
```

### Task 24: Add Source Health Tracking

**Files:**
- Create: `information-aggregator/src/db/queries/source-health.ts`
- Modify: `information-aggregator/src/pipeline/collect.ts`
- Test: `information-aggregator/src/db/queries/source-health.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { recordSourceFailure, getSourceHealth } from "./source-health";

describe("source health", () => {
  test("increments error count on failure", () => {
    const db = createDb(":memory:");
    recordSourceFailure(db, "source-1", "timeout");
    const health = getSourceHealth(db, "source-1");
    expect(health?.errorCount).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/db/queries/source-health.test.ts`
Expected: FAIL because source health queries are missing.

**Step 3: Write minimal implementation**

Implement:
- success recording
- failure recording
- zero-item recording
- health retrieval

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/db/queries/source-health.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/db/queries/source-health.ts information-aggregator/src/db/queries/source-health.test.ts information-aggregator/src/pipeline/collect.ts
git commit -m "feat: add source health tracking"
```

### Task 25: Add CLI Commands and Help Text

**Files:**
- Modify: `information-aggregator/src/cli/index.ts`
- Modify: `information-aggregator/scripts/aggregator.ts`
- Test: `information-aggregator/src/cli/index.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { getHelpText } from "./index";

describe("CLI help", () => {
  test("mentions scan and digest commands", () => {
    const help = getHelpText();
    expect(help).toContain("scan");
    expect(help).toContain("digest");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd information-aggregator && bun test src/cli/index.test.ts`
Expected: FAIL because help text is incomplete.

**Step 3: Write minimal implementation**

Implement CLI commands:
- `scan`
- `digest`
- `config validate`

**Step 4: Run test to verify it passes**

Run: `cd information-aggregator && bun test src/cli/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add information-aggregator/src/cli/index.ts information-aggregator/scripts/aggregator.ts information-aggregator/src/cli/index.test.ts
git commit -m "feat: add cli commands"
```

### Task 26: Add Documentation and Usage Examples

**Files:**
- Modify: `information-aggregator/README.md`
- Modify: `information-aggregator/SKILL.md`
- Test: none

**Step 1: Write the failing check**

Manually confirm README is missing:
- setup instructions
- config examples
- scan example
- digest example

**Step 2: Write minimal documentation**

Add:
- project purpose
- configuration file structure
- command examples
- note that HN/Reddit/X are future work
- note that code includes concise comments for non-obvious logic

**Step 3: Verify docs are consistent**

Run: `cd information-aggregator && rg -n "scan|digest|future work|source pack" README.md SKILL.md`
Expected: matching usage and scope references in both files.

**Step 4: Commit**

```bash
git add information-aggregator/README.md information-aggregator/SKILL.md
git commit -m "docs: add usage and configuration guide"
```

### Task 27: Run Full Test Suite

**Files:**
- Modify: none
- Test: all existing test files

**Step 1: Run all tests**

Run: `cd information-aggregator && bun test`
Expected: PASS across all created tests.

**Step 2: Fix any failures**

If any test fails, fix the smallest possible issue and rerun only the failed test first, then rerun the full suite.

**Step 3: Run a smoke command**

Run: `cd information-aggregator && bun scripts/aggregator.ts --help`
Expected: help output includes `scan`, `digest`, and `config validate`.

**Step 4: Commit**

```bash
git add information-aggregator
git commit -m "test: verify aggregator mvp end to end"
```

### Task 28: Track Future Work Without Implementing It

**Files:**
- Modify: `information-aggregator/README.md`
- Modify: `information-aggregator/SKILL.md`
- Modify: `docs/plans/2026-03-09-information-aggregator-skill-design.md`
- Test: none

**Step 1: Review future-work scope**

Confirm the docs explicitly call out these deferred items:
- X adapters
- HN/Reddit
- deep enrichment
- feedback loop
- web UI
- multi-user
- embeddings

**Step 2: Add explicit defer markers if missing**

Use wording like:
- "Planned, not part of MVP"
- "Future work, intentionally excluded from current implementation"

**Step 3: Verify consistency**

Run: `rg -n "Future Work|not part of MVP|Planned" information-aggregator/README.md information-aggregator/SKILL.md docs/plans/2026-03-09-information-aggregator-skill-design.md`
Expected: all three documents clearly distinguish MVP from later phases.

**Step 4: Commit**

```bash
git add information-aggregator/README.md information-aggregator/SKILL.md docs/plans/2026-03-09-information-aggregator-skill-design.md
git commit -m "docs: clarify mvp boundaries and future work"
```
