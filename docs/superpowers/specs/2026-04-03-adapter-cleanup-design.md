# Adapter Cleanup & RawItem Field Refactor

**日期**: 2026-04-03
**状态**: 设计完成，待实现

---

## 背景

基于 `adapter_verification_report.md` 的验收结果，发现以下问题：

1. **字段冗余**: `RawItem.metadataJson` 中的 `provider`、`sourceKind`、`contentType` 与 RawItem 顶层或 YAML 配置重复
2. **废弃 adapter 未清理**: `techurls`、`newsnow`、`website` adapter 已无对应数据源
3. **类型不匹配**: `www-buzzing-cc-feed-json` 在 `sources.yaml` 中声明为 `type: rss`，实际是 JSON Feed 格式
4. **GitHub-Trending 未注册**: adapter 存在但未在 `buildAdapters()` 中注册
5. **topic 概念混乱**: `topicIds` 仅存 id 字符串，过滤时需跨数组 join；命名与功能不符（实际起 tag 过滤作用）

---

## 配置加载与 Pipeline 流程

```
sources.yaml ──loadSourcesConfig()──→ Source[]
                                       type: string
                                       id: string
                                       name: string
                                       description?: string
                                       url: string
                                       enabled: boolean
                                       tags: Tag[]           ← 解析自 tags.yaml
                                       weightScore: number    ← priority，默认 1
                                       contentType: string    ← 必填
                                       authConfigJson: string | null  ← auth 对象序列化

tags.yaml ──loadTagsConfig()──→ Tag[]
  id: string
  name: string
  description?: string
  enabled: boolean
  includeRules: string[]
  excludeRules: string[]
  scoreBoost: number

Pipeline 流程:

collect ──→ RawItem (tagFilter: Tag[])
   ↓
normalize ──→ normalizedArticle (tagFilter: Tag[])
   ↓
filterByTags (直接用 Tag[] 对象)
   ↓
rankCandidates (finalScore = weightScore×0.4 + engagementScore×0.15)
   ↓
dedupeExact → dedupeNear
   ↓
enrichArticles
   ↓
generateDailyReport
```

---

## 改动 1: RawItem 类型重构

### 类型变更

```typescript
// src/types/index.ts

export interface RawItem {
  id: string;
  sourceId: string;
  sourceType: string;        // 从 source.type 读取
  contentType: string;       // 从 source.contentType 读取
  title: string;
  url: string;
  author?: string;
  content?: string;           // 正文内容（部分 adapter 有）
  summary?: string;            // 摘要/描述
  engagement?: RawItemEngagement; // 互动信号
  expandedUrl?: string;        // 展开后的外链 URL
  canonicalHints?: RawItemCanonicalHints; // URL 扩展提示
  sourceName: string;         // 来源名称，从 source.name 读取（collect.ts 注入）
  publishedAt: string;          // 非空，缺失则 warn + 跳过该 item
  fetchedAt: string;
  metadataJson: string;          // 纯 JSON 字符串，adapter 内部自定义格式
  tagFilter?: Tag[];             // 标签过滤上下文（运行时注入）
}
```

### metadataJson 变更

adapter 构建 RawItem 时，`metadataJson` 退化为纯 JSON 字符串，只包含该 adapter 特有的字段，**不再包含** `provider`、`sourceKind`、`contentType`、`summary`、`content`、`engagement`、`expandedUrl`、`canonicalHints`、`sourceName`（这些已提升到 RawItem 顶层或由 collect.ts 注入）。

`sourceName` 由 `normalizeCollectedItem` 从 `source.name` 注入，adapter 无需处理。

### publishedAt 非空处理

adapter 构建 RawItem 时：
- 能获取到时间戳 → 正常写入 `publishedAt`
- 无法获取时间戳 → log.warn 并**跳过该 item**，不写入 RawItem

---

## 改动 2: topics → tags 全面重命名

### 文件重命名

| 旧 | 新 |
|---|---|
| `config/topics.yaml` | `config/tags.yaml` |
| `src/pipeline/filter-by-topic.ts` | `src/pipeline/filter-by-tag.ts` |

### 类型重命名

| 旧 | 新 |
|---|---|
| `interface Topic` | `interface Tag` |
| `type TopicScores` | `type TagScores` |

### 删除的类型/变量

| 删除项 | 原因 |
|---|---|
| `interface FilterContext` | 已被 `tagFilter: Tag[]` 替代 |
| `interface ClassificationContext` | 死代码，从未使用 |
| `sourceDefaultTopicIds` | 已被 `tagFilter: Tag[]` 替代 |
| `FilterableItem.qualityScore` | 永远为 undefined，条件永不触发，死代码 |
| `FilterableItem.sourceKind` | 在过滤中从未使用，死代码 |
| `function classifyItemTopics()` | 死代码，导出但从未被调用 |
| `function scoreItemByTopic()` | 死代码，导出但从未被调用 |
| `function filterByPack()` | 仅 `filter-by-pack.test.ts` 使用，代码中标记为 `@deprecated` |

### 函数/变量重命名

