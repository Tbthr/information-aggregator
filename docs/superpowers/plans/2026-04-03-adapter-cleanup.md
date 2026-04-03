# Adapter Cleanup & RawItem Field Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor RawItem types, rename topics→tags, unify Source types, remove deprecated adapters, and fix sources.yaml configuration issues.

**Architecture:** This is a refactoring-heavy task. Changes are concentrated in types, config loading, pipeline components, and adapters. No architectural changes — purely cleanup and type unification. Changes are sequenced to maintain type safety throughout: types first, then config loading, then pipeline components, then adapters, finally YAML configs.

**Tech Stack:** Bun/TypeScript, YAML configuration

---

## File Structure

### Files to CREATE
- `src/pipeline/filter-by-tag.ts` (replaces filter-by-topic.ts after rename)
- `config/tags.yaml` (renamed from topics.yaml)

### Files to MODIFY
- `src/types/index.ts` — RawItem, Topic→Tag, Source type changes
- `src/cli/run.ts` — loadSourcesConfig, loadTopicsConfig→loadTagsConfig
- `src/pipeline/collect.ts` — normalizeCollectedItem changes
- `src/pipeline/normalize.ts` — remove RawItemMetadata dependencies
- `src/pipeline/rank-candidates.ts` — topic→tag variable renames
- `src/pipeline/dedupe-exact.ts` — topic→tag variable renames
- `src/pipeline/dedupe-near.ts` — topic→tag variable renames
- `src/pipeline/filter-by-tag.ts` — rename from filter-by-topic.ts
- `src/adapters/build-adapters.ts` — register github-trending, remove techurls/newsnow/website
- `src/adapters/rss.ts` — remove metadataJson redundancy
- `src/adapters/json-feed.ts` — remove metadataJson redundancy
- `src/adapters/clawfeed.ts` — remove metadataJson redundancy
- `src/adapters/zeli.ts` — remove metadataJson redundancy
- `src/adapters/attentionvc.ts` — remove metadataJson redundancy
- `src/adapters/x-bird.ts` — remove metadataJson redundancy, auth from authConfigJson
- `src/adapters/github-trending.ts` — remove metadataJson redundancy
- `config/sources.yaml` — topics→tagIds, add contentType, fix www-buzzing-cc type, enable github-trending, uncomment twitter
- `.env.local` — add TWITTER_AUTH_TOKEN, TWITTER_CT0

### Files to DELETE
- `src/adapters/techurls.ts`
- `src/adapters/newsnow.ts`
- `src/adapters/website.ts`
- `src/pipeline/filter-by-pack.test.ts` (if it exists)
- `config/topics.yaml` (after rename to tags.yaml completes)

---

## Task 1: Update Types (src/types/index.ts)

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add Tag type and rename Topic→Tag**

Add at the top of types file (before RawItem):
```typescript
export interface Tag {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  includeRules: string[];
  excludeRules: string[];
  scoreBoost: number;
}

export type TagScores = Record<string, number>;
```

- [ ] **Step 2: Update RawItem interface**

Replace RawItem interface with:
```typescript
export interface RawItem {
  id: string;
  sourceId: string;
  sourceType: string;
  contentType: string;
  title: string;
  url: string;
  author?: string;
  content?: string;
  summary?: string;
  engagement?: RawItemEngagement;
  expandedUrl?: string;
  canonicalHints?: RawItemCanonicalHints;
  sourceName: string;
  publishedAt: string;
  fetchedAt: string;
  metadataJson: string;
  tagFilter?: Tag[];
}
```

- [ ] **Step 3: Add new supporting types (RawItemEngagement, RawItemCanonicalHints)**

```typescript
export interface RawItemEngagement {
  likes?: number;
  comments?: number;
  reactions?: number;
  shares?: number;
}

export interface RawItemCanonicalHints {
  hnDiscussion?: string;
  redditDiscussion?: string;
}
```

- [ ] **Step 4: Update Source interface**

Replace InlineSource and Source types with:
```typescript
export interface Source {
  type: string;
  id: string;
  name: string;
  description?: string;
  url: string;
  enabled: boolean;
  tags: Tag[];
  weightScore: number | null;
  contentType: string;
  authConfigJson: string | null;
  sourceWeightScore: number;
}
```

