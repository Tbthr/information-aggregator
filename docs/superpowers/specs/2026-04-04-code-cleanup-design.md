# 代码清理与优化设计

## 背景

对项目代码进行复用性、质量和效率审查后，识别出 5 个需要修复的问题。本文档描述这 5 个问题的修复方案。

---

## 1. 配置集中加载

### 问题
`run.ts` 中 `tags.yaml` 被 `loadSourcesConfig()` 和 `loadTagsConfig()` 重复读取。配置加载逻辑分散在多个模块中。

### 方案
新建 `src/config/index.ts`，集中管理所有配置加载：

```typescript
// src/config/index.ts
export interface AppConfig {
  sources: Source[];
  tags: Tag[];
  enrichOptions: EnrichOptions;
}

export function loadConfig(): AppConfig {
  const sources = loadSourcesConfig();  // 内部读取 sources.yaml + tags.yaml
  const tags = loadTagsConfig();       // 不再重复读取 tags.yaml
  const enrichOptions = loadEnrichConfig(); // 读取 reports.yaml

  return { sources, tags, enrichOptions };
}
```

- `loadSourcesConfig()` 内部解析 `sources.yaml` 和 `tags.yaml`，返回已解析的 source 对象（包含 resolved tags）
- `loadTagsConfig()` 直接使用已解析的 tags 数据（不重新读取文件）
- 所有配置只加载一次，按需传递给各模块

### 影响范围
- `run.ts`：改为调用 `loadConfig()`
- `generateDailyReport()`：接收传入的 config，不再自行加载

---

## 2. 统一 parseDate

### 问题
- `rss.ts` 的 `parseDate` 支持 RFC 2822 格式
- `json-feed.ts` 的 `parseDate` 只支持 ISO 8601
- 两者接口结构相同但实现分离

### 方案
合并到 `lib/date-utils.ts`，同时支持 RFC 2822 和 ISO 8601：

```typescript
// lib/date-utils.ts
export function parseDate(dateStr: string): ParseDateResult {
  // 同时支持 RFC 2822 和 ISO 8601
}
```

- RSS 和 JSON Feed adapter 都导入使用 `lib/date-utils.ts` 的 `parseDate`
- 保持接口兼容：`ParseDateSuccess` / `ParseDateFailure` / `ParseDateResult`

### 影响范围
- `src/adapters/rss.ts`：删除本地 `parseDate`，导入 `lib/date-utils`
- `src/adapters/json-feed.ts`：删除本地 `parseDate`，导入 `lib/date-utils`

---

## 3. Adapter 采用共享函数

### 问题
`rss.ts`、`json-feed.ts`、`x-bird.ts` 等处重复实现 `computeTimeCutoff` 和 `computeDiscardRate`，而 `lib/utils.ts` 中已有这两个函数但未被使用。

### 方案
让所有 adapter 采用 `lib/utils.ts` 中已有的共享函数：

```typescript
// lib/utils.ts (已存在)
export function computeTimeCutoff(jobStartedAt: string, timeWindow: number): number {
  return new Date(jobStartedAt).getTime() - timeWindow;
}

export function computeDiscardRate(itemCount: number, discardCount: number): string {
  if (itemCount + discardCount === 0) return "0%";
  return `${((discardCount / (itemCount + discardCount)) * 100).toFixed(1)}%`;
}
```

### 影响范围
- `src/adapters/rss.ts`
- `src/adapters/json-feed.ts`
- `src/adapters/x-bird.ts`
- 其他 adapter（如有）

---

## 4. Batch 内并发优化

### 问题
`enrichArticles` 中每个 batch 内的 articles 顺序执行，没有利用并发：

```typescript
batch.forEach((article) => enrichArticleItem(article, options));  // 顺序
```

### 方案
改用 `Promise.all` 并发执行：

```typescript
export async function enrichArticles(
  articles: normalizedArticle[],
  options: EnrichOptions
): Promise<normalizedArticle[]> {
  for (let i = 0; i < articles.length; i += options.batchSize) {
    const batch = articles.slice(i, i + options.batchSize);
    await Promise.all(batch.map(article => enrichArticleItem(article, options)));
  }
  return articles;
}
```

注意：`enrichArticleItem` 本身是同步函数，需要包装为 Promise 或用 `Promise.resolve()` 包装。

### 影响范围
- `src/pipeline/enrich.ts`：`enrichArticles` 改为 async 函数

---

## 5. Near-dedup Token 分桶优化

### 问题
当前 `findClusters` 使用 O(n²) 全量比较，且用 `isWithinDay`（时间窗口）做预过滤不合理——语义重复应该只看内容相似度，与时间无关。

### 新设计

#### 5.1 去除时间过滤
删除 `isWithinDay` 函数，near-dedup 完全基于语义相似度判断。

#### 5.2 Token 分桶预过滤
用 **Token 共享** 做预过滤，避免 O(n²) 全量比较：

1. **提取 significant tokens**：≥3 字符，非 stopwords
2. **分桶**：共享 ≥2 tokens 的文章进入同一候选桶
3. **候选对比较**：只在桶内用 SequenceMatcher 比对（阈值 0.75）
4. **判定 duplicate**：相似度 ≥ 0.75 → 标记为 duplicate，丢弃（保留已排序的高分者）

#### 5.3 关键函数

```typescript
// lib/text-utils.ts (新增)
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', ...]);

export function extractSignificantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));
}

// src/pipeline/dedupe-near.ts
function buildTokenBuckets(items: NearDedupItem[]): Map<string, number[]> {
  // token -> indices of items containing this token
}

function findClusters<T extends NearDedupItem>(items: T[], threshold = 0.75): Map<number, T[]> {
  const buckets = buildTokenBuckets(items);
  // 对每个桶内的 items 做两两比较
}
```

#### 5.4 复杂度对比

| | 当前 | 新设计 |
|---|---|---|
| 最坏复杂度 | O(n²) | O(n × avg_bucket_size²) |
| 预过滤 | isWithinDay（时间） | token 共享（语义） |
| 实际比较数 | 全量 pair | 只有共享 token 的候选对 |

### 影响范围
- `src/pipeline/dedupe-near.ts`：重写 `findClusters`
- 新增 `lib/text-utils.ts`（或放到 `lib/utils.ts`）

---

## 实施顺序

1. **配置集中加载**（基础，其他可能依赖）
2. **统一 parseDate**（独立）
3. **Adapter 采用共享函数**（独立）
4. **Batch 内并发优化**（依赖 enrichArticles 改为 async）
5. **Near-dedup Token 分桶**（独立改动较大）

---

## 测试验证

每个改动后运行 `bun test` 确保测试通过。特别关注：
- `dedupe-exact.test.ts`
- `dedupe-near.test.ts`
- `enrich.test.ts`