| 旧 | 新 |
|---|---|
| `filterByTopics()` | `filterByTags()` |
| `classifyByTopic()` | `classifyByTag()` |
| `getCandidateTopics()` | `getCandidateTags()` |
| `loadTopicsConfig()` | `loadTagsConfig()` |

### tags.yaml 结构

```yaml
# config/tags.yaml

tags:
  - id: github
    name: GitHub 趋势
    description: 关注 GitHub 上的热门开源项目...
    enabled: true
    includeRules: []
    excludeRules: []
    scoreBoost: 1.0

  - id: karpathy-picks
    name: Karpathy 精选技术博客
    # ...
```

---

## 改动 3: Source 类型统一化

### Source 定义

```typescript
// src/types/index.ts

export interface Source {
  // === YAML 映射 ===
  type: string;                    // sources.yaml.type
  id: string;                       // sources.yaml.id
  name: string;                     // sources.yaml.name，无则用 id 填充
  description?: string;             // sources.yaml.description
  url: string;                      // sources.yaml.url
  enabled: boolean;                 // sources.yaml.enabled
  tags: Tag[];                      // sources.yaml.tagIds 解析后的 Tag[] 对象
  weightScore: number | null;       // sources.yaml.priority，可空，默认 1
  contentType: string;              // sources.yaml.contentType，必填
  authConfigJson: string | null;   // sources.yaml.auth 对象 JSON 序列化，可空

  // === 运行时字段 ===
  sourceWeightScore: number;         // = weightScore ?? 1
}
```

**废除**：`InlineSource`、`configJson`、`authRef`、`defaultTopicIds`。

### loadSourcesConfig() 实现

```typescript
// src/cli/run.ts

function loadSourcesConfig(): Source[] {
  const sourcesYaml = yaml.load(fs.readFileSync('config/sources.yaml', 'utf-8')) as YamlSources;
  const tagsYaml = yaml.load(fs.readFileSync('config/tags.yaml', 'utf-8')) as YamlTags;
  const tagMap = new Map(tagsYaml.tags.map(t => [t.id, t]));

  return sourcesYaml.sources
    .filter(s => s.enabled !== false)
    .map(s => {
      const resolvedTags = (s.tagIds ?? [])
        .map(id => tagMap.get(id))
        .filter((t): t is Tag => t !== undefined);

      return {
        type: s.type,
        id: s.id,
        name: s.name ?? s.id,
        description: s.description,
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

---

## 改动 4: sources.yaml 改造

### 4.1 字段重命名

- `topics` → `tagIds`

### 4.2 新增必填字段

- 所有 source 必须补 `contentType` 字段，缺失时 `loadSourcesConfig()` 抛出异常并终止运行

### 4.3 修正类型错误

```yaml
# 修改前
- type: rss
  id: www-buzzing-cc-feed-json

# 修改后
- type: json-feed
  id: www-buzzing-cc-feed-json
  contentType: article
```

### 4.4 启用 GitHub-Trending

```yaml
- type: github-trending
  id: github-com-trending
  enabled: true   # false → true
  contentType: repository
```

### 4.5 恢复 Twitter/X 源

取消注释，恢复 `twitter` 源配置，使用 `authConfigJson`（通过 `auth` 对象传入）：

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

### 4.6 contentType 参考值

| sourceType | contentType |
|---|---|
| `rss` | `article` |
| `json-feed` | `article` |
| `clawfeed` | `digest` |
| `zeli` | `article` |
| `attentionvc` | `article` |
| `twitter` | `tweet` |
| `github-trending` | `repository` |

---

## 改动 5: build-adapters.ts 改造

### 5.1 注册 GitHub-Trending

```typescript
import { collectGitHubTrendingSource } from "./github-trending";