- [ ] **Step 5: Remove dead types**

Delete:
- `FilterContext` interface
- `ClassificationContext` interface
- `TopicScores` (replace with `TagScores` in type renames)
- `RawItemMetadata` interface and any related types
- `CANONICAL_SOURCE_KINDS` constant (or update to remove techurls, newsnow, website)

Also remove from InlineSource and Source types:
- `configJson`
- `authRef`
- `defaultTopicIds`

- [ ] **Step 6: Update FilterableItem interface in filter-by-tag.ts**

```typescript
export interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  engagementScore?: number | null;
  tagFilter?: Tag[];
}
```

Remove: `qualityScore`, `sourceKind`, `sourceDefaultTopicIds`

Note: FilterableItem will be updated in Task 5 when we modify filter-by-tag.ts.

- [ ] **Step 7: Run typecheck to verify**

Run: `bun run typecheck 2>&1`
Expected: Type errors (will be resolved as we update other files)

---

## Task 2: Rename topics.yaml → tags.yaml

**Files:**
- Rename: `config/topics.yaml` → `config/tags.yaml`

- [ ] **Step 1: Rename file**

Run: `mv config/topics.yaml config/tags.yaml`

- [ ] **Step 2: Update YAML structure**

Change `topics:` to `tags:` in the YAML file.

---

## Task 3: Update config loading (src/cli/run.ts)

**Files:**
- Modify: `src/cli/run.ts`

- [ ] **Step 1: Rename YamlTopic to YamlTag**

```typescript
interface YamlTag {
  id: string
  name?: string
  description?: string
  enabled?: boolean
  includeRules?: string[]
  excludeRules?: string[]
  scoreBoost?: number
}
```

- [ ] **Step 2: Rename loadTopicsConfig to loadTagsConfig**

```typescript
function loadTagsConfig(): Tag[] {
  const tagsYaml = yaml.load(fs.readFileSync('config/tags.yaml', 'utf-8')) as YamlTags;
  // ... rest of implementation
}
```

- [ ] **Step 3: Update loadSourcesConfig**

Changes:
- Read `config/tags.yaml` for tag resolution
- Map `tagIds` YAML field → `tags: Tag[]` (resolved)
- Map `contentType` from YAML (required, throw if missing)
- Store `authConfigJson` as JSON stringified auth object
- `sourceWeightScore` = `weightScore ?? 1`

```typescript
function loadSourcesConfig(): Source[] {
  const sourcesYaml = yaml.load(fs.readFileSync('config/sources.yaml', 'utf-8')) as YamlSources;
  const tagsYaml = yaml.load(fs.readFileSync('config/tags.yaml', 'utf-8')) as YamlTags;
  const tagMap = new Map(tagsYaml.tags.map(t => [t.id, t]));

  return sourcesYaml.sources
    .filter(s => s.enabled !== false)
    .map(s => {
      if (!s.contentType) {
        throw new Error(`Source ${s.id} is missing required contentType field`);
      }
      const resolvedTags = (s.tagIds ?? [])
        .map(id => tagMap.get(id))
        .filter((t): t is Tag => t !== undefined);

      return {
        type: s.type,
        id: s.id,
        name: s.name ?? s.id,
        url: s.url ?? '',
        enabled: true,
        tags: resolvedTags,
        weightScore: s.weightScore ?? 1,
        contentType: s.contentType,
        authConfigJson: s.auth ? JSON.stringify(s.auth) : null,
        sourceWeightScore: s.weightScore ?? 1,
      };
    });
}
```

- [ ] **Step 4: Update YamlSource interface**

