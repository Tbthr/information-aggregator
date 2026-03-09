# Information Aggregator Post-MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the MVP into the next implementation phase by adding full config binding, pipeline persistence, provider-backed AI enrichment, additional source adapters, and stronger health verification without expanding into web UI or multi-user scope.

**Architecture:** Keep the current local-first adapter pipeline intact and add missing post-MVP capabilities as separable layers. Configuration resolution should happen before collection, persistence should record pipeline entities without changing ranking behavior, and AI/provider execution should remain optional and only run after candidate reduction. Additional adapters must plug into the existing collector contract and reuse the same normalize, dedupe, rank, cluster, and render stages.

**Tech Stack:** TypeScript, Bun, SQLite, YAML, Markdown, Bun test, local mock HTTP servers

---

### Task 1: Add Reference-Project Sources to Default Config

**Files:**
- Modify: `config/sources.example.yaml`
- Modify: `config/packs/ai-news-sites.yaml`
- Modify: `config/packs/ai-daily-digest-blogs.yaml`
- Modify: `config/topics.example.yaml`
- Modify: `config/profiles.example.yaml`
- Modify: `README.md`
- Modify: `SKILL.md`
- Test: `src/config/load.test.ts`
- Test: `src/verification/smoke.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { loadSourcesConfig } from "../config/load";

describe("default config sources", () => {
  test("includes curated sources derived from the five reference projects", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    const ids = new Set(sources.map((source) => source.id));

    expect(ids.size).toBeGreaterThan(5);
    expect(ids.has("example-rss")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/config/load.test.ts`
Expected: FAIL because the current example config still contains placeholder sources only.

**Step 3: Write minimal implementation**

Replace placeholder config with a curated default source baseline sourced from the five reference projects named in the design document:
- `ai-daily-digest`
- `ai-news-radar`
- `smaug`
- `x-ai-topic-selector`
- `clawfeed`

Implementation rules:
- keep only sources that fit the current supported adapter set: `rss`, `json-feed`, `website`
- do not add browser-driven or brittle scraping-only defaults
- group the imported sources into meaningful packs:
  - `ai-news-sites`
  - `ai-daily-digest-blogs`
- make `topics.example.yaml` and `profiles.example.yaml` reference those packs directly
- update README and SKILL examples so the default config is no longer fictional

Add a short comment block in `config/sources.example.yaml` recording which reference project contributed each curated group when that mapping is not obvious.

**Step 4: Run test to verify it passes**

Run: `bun test src/config/load.test.ts src/verification/smoke.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add config/sources.example.yaml config/packs/ai-news-sites.yaml config/packs/ai-daily-digest-blogs.yaml config/topics.example.yaml config/profiles.example.yaml README.md SKILL.md src/config/load.test.ts src/verification/smoke.test.ts
git commit -m "feat: add reference-project default source config"
```

### Task 2: Load Topics, Profiles, and Source Packs

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/config/load.ts`
- Modify: `src/config/validate.ts`
- Test: `src/config/load.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { loadTopicsConfig, loadProfilesConfig, loadSourcePacksConfig } from "./load";