export function buildAdapters(): Record<string, AdapterFn> {
  return {
    // ... 现有 adapters
    githubTrending: (source, options) => collectGitHubTrendingSource(source, options),
  };
}
```

### 5.2 移除废弃 adapter

移除 `techurls`、`newsnow`、`website` 的注册。

---

## 改动 6: 删除废弃文件

| 删除文件 | 原因 |
|---|---|
| `src/adapters/techurls.ts` | adapter 已废弃 |
| `src/adapters/newsnow.ts` | adapter 已废弃 |
| `src/adapters/website.ts` | adapter 已废弃 |
| `src/adapters/techurls.test.ts` | 对应 adapter 已删除 |
| `src/adapters/newsnow.test.ts` | 对应 adapter 已删除 |

---

## 改动 7: Adapter 统一改造

**注意**：`sourceType` 和 `contentType` 由 `normalizeCollectedItem`（collect.ts）从 `source` 注入，adapter **无需**设置这两个字段。

每个 adapter 构建 RawItem 时：

1. **`metadataJson`** — 不再写入 `provider`、`sourceKind`、`contentType`，只写 adapter 特有字段
2. **`publishedAt`** — 无法获取时 warn + 跳过该 item
3. **auth** — 从 `source.authConfigJson` `JSON.parse()` 获取（x-bird 等需要认证的 adapter）

### 需改造的 adapter

| Adapter | metadataJson 特有字段 |
|---|---|
| `rss` | `rawPublishedAt`, `timeSourceField`, `timeParseNote` |
| `json-feed` | （无特有字段） |
| `clawfeed` | `userName`, `userSlug`, `digestId`, `digestType` |
| `zeli` | `hnId` |
| `attentionvc` | `tweetId`, `authorId`, `coverImageUrl`, `rank`, `category`, `tags`, `langsDetected`, `trendingTopics`, `lastMetricsUpdate`, `isBlueVerified`, `followerCount`, `accountBasedIn`, `readingTimeMinutes`, `wordCount` |
| `x-bird` | `tweetId`, `authorId`, `conversationId`, `media`, `article`, `quote`, `thread`, `parent` |
| `github-trending` | `stars`, `forks`, `todayStars`, `language`, `author`, `repo` |

**注意**：adapter 将不再把 `authorName`（→ RawItem.author）、`summary`（→ RawItem.summary）、`engagement`（→ RawItem.engagement）、`expandedUrl`（→ RawItem.expandedUrl）、`sourceName`（→ Source.name）写入 metadataJson。

---

## 改动 8: collect.ts 改造

### normalizeCollectedItem 变更

```typescript
function normalizeCollectedItem(source: Source, item: RawItem): RawItem {
  return {
    ...item,
    // sourceType/contentType/sourceName 由 collect.ts 从 source 注入
    sourceType: source.type,
    contentType: source.contentType,
    sourceName: source.name,
    // tagFilter 直接使用 Tag[] 对象
    tagFilter: source.tags,
  };
}
```

**移除的函数/变量**：
- `collect.ts` 中的 `defaultProviderForSourceType`、`defaultContentTypeForSourceType`、`buildCanonicalHints`
- `collect.ts` 中 `normalizeCollectedItem` 对 `RawItemMetadata` 的重组（不再构造 provider/sourceKind/contentType）

`canonicalHints` 从 `RawItem.expandedUrl` 直接读取，adapter 直接赋值到 RawItem 顶层。

---

## 改动 9: filter-by-tag.ts 改造

### 过滤语义

```typescript
// filterByTags: item 必须匹配 source 的所有 tags
// 对每个 tag：
//   excludeRules: 命中任一 → 过滤（OR across exclude rules within tag）
//   includeRules: 至少一个 tag 的 includeRules 命中 → 通过（OR across tags）
// 若 item 未匹配任何 tag → 不进入后续 pipeline
```

### 函数签名变更

```typescript
// 旧
filterByTopics(items: FilterableItem[], topics: Topic[]): FilterableItem[]

// 新
filterByTags(items: FilterableItem[], tags: Tag[]): FilterableItem[]
```

### FilterableItem 变更

```typescript
export interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  engagementScore?: number | null;
  tagFilter?: Tag[];
}
```

---

## 改动 10: normalize.ts 改造

### 移除的逻辑

- `RawItemMetadata` 类型定义（adapter 自行定义内部格式）
- `parseMetadata()` 兼容逻辑
- `defaultContentTypeForSourceType`（在 normalize.ts 中）
- 从 `metadataJson` 读取 `provider`/`sourceKind`/`contentType`/`sourceName`

### 新逻辑

所有字段从 RawItem 顶层直接读取，metadataJson 仅用于 adapter 特有字段：

```typescript
// normalize.ts
const sourceType = item.sourceType;
const contentType = item.contentType;
const summary = item.summary ?? "";
const engagementScore = item.engagement ? calculateEngagementScore(item.engagement, sourceType) : 0;
const sourceName = item.sourceName;  // 由 collect.ts 从 source.name 注入
```

### tagFilter 传递

```typescript
const sourceTags = item.tagFilter ?? [];
```

---

## 改动 11: env.local 新增配置

```bash
# Twitter/X 认证
TWITTER_AUTH_TOKEN=your_token_here
TWITTER_CT0=your_ct0_here
```

---

## 实现顺序

1. 修改 `src/types/index.ts`（RawItem、Tag、Source 类型）
2. 将 `config/topics.yaml` 重命名为 `config/tags.yaml`，调整内部字段名（topics → tags）
3. 修改 `src/cli/run.ts`（loadSourcesConfig 改为返回 Source[]，loadTagsConfig）
4. 修改 `src/pipeline/collect.ts`（移除 metadata 重组逻辑，filterContext 改用 tags）
5. 重命名 `src/pipeline/filter-by-topic.ts` → `filter-by-tag.ts`，实现过滤语义
6. 修改 `src/pipeline/normalize.ts`（移除 RawItemMetadata 依赖，Tag[] 传递）
7. 修改 `build-adapters.ts`（注册 githubTrending，移除 techurls/newsnow/website）
8. 删除废弃 adapter 文件
9. 逐个改造 adapter（移除 metadataJson 中的 provider/sourceKind/contentType，publishedAt 非空处理，auth 从 authConfigJson 读取）
10. 修改 `sources.yaml`（补 contentType，修正 type，恢复 twitter，重命名 topics → tagIds）
11. 运行 `bun run typecheck` 验证
12. 运行 `bun test` 验证
13. 更新 `.env.local`（添加 twitter 认证变量）
14. 更新项目文档（README.md、AGENTS.md 等），反映所有变更