```typescript
interface YamlSource {
  type: string
  id: string
  name?: string
  url?: string
  enabled?: boolean
  tagIds?: string[]       // renamed from topics
  handle?: string
  weightScore?: number     // renamed from priority
  contentType?: string     // NEW: required
  auth?: {
    authToken?: string
    ct0?: string
  }
}
```

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck 2>&1`
Expected: Type errors from collect.ts and other pipeline files (expected, we'll fix)

---

## Task 4: Update collect.ts

**Files:**
- Modify: `src/pipeline/collect.ts`

- [ ] **Step 1: Simplify normalizeCollectedItem**

Remove all metadataJson restructuring. New implementation:
```typescript
function normalizeCollectedItem(source: Source, item: RawItem): RawItem {
  return {
    ...item,
    sourceType: source.type,
    contentType: source.contentType,
    sourceName: source.name,
    tagFilter: source.tags,
  };
}
```

- [ ] **Step 2: Remove dead code from collect.ts**

Remove:
- `defaultProviderForSourceType`
- `defaultContentTypeForSourceType`
- `buildCanonicalHints`
- `parseRawItemMetadata` (if exists)
- Any `RawItemMetadata` related logic

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck 2>&1`
Expected: Type errors from normalize.ts and filter-by-tag.ts (expected)

---

## Task 5: Rename filter-by-topic.ts → filter-by-tag.ts and update

**Files:**
- Rename: `src/pipeline/filter-by-topic.ts` → `src/pipeline/filter-by-tag.ts`
- Modify: `src/pipeline/filter-by-tag.ts`

- [ ] **Step 1: Rename file**

Run: `mv src/pipeline/filter-by-topic.ts src/pipeline/filter-by-tag.ts`

- [ ] **Step 2: Update FilterableItem interface**

```typescript
export interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  engagementScore?: number | null;
  tagFilter?: Tag[];
}
```

- [ ] **Step 3: Rename all Topic→Tag references**

- `Topic` → `Tag`
- `TopicScores` → `TagScores`
- `filterByTopics` → `filterByTags`
- `classifyByTopic` → `classifyByTag`
- `getCandidateTopics` → `getCandidateTags`

- [ ] **Step 4: Update FilterableItem filtering logic**

Change from checking `sourceDefaultTopicIds` to checking `tagFilter`:
```typescript
// OLD (in filterByTags):
// Only considers topics in item.sourceDefaultTopicIds

// NEW:
// Use item.tagFilter directly (Tag[] from source)
```

- [ ] **Step 5: Remove dead functions**

Delete:
- `scoreItemByTopic` (dead code, never called)
- `classifyItemTopics` (dead code, exported but never called)
- `getCandidateTopics` (dead code, exported but never called)
- `filterByPack` (deprecated, marked in code)

- [ ] **Step 6: Update imports in other pipeline files**

Search for files importing from filter-by-topic:
Run: `grep -r "filter-by-topic" src/`
Update imports to filter-by-tag.

- [ ] **Step 7: Run typecheck**

Run: `bun run typecheck 2>&1`
Expected: Type errors from normalize.ts (expected)

---

## Task 6: Update normalize.ts

**Files:**
- Modify: `src/pipeline/normalize.ts`

- [ ] **Step 1: Remove RawItemMetadata parsing**

Remove all code that:
- Parses `metadataJson` to get `provider`, `sourceKind`, `contentType`
- Uses `parseMetadata()` or similar functions

- [ ] **Step 2: Read fields directly from RawItem**

```typescript
const sourceType = item.sourceType;
const contentType = item.contentType;
const summary = item.summary ?? "";
const engagementScore = item.engagement
  ? calculateEngagementScore(item.engagement, sourceType)
  : 0;
const sourceName = item.sourceName;
```

- [ ] **Step 3: Update tagFilter access**

```typescript
const sourceTags = item.tagFilter ?? [];
```

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck 2>&1`
Expected: Errors from adapters (expected)

---

## Task 7: Update build-adapters.ts

**Files:**
- Modify: `src/adapters/build-adapters.ts`

- [ ] **Step 1: Register githubTrending adapter**

```typescript
import { collectGitHubTrendingSource } from "./github-trending";