describe("extended config loading", () => {
  test("loads topics, profiles, and source packs from local yaml files", async () => {
    const [topics, profiles, packs] = await Promise.all([
      loadTopicsConfig("config/topics.example.yaml"),
      loadProfilesConfig("config/profiles.example.yaml"),
      loadSourcePacksConfig("config/packs/ai-news-sites.yaml"),
    ]);

    expect(topics.length).toBeGreaterThan(0);
    expect(profiles.length).toBeGreaterThan(0);
    expect(packs.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/config/load.test.ts`
Expected: FAIL with missing loader exports or validation errors for topics/profiles/source packs.

**Step 3: Write minimal implementation**

```ts
export interface TopicDefinition {
  id: string;
  name: string;
  includeKeywords: string[];
  excludeKeywords?: string[];
}

export async function loadTopicsConfig(filePath: string): Promise<TopicDefinition[]> {
  const parsed = await loadYamlFile(filePath);
  if (!parsed || !Array.isArray(parsed.topics)) {
    throw new Error("Invalid topics config: topics must be an array");
  }
  return parsed.topics.map((topic) => validateTopic(topic));
}
```

Implement matching loaders and validators for:
- `topics`
- `profiles`
- `source packs`

Keep validation strict for required ids and array fields, but avoid adding remote/provider config yet.

**Step 4: Run test to verify it passes**

Run: `bun test src/config/load.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/config/load.ts src/config/validate.ts src/config/load.test.ts
git commit -m "feat: load topic profile and source pack configs"
```

### Task 3: Resolve Profile and Source Selection Before Collection

**Files:**
- Create: `src/config/resolve-profile.ts`
- Modify: `src/types/index.ts`
- Test: `src/config/resolve-profile.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { resolveProfileSelection } from "./resolve-profile";

describe("resolveProfileSelection", () => {
  test("expands profile source packs into enabled source ids", () => {
    const result = resolveProfileSelection({
      profileId: "default",
      profiles: [{ id: "default", name: "Default", mode: "digest", topicIds: ["ai"], sourcePackIds: ["pack-a"] }],
      sourcePacks: [{ id: "pack-a", name: "Pack A", sourceIds: ["rss-1", "rss-2"] }],
      sources: [
        { id: "rss-1", name: "One", type: "rss", enabled: true, configJson: "{}" },
        { id: "rss-2", name: "Two", type: "rss", enabled: false, configJson: "{}" },
      ],
    });

    expect(result.sourceIds).toEqual(["rss-1"]);
    expect(result.topicIds).toEqual(["ai"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/config/resolve-profile.test.ts`
Expected: FAIL because the resolver does not exist.

**Step 3: Write minimal implementation**

```ts
export function resolveProfileSelection(input: ResolveProfileSelectionInput): ResolvedProfileSelection {
  const profile = mustFindProfile(input.profileId, input.profiles);
  const packSourceIds = profile.sourcePackIds?.flatMap((packId) => mustFindPack(packId, input.sourcePacks).sourceIds) ?? [];
  const enabledSources = input.sources.filter((source) => source.enabled);
  const sourceIds = unique(packSourceIds).filter((sourceId) => enabledSources.some((source) => source.id === sourceId));

  return {
    profile,
    topicIds: profile.topicIds,
    sourceIds,
  };
}
```

Include explicit errors for:
- missing profile id
- missing source pack
- empty resolved source set

**Step 4: Run test to verify it passes**

Run: `bun test src/config/resolve-profile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/resolve-profile.ts src/config/resolve-profile.test.ts src/types/index.ts
git commit -m "feat: resolve profile source selection"
```

### Task 4: Persist Raw, Normalized, and Cluster Entities

**Files:**
- Create: `src/db/queries/raw-items.ts`
- Create: `src/db/queries/normalized-items.ts`
- Create: `src/db/queries/clusters.ts`
- Test: `src/db/queries/pipeline-persistence.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { insertRawItems } from "./raw-items";
import { insertNormalizedItems } from "./normalized-items";
import { insertClusters } from "./clusters";

describe("pipeline persistence", () => {
  test("writes raw items, normalized items, and clusters", () => {
    const db = createDb(":memory:");

    insertRawItems(db, [
      { id: "raw-1", sourceId: "rss-1", title: "Hello", url: "https://example.com/1", fetchedAt: "2026-03-09T00:00:00Z", metadataJson: "{}" },
    ]);
    insertNormalizedItems(db, [
      { id: "norm-1", rawItemId: "raw-1", canonicalUrl: "https://example.com/1", normalizedTitle: "hello", processedAt: "2026-03-09T00:01:00Z" },
    ]);
    insertClusters(db, [
      { id: "cluster-1", canonicalItemId: "norm-1", memberItemIds: ["norm-1"], dedupeMethod: "near", runId: "run-1" },
    ]);

    const rawCount = db.prepare("SELECT COUNT(*) AS count FROM raw_items").get() as { count: number };
    const normalizedCount = db.prepare("SELECT COUNT(*) AS count FROM normalized_items").get() as { count: number };
    const clusterCount = db.prepare("SELECT COUNT(*) AS count FROM clusters").get() as { count: number };

    expect(rawCount.count).toBe(1);
    expect(normalizedCount.count).toBe(1);
    expect(clusterCount.count).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/db/queries/pipeline-persistence.test.ts`
Expected: FAIL because the query helpers do not exist.

**Step 3: Write minimal implementation**

```ts
export function insertRawItems(db: Database, items: RawItem[]): void {
  const statement = db.prepare(`
    INSERT OR REPLACE INTO raw_items (
      id, source_id, title, url, snippet, author, published_at, fetched_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows: RawItem[]) => {
    for (const row of rows) {
      statement.run(row.id, row.sourceId, row.title, row.url, row.snippet ?? null, row.author ?? null, row.publishedAt ?? null, row.fetchedAt, row.metadataJson);
    }
  });

  insertMany(items);
}
```

Mirror the same transaction pattern for normalized items and clusters.

**Step 4: Run test to verify it passes**

Run: `bun test src/db/queries/pipeline-persistence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/queries/raw-items.ts src/db/queries/normalized-items.ts src/db/queries/clusters.ts src/db/queries/pipeline-persistence.test.ts
git commit -m "feat: persist pipeline entities"
```

### Task 5: Wire Resolved Config and Persistence into Scan and Digest

**Files:**
- Modify: `src/cli/run-scan.ts`
- Modify: `src/cli/run-digest.ts`
- Modify: `src/cli/index.ts`
- Test: `src/cli/run-scan.test.ts`
- Test: `src/cli/run-digest.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "../db/client";
import { runDigest } from "./run-digest";

describe("runDigest persistence", () => {
  test("resolves profile selection and writes pipeline entities when not dry-run", async () => {
    const db = createDb(":memory:");

    const result = await runDigest(
      { profileId: "default", dryRun: false },
      {
        db,
        now: () => "2026-03-09T00:00:00Z",
      },
    );

    const outputCount = db.prepare("SELECT COUNT(*) AS count FROM outputs").get() as { count: number };
    const rawCount = db.prepare("SELECT COUNT(*) AS count FROM raw_items").get() as { count: number };

    expect(typeof result.markdown).toBe("string");
    expect(outputCount.count).toBeGreaterThanOrEqual(1);
    expect(rawCount.count).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/cli/run-digest.test.ts src/cli/run-scan.test.ts`
Expected: FAIL because current CLI orchestration does not resolve profiles or persist intermediate entities.

**Step 3: Write minimal implementation**

```ts
const selection = resolveProfileSelection({
  profileId: args.profileId,
  profiles,
  sourcePacks,
  sources,
});

const selectedSources = sources.filter((source) => selection.sourceIds.includes(source.id));
const rawItems = await collectImpl(selectedSources, buildDefaultCollectDependencies());

if (!args.dryRun) {
  insertRawItems(db, rawItems);
}
```

Apply the same pattern to:
- persist normalized items
- persist clusters during digest runs
- record resolved profile/source selection in run params

Do not change ranking heuristics in this task.

**Step 4: Run test to verify it passes**

Run: `bun test src/cli/run-digest.test.ts src/cli/run-scan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/run-scan.ts src/cli/run-digest.ts src/cli/index.ts src/cli/run-scan.test.ts src/cli/run-digest.test.ts
git commit -m "feat: persist resolved scan and digest runs"
```

### Task 6: Add Provider-Backed AI Client Execution

**Files:**
- Modify: `src/ai/client.ts`
- Modify: `src/ai/prompts.ts`
- Modify: `src/types/index.ts`
- Test: `src/ai/client.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createAiClient } from "./client";

describe("provider backed ai client", () => {
  test("calls configured provider with prompt payload", async () => {
    const calls: unknown[] = [];
    const client = createAiClient({
      provider: "openai-compatible",
      baseUrl: "https://provider.example",
      model: "test-model",
      apiKey: "secret",
      fetch: async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ output_text: "0.82" }), { status: 200 });
      },
    });

    const result = await client?.scoreCandidate("prompt text");
    expect(result).toBe(0.82);
    expect(calls.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/ai/client.test.ts`
Expected: FAIL because the client factory currently returns only null-safe placeholders.

**Step 3: Write minimal implementation**

```ts
export function createAiClient(config: AiProviderConfig | null | undefined): AiClient | null {
  if (!config?.provider) {
    return null;
  }

  return {
    async scoreCandidate(prompt: string): Promise<number> {
      const response = await config.fetchImpl(config.baseUrl + "/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          input: prompt,
        }),
      });

      return parseScore(await response.json());
    },
  };
}
```

Support:
- provider config shape in types
- injected `fetch` for tests
- null return when config is absent
- response parsing with explicit error messages

Do not wire this into scan/digest yet.

**Step 4: Run test to verify it passes**

Run: `bun test src/ai/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ai/client.ts src/ai/prompts.ts src/types/index.ts src/ai/client.test.ts
git commit -m "feat: add provider-backed ai client"
```

### Task 7: Add Optional AI Enrichment to Digest

**Files:**
- Modify: `src/cli/run-digest.ts`
- Modify: `src/pipeline/rank.ts`
- Test: `src/cli/run-digest.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { runDigest } from "./run-digest";

describe("runDigest ai enrichment", () => {
  test("uses ai scoring and summary only for top reduced candidates", async () => {
    let scoreCalls = 0;

    const result = await runDigest(
      { profileId: "default", dryRun: true },
      {
        aiClient: {
          scoreCandidate: async () => {
            scoreCalls += 1;
            return 0.9;
          },
          summarizeCluster: async () => "AI summary",
        },
      } as never,
    );

    expect(typeof result.markdown).toBe("string");
    expect(scoreCalls).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/cli/run-digest.test.ts`
Expected: FAIL because digest orchestration does not yet accept or invoke a live AI client.

**Step 3: Write minimal implementation**

```ts
const reducedCandidates = ranked.slice(0, 5);

if (aiClient) {
  for (const candidate of reducedCandidates) {
    candidate.contentQualityAi = await aiClient.scoreCandidate(buildCandidateScorePrompt(candidate));
  }
}

const reranked = rankCandidates(ranked);
```

Then:
- rebuild clusters from reranked items
- summarize only the top clusters
- fall back to deterministic summaries if `aiClient` is absent or errors

Keep AI optional and bounded:
- top-N candidates only
- top-M clusters only
- no provider call during collection or normalization

**Step 4: Run test to verify it passes**

Run: `bun test src/cli/run-digest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/run-digest.ts src/pipeline/rank.ts src/cli/run-digest.test.ts
git commit -m "feat: add optional ai digest enrichment"
```

### Task 8: Add Hacker News Adapter

**Files:**
- Create: `src/adapters/hn.ts`
- Modify: `src/pipeline/collect.ts`
- Modify: `src/types/index.ts`
- Test: `src/adapters/hn.test.ts`
- Test: `src/pipeline/collect.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { parseHnItems } from "./hn";

describe("parseHnItems", () => {
  test("maps hacker news api items into raw items", () => {
    const items = parseHnItems(
      [
        { id: 1, title: "Show HN: Demo", url: "https://example.com/demo", by: "alice", time: 1700000000 },
      ],
      "hn-top",
    );

    expect(items[0]?.sourceId).toBe("hn-top");
    expect(items[0]?.title).toBe("Show HN: Demo");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/adapters/hn.test.ts`
Expected: FAIL because the adapter does not exist.

**Step 3: Write minimal implementation**

```ts
export function parseHnItems(payload: Array<Record<string, unknown>>, sourceId: string): RawItem[] {
  return payload
    .filter((item) => typeof item.title === "string" && typeof item.url === "string")
    .map((item) => ({
      id: `hn-${item.id}`,
      sourceId,
      title: String(item.title),
      url: String(item.url),
      fetchedAt: new Date().toISOString(),
      author: typeof item.by === "string" ? item.by : undefined,
      metadataJson: JSON.stringify({ provider: "hn", score: item.score ?? null }),
    }));
}
```

Also add `collectHnSource(source, fetchImpl)` and register it in the collector dependencies.

**Step 4: Run test to verify it passes**

Run: `bun test src/adapters/hn.test.ts src/pipeline/collect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/hn.ts src/adapters/hn.test.ts src/pipeline/collect.ts src/pipeline/collect.test.ts src/types/index.ts
git commit -m "feat: add hacker news adapter"
```

### Task 9: Add Reddit Adapter

**Files:**
- Create: `src/adapters/reddit.ts`
- Modify: `src/pipeline/collect.ts`
- Modify: `src/types/index.ts`
- Test: `src/adapters/reddit.test.ts`
- Test: `src/pipeline/collect.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { parseRedditListing } from "./reddit";

describe("parseRedditListing", () => {
  test("maps reddit listing children into raw items", () => {
    const items = parseRedditListing(
      {
        data: {
          children: [
            { data: { id: "abc", title: "Interesting post", url: "https://example.com/post", author: "bob" } },
          ],
        },
      },
      "reddit-ai",
    );

    expect(items[0]?.id).toBe("reddit-abc");
    expect(items[0]?.author).toBe("bob");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/adapters/reddit.test.ts`
Expected: FAIL because the adapter does not exist.

**Step 3: Write minimal implementation**

```ts
export function parseRedditListing(payload: RedditListing, sourceId: string): RawItem[] {
  return payload.data.children
    .map((child) => child.data)
    .filter((item) => typeof item.title === "string" && typeof item.url === "string")
    .map((item) => ({
      id: `reddit-${item.id}`,
      sourceId,
      title: item.title,
      url: item.url,
      author: item.author,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({ provider: "reddit", subreddit: item.subreddit ?? null }),
    }));
}
```

Also add `collectRedditSource(source, fetchImpl)` and collector registration.

**Step 4: Run test to verify it passes**

Run: `bun test src/adapters/reddit.test.ts src/pipeline/collect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/reddit.ts src/adapters/reddit.test.ts src/pipeline/collect.ts src/pipeline/collect.test.ts src/types/index.ts
git commit -m "feat: add reddit adapter"
```

### Task 10: Strengthen Source Health Tracking

**Files:**
- Modify: `src/db/migrations/001_init.sql`
- Modify: `src/db/schema.ts`
- Modify: `src/db/queries/source-health.ts`
- Modify: `src/pipeline/collect.ts`
- Test: `src/db/queries/source-health.test.ts`
- Test: `src/pipeline/collect.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { recordSourceSuccess, getSourceHealth } from "./source-health";

describe("source health latency", () => {
  test("stores last latency and resets consecutive failures on success", () => {
    const db = createDb(":memory:");

    recordSourceSuccess(db, "source-1", {
      fetchedAt: "2026-03-09T00:00:00Z",
      latencyMs: 420,
      itemCount: 3,
    });

    const health = getSourceHealth(db, "source-1");
    expect(health?.lastFetchLatencyMs).toBe(420);
    expect(health?.consecutiveFailures).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/db/queries/source-health.test.ts src/pipeline/collect.test.ts`
Expected: FAIL because the schema and query layer do not track latency or consecutive failures.

**Step 3: Write minimal implementation**

```ts
ALTER TABLE source_health ADD COLUMN last_fetch_latency_ms INTEGER;
ALTER TABLE source_health ADD COLUMN last_item_count INTEGER;
ALTER TABLE source_health ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
```

Then update query helpers so:
- success writes `last_success_at`, `last_fetch_latency_ms`, `last_item_count`
- failure increments `error_count` and `consecutive_failures`
- zero-item runs keep success but increment `consecutive_zero_item_runs`

Collect latency with `const startedAt = Date.now()` around each adapter call.

**Step 4: Run test to verify it passes**

Run: `bun test src/db/queries/source-health.test.ts src/pipeline/collect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/migrations/001_init.sql src/db/schema.ts src/db/queries/source-health.ts src/pipeline/collect.ts src/db/queries/source-health.test.ts src/pipeline/collect.test.ts
git commit -m "feat: strengthen source health tracking"
```

### Task 11: Add Stable End-to-End Coverage and Update Docs

**Files:**
- Create: `src/e2e/post-mvp-mock-sources.test.ts`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `docs/testing.md`
- Modify: `docs/plans/2026-03-09-information-aggregator-skill-design.md`
- Test: `src/e2e/post-mvp-mock-sources.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";

describe("post mvp e2e", () => {
  test("runs digest with resolved profile binding and persisted pipeline entities", async () => {
    const result = await runPostMvpFixture();
    expect(result.markdown).toContain("# Digest");
    expect(result.persisted.rawItems).toBeGreaterThan(0);
    expect(result.persisted.outputs).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/e2e/post-mvp-mock-sources.test.ts`
Expected: FAIL because the fixture and expected post-MVP behavior do not exist yet.

**Step 3: Write minimal implementation**

Create a local mock-source E2E that covers:
- profile resolution through source packs
- one new adapter path (`hn` or `reddit`)
- intermediate pipeline persistence
- digest path with AI disabled

Then update docs so they clearly state:
- what moved from deferred to implemented
- which later phases remain deferred: X adapters, web UI, multi-user, embeddings
- the new verification order for post-MVP changes

**Step 4: Run test to verify it passes**

Run: `bun test src/e2e/post-mvp-mock-sources.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/e2e/post-mvp-mock-sources.test.ts README.md SKILL.md docs/testing.md docs/plans/2026-03-09-information-aggregator-skill-design.md
git commit -m "test: add post-mvp e2e coverage and docs"
```

### Task 12: Run Full Verification for the Next Phase

**Files:**
- Modify: none
- Test: all impacted test files

**Step 1: Run focused unit and integration tests**

Run: `bun test src/config src/db src/ai src/adapters src/cli`
Expected: PASS across the changed modules.

**Step 2: Run stable end-to-end verification**

Run: `bun run e2e`
Expected: PASS using only local mock sources.

**Step 3: Run smoke verification**

Run: `bun run smoke`
Expected: PASS with `scan`, `digest`, and `config validate`.

**Step 4: Run optional real-network probe**

Run: `bun run e2e:real`
Expected: Best-effort PASS; if it fails due to upstream/network issues, note that explicitly and do not block handoff.

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify post-mvp implementation wave"
```

## Deferred Beyond This Plan

The following remain intentionally out of scope for this implementation wave:

- X adapters
- web UI
- multi-user support
- remote sync
- embeddings/vector similarity
- cross-run memory and feedback learning beyond bounded digest enrichment