// In buildAdapters():
{
  // ... existing
  githubTrending: (source, options) => collectGitHubTrendingSource(source, options),
}
```

- [ ] **Step 2: Remove deprecated adapters**

Remove from buildAdapters() return:
- `techurls`
- `newsnow`
- `website`

---

## Task 8: Delete deprecated adapter files

**Files:**
- Delete: `src/adapters/techurls.ts`
- Delete: `src/adapters/newsnow.ts`
- Delete: `src/adapters/website.ts`
- Delete: `src/adapters/techurls.test.ts`
- Delete: `src/adapters/newsnow.test.ts`
- Delete: `src/adapters/website.test.ts`
- Delete: `src/pipeline/filter-by-pack.test.ts` (if exists)

- [ ] **Step 1: Delete files**

First check which files actually exist:
Run: `ls src/adapters/techurls.ts src/adapters/newsnow.ts src/adapters/website.ts 2>/dev/null`

Then delete only files that exist:
Run: `rm -f src/adapters/techurls.ts src/adapters/newsnow.ts src/adapters/website.ts && echo "Deleted deprecated adapters"`

- [ ] **Step 2: Delete filter-by-pack test if exists**

Run: `rm src/pipeline/filter-by-pack.test.ts 2>/dev/null || true`

---

## Task 9: Update adapters to remove metadataJson redundancy

**Files:**
- Modify: `src/adapters/rss.ts`
- Modify: `src/adapters/json-feed.ts`
- Modify: `src/adapters/clawfeed.ts`
- Modify: `src/adapters/zeli.ts`
- Modify: `src/adapters/attentionvc.ts`
- Modify: `src/adapters/x-bird.ts`
- Modify: `src/adapters/github-trending.ts`

**For each adapter**, the pattern is the same:

- [ ] **Step 1: Stop writing provider/sourceKind/contentType to metadataJson**

Instead of building a metadata object like:
```typescript
metadataJson: JSON.stringify({
  provider: source.kind,
  sourceKind: source.kind,
  contentType: 'article',
  ...
})
```

Write only adapter-specific fields:
```typescript
metadataJson: JSON.stringify({
  rawPublishedAt: ...,
  timeSourceField: ...,
  timeParseNote: ...,
  // NO provider, sourceKind, contentType
})
```

- [ ] **Step 2: Handle missing publishedAt**

If publishedAt is missing:
```typescript
if (!publishedAt) {
  log.warn("Skipping item without publishedAt", { url });
  continue; // skip this item
}
```

- [ ] **Step 3: x-bird adapter: read auth from authConfigJson**

Instead of reading from environment directly:
```typescript
// OLD:
const authToken = process.env.TWITTER_AUTH_TOKEN;

// NEW:
const authConfig = source.authConfigJson
  ? JSON.parse(source.authConfigJson)
  : {};
const authToken = authConfig.authToken;
```

### Adapter-specific metadataJson fields:

| Adapter | Keep in metadataJson |
|---------|---------------------|
| rss | `rawPublishedAt`, `timeSourceField`, `timeParseNote` |
| json-feed | (empty/minimal) |
| clawfeed | `userName`, `userSlug`, `digestId`, `digestType` |
| zeli | `hnId` |
| attentionvc | `tweetId`, `authorId`, `coverImageUrl`, `rank`, `category`, `tags`, `langsDetected`, `trendingTopics`, `lastMetricsUpdate`, `isBlueVerified`, `followerCount`, `accountBasedIn`, `readingTimeMinutes`, `wordCount` |
| x-bird | `tweetId`, `authorId`, `conversationId`, `media`, `article`, `quote`, `thread`, `parent` |
| github-trending | `stars`, `forks`, `todayStars`, `language`, `author`, `repo` |

### contentType by adapter (for sources.yaml):

| Adapter | contentType |
|---------|-------------|
| rss | `article` |
| json-feed | `article` |
| clawfeed | `digest` |
| zeli | `article` |
| attentionvc | `article` |
| twitter | `tweet` |
| github-trending | `repository` |

---

## Task 10: Update sources.yaml

**Files:**
- Modify: `config/sources.yaml`

- [ ] **Step 1: Rename topics → tagIds in all sources**

Run: `sed -i '' 's/^    topics:/    tagIds:/g' config/sources.yaml`

- [ ] **Step 2: Add contentType to all sources (required field)**

Add contentType to sources based on adapter type:

```yaml
# For rss, json-feed, zeli, attentionvc:
contentType: article

# For clawfeed:
contentType: digest

# For twitter:
contentType: tweet

# For github-trending:
contentType: repository
```

- [ ] **Step 3: Fix www-buzzing-cc type**

```yaml
# Change from:
- type: rss
  id: www-buzzing-cc-feed-json

# To:
- type: json-feed
  id: www-buzzing-cc-feed-json
  contentType: article
```

- [ ] **Step 4: Enable github-trending**

```yaml
- type: github-trending
  id: github-com-trending
  enabled: true   # was false
  contentType: repository
```

- [ ] **Step 5: Uncomment twitter source**

Remove `# ` from twitter/karpathy source and add contentType:
```yaml
- type: twitter
  id: karpathy
  name: Andrej Karpathy
  handle: karpathy
  enabled: true
  tagIds: [ai]
  contentType: tweet
  auth:
    authToken: ${TWITTER_AUTH_TOKEN}
    ct0: ${TWITTER_CT0}
```

- [ ] **Step 6: Run typecheck after sources.yaml changes**

Run: `bun run typecheck 2>&1`
Expected: Type errors from adapters (will be fixed in Task 9)

---

## Task 11: Update .env.local

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add Twitter auth variables**

Append to `.env.local`:
```bash
# Twitter/X 认证
TWITTER_AUTH_TOKEN=your_token_here
TWITTER_CT0=your_ct0_here
```

---

## Task 12: Update remaining pipeline files

**Files:**
- Modify: `src/pipeline/rank-candidates.ts`
- Modify: `src/pipeline/dedupe-exact.ts`
- Modify: `src/pipeline/dedupe-near.ts`

- [ ] **Step 1: Search for remaining Topic references**

Run: `grep -r "Topic\|topicIds\|filterByTopic" src/pipeline/`
Replace with Tag/tagFilter/filterByTag accordingly.

- [ ] **Step 2: Run typecheck after each file update**

Run: `bun run typecheck 2>&1`

---

## Task 13: Final verification

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck 2>&1`
Expected: No errors

- [ ] **Step 2: Run tests**

Run: `bun test 2>&1`
Expected: All tests pass

- [ ] **Step 3: Quick CLI smoke test**

Run: `bun run src/cli/run.ts --help 2>&1`
Expected: Help output without errors

---

## Task 14: Update documentation

**Files:**
- Modify: `CLAUDE.md` (if it references topics or old types)
- Modify: `README.md` (if it references old configuration format)

- [ ] **Step 1: Check CLAUDE.md for old references**

Run: `grep -i "topic\|topics\.yaml\|topics:" CLAUDE.md README.md 2>/dev/null`
Update any outdated references.

---

## Dependency Graph

```
Task 1 (Types) ──────┐
                    ├─► Task 3 (Config loading) ──► Task 4 (collect.ts)
Task 2 (Rename) ────┘                              │
                                                   ├─► Task 5 (filter-by-tag)
Task 6 (normalize.ts) ◄───────────────────────────┘
                           │
Task 7 (build-adapters) ───┤
                           │
Task 8 (Delete files) ─────┼──► Task 9 (Adapters)
                           │
Task 10 (sources.yaml) ────┘

Task 11 (.env.local) ──► Task 13 (Verification)

Task 12 (Pipeline files) ──► Task 13 (Verification)

Task 14 (Docs) ──► Done
```

---

## Execution Order

1. **Task 1**: Types — establishes new types
2. **Task 2**: topics.yaml → tags.yaml rename
3. **Task 3**: Config loading — uses new types
4. **Task 4**: collect.ts — uses new Source type
5. **Task 5**: filter-by-tag — uses Tag type
6. **Task 6**: normalize.ts — uses Tag and RawItem changes
7. **Task 7**: build-adapters.ts — registers new adapter, removes deprecated
8. **Task 8**: Delete deprecated adapter files
9. **Task 9**: Update adapters — removes metadata redundancy
10. **Task 10**: sources.yaml — fixes configuration
11. **Task 11**: .env.local — adds Twitter auth
12. **Task 12**: Update remaining pipeline files
13. **Task 13**: Final verification (typecheck + test)
14. **Task 14**: Update documentation
