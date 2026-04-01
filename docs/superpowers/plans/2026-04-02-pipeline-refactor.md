# Pipeline 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现真正的 pipeline 整合，支持并发收集，简化评分体系，移除 JSON 落盘

**架构:** CLI（--timeWindow 必填）→ 并发收集（adapter × source 两级）→ normalize → topic 过滤 → 评分排序 → 全局去重 → 象限划分 → MD 生成 → 无 JSON 持久化

**技术栈:** Bun (TypeScript), YAML 配置, Anthropic AI

---

## 文件结构

### 修改文件清单

| 文件 | 职责 |
|------|------|
| `src/types/index.ts` | `AdapterFn` 类型变更为接收 `{ timeWindow: number }` 选项；`Source` 添加 `topicIds`；`normalizedArticle` 类型替代 `NormalizedItem` |
| `src/pipeline/collect.ts` | 两级并发模型（adapterConcurrency + sourceConcurrency） |
| `src/adapters/rss.ts` | 移除硬编码 24h，改为使用传入的 `timeWindow` 参数 |
| `src/adapters/json-feed.ts` | 同上 |
| `src/adapters/website.ts` | 同上 |
| `src/adapters/x-bird.ts` | 同上 |
| `src/adapters/techurls.ts` | 同上 |
| `src/adapters/zeli.ts` | 同上 |
| `src/adapters/newsnow.ts` | 同上 |
| `src/adapters/clawfeed.ts` | 同上 |
| `src/adapters/attentionvc.ts` | 同上 |
| `src/adapters/build-adapters.ts` | 适配新签名 |
| `src/pipeline/normalize.ts` | `RawItem → normalizedArticle`，engagementScore 计算，topicIds/sourceWeightScore 透传 |
| `src/pipeline/filter-by-topic.ts` | 保持接口不变，过滤逻辑已实现 |
| `src/pipeline/rank.ts` | 简化为 `finalScore = sourceWeightScore×0.4 + engagementScore×0.15` |
| `src/pipeline/dedupe-exact.ts` | 保持不变 |
| `src/pipeline/dedupe-near.ts` | 保持不变 |
| `src/cli/run.ts` | 新 CLI 参数解析（--timeWindow/--adapter-concurrency/--source-concurrency），完整 pipeline 组装，移除 JsonArticleStore |
| `src/reports/daily.ts` | 新增 `loadQuadrantPrompts()` 从 reports.yaml 读取象限 prompt，移除 weekly 逻辑和 quadrantBonus |
| `src/ai/prompts-reports.ts` | `QUADRANT_PROMPT` 保留，移除 weekly 相关 prompt |
| `src/archive/index.ts` | 移除 `JsonArticleStore` 导出 |
| `src/archive/json-store.ts` | 删除 |
| `config/reports.yaml` | 新增 `quadrantPrompts.map/try/deep`，移除 `weekly` 和 `quadrantBonus` |
| `config/sources.yaml` | 新增 `priority` 字段 |

### 新增类型

```typescript
// normalizedArticle - 替代 NormalizedItem 的统一命名
interface normalizedArticle {
  id: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
  sourceKind: SourceKind;
  contentType: "article";
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
  // Pipeline 运行时字段
  topicIds: string[];           // 从 Source 继承
  sourceWeightScore: number;     // 来自 Source.priority（已归一化）
  engagementScore: number;       // normalize 阶段计算
  // filterContext 移除（topicIds 已透传）
}
```

---

## 任务分解

### Task 1: 类型定义变更

**文件:**
- 修改: `src/types/index.ts`

- [ ] **Step 1: 更新 AdapterFn 类型**

```typescript
// 旧签名
export type AdapterFn = (source: Source) => Promise<RawItem[]>;

// 新签名
export type AdapterFn = (source: Source, options: { timeWindow: number }) => Promise<RawItem[]>;
```

- [ ] **Step 2: 在 Source 类型上确认 topicIds 字段**

`Source` 已通过 `InlineSource & { id: string }` 组合，`InlineSource` 已有 `defaultTopicIds?: string[]`。重命名为 `topicIds` 以符合 pipeline 语义：

```typescript
// Source 类型已有 topicIds (as defaultTopicIds)，在 loadSourcesConfig 时映射
export type Source = InlineSource & { id: string; topicIds: string[]; sourceWeightScore: number };
```

- [ ] **Step 3: 添加 normalizedArticle 类型（替代 NormalizedItem）**

```typescript
// normalizedArticle - pipeline 中统一使用的文章类型
export interface normalizedArticle {
  id: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
  sourceKind: SourceKind;
  contentType: "article";
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
  // Pipeline 运行时字段
  topicIds: string[];
  sourceWeightScore: number;
  engagementScore: number;
}
```

- [ ] **Step 4: 确认 build-adapters.ts 的适配**

```bash
# 验证类型变更后 build-adapters.ts 是否需要调整
```

- [ ] **Step 5: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: update AdapterFn signature and add normalizedArticle type"
```

---

### Task 2: Adapter 统一改造

**文件:**
- 修改: `src/adapters/rss.ts`, `json-feed.ts`, `website.ts`, `x-bird.ts`, `techurls.ts`, `zeli.ts`, `newsnow.ts`, `clawfeed.ts`, `attentionvc.ts`
- 修改: `src/adapters/build-adapters.ts`

**改造说明:**
所有 adapter 函数签名统一变更为：
```typescript
async function collectXxxSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch }
): Promise<RawItem[]>
```

不再使用 `jobStartedAt` + 硬编码 24h，改为使用传入的 `timeWindow` 参数（毫秒）进行时间窗口过滤。

- [ ] **Step 1: 改造 rss.ts - 移除硬编码 24h**

修改 `parseRssItems` 和 `collectRssSource`：
- 接收 `timeWindow: number`（毫秒）代替硬编码的 24h
- 计算 cutoffTime: `jobStart.getTime() - timeWindow`
- 更新函数签名

```typescript
// src/adapters/rss.ts

export interface ParseRssItemsOptions {
  jobStartedAt: string;
  timeWindow: number;  // 毫秒
  filterContext?: FilterContext;
}

export function parseRssItems(
  xml: string,
  sourceId: string,
  options: ParseRssItemsOptions,
): RawItem[] {
  const { jobStartedAt, timeWindow } = options;
  const jobStart = new Date(jobStartedAt);
  const cutoffTime = new Date(jobStart.getTime() - timeWindow);  // 使用 timeWindow 而非硬编码 24h
  // ... 其余逻辑保持不变
}

export async function collectRssSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const { timeWindow, fetchImpl = fetch } = options;
  // ... 使用 timeWindow 传递
}
```

- [ ] **Step 2: 改造 json-feed.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 3: 改造 website.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 4: 改造 x-bird.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 5: 改造 techurls.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 6: 改造 zeli.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 7: 改造 newsnow.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 8: 改造 clawfeed.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 9: 改造 attentionvc.ts**

同上，接收 `timeWindow` 参数。

- [ ] **Step 10: 改造 build-adapters.ts**

```typescript
// src/adapters/build-adapters.ts
import type { AdapterFn } from "../types/index";

export function buildAdapters(): Record<string, AdapterFn> {
  return {
    "json-feed": (source, options) => collectJsonFeedSource(source, options),
    rss: (source, options) => collectRssSource(source, options),
    website: (source, options) => collectWebsiteSource(source, options),
    x: (source, options) => collectXBirdSource(source, options),
    techurls: (source, options) => collectTechurlsSource(source, options),
    zeli: (source, options) => collectZeliSource(source, options),
    newsnow: (source, options) => collectNewsnowSource(source, options),
    clawfeed: (source, options) => collectClawfeedSource(source, options),
    attentionvc: (source, options) => collectAttentionvcSource(source, options),
  };
}
```

- [ ] **Step 11: 运行类型检查**

```bash
bun run typecheck
```

预期: 无类型错误

- [ ] **Step 12: 提交**

```bash
git add src/adapters/
git commit -m "feat: unify adapter signature with timeWindow parameter"
```

---

### Task 3: collect.ts 两级并发模型

**文件:**
- 修改: `src/pipeline/collect.ts`

**设计:**
- Adapter 维度并发：按 source type 分组，组间并行度由 `adapterConcurrency` 控制
- Source 维度并发：同 type 下多个 source 使用 `processWithConcurrency` 并发抓取

- [ ] **Step 1: 实现两级并发 collectWithTwoLevelConcurrency 函数**

```typescript
// src/pipeline/collect.ts

export interface CollectDependencies {
  adapters: Record<string, AdapterFn>;
  onSourceEvent?: (event: CollectSourceEvent) => void;
  /** adapter 维度并发数（不同 type 间） */
  adapterConcurrency: number;
  /** source 维度并发数（同 type 内） */
  sourceConcurrency: number;
}

/**
 * 两级并发收集:
 * 1. 按 source kind 分组
 * 2. Adapter 维度：最多同时运行 adapterConcurrency 个不同 type 的 adapter
 * 3. Source 维度：同 type 内最多同时抓取 sourceConcurrency 个 source
 */
export async function collectWithTwoLevelConcurrency(
  sources: Source[],
  dependencies: CollectDependencies,
): Promise<RawItem[]> {
  const { adapters, adapterConcurrency, sourceConcurrency, onSourceEvent } = dependencies;

  // 按 kind 分组
  const byKind = new Map<string, Source[]>();
  for (const source of sources) {
    const list = byKind.get(source.kind) ?? [];
    list.push(source);
    byKind.set(source.kind, list);
  }

  const kinds = Array.from(byKind.keys());

  // Adapter 维度并发：最多同时运行 adapterConcurrency 个不同 type
  const allResults: RawItem[][] = await processWithConcurrency(
    kinds,
    { batchSize: adapterConcurrency, concurrency: adapterConcurrency },
    async (kind) => {
      const kindSources = byKind.get(kind)!;
      const adapter = adapters[kind];
      if (!adapter) {
        for (const s of kindSources) {
          onSourceEvent?.({ sourceId: s.id, status: "failure", itemCount: 0, error: `Missing adapter: ${kind}` });
        }
        return [];
      }

      // Source 维度并发：同 type 内最多同时抓取 sourceConcurrency 个 source
      const results = await processWithConcurrency(
        kindSources,
        { batchSize: sourceConcurrency, concurrency: sourceConcurrency },
        async (source) => {
          const startedAt = Date.now();
          try {
            // timeWindow 由调用方传入，这里使用默认值或从某个上下文获取
            const collected = await adapter(source, { timeWindow: /* 从外部传入 */ });
            const latencyMs = Date.now() - startedAt;
            onSourceEvent?.({
              sourceId: source.id,
              status: collected.length === 0 ? "zero-items" : "success",
              itemCount: collected.length,
              latencyMs,
            });
            return collected.map((item) => normalizeCollectedItem(source, item));
          } catch (error) {
            const latencyMs = Date.now() - startedAt;
            onSourceEvent?.({
              sourceId: source.id,
              status: "failure",
              itemCount: 0,
              latencyMs,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          }
        },
      );
      return results.flat();
    },
  );

  return allResults.flat();
}
```

**注意:** `timeWindow` 需要从调用方传入，将在 Task 6 的 `run.ts` 中处理。

- [ ] **Step 2: 更新 CollectDependencies 类型**

```typescript
export interface CollectDependencies {
  adapters: Record<string, AdapterFn>;
  onSourceEvent?: (event: CollectSourceEvent) => void;
  /** adapter 维度并发数（不同 type 间），默认 4 */
  adapterConcurrency: number;
  /** source 维度并发数（同 type 内），默认 4 */
  sourceConcurrency: number;
  /** 时间窗口（毫秒） */
  timeWindow: number;
}
```

- [ ] **Step 3: 添加 normalizeCollectedItem 透传 topicIds**

```typescript
function normalizeCollectedItem(source: Source, item: RawItem): RawItem {
  const metadata = parseRawItemMetadata(item.metadataJson);
  const normalizedMetadata: RawItemMetadata = {
    // ... 现有逻辑
  };
  return {
    ...item,
    metadataJson: JSON.stringify(normalizedMetadata),
    // 透传 topicIds 到 filterContext（兼容现有逻辑）
    filterContext: item.filterContext ?? { topicIds: source.topicIds ?? [] },
  };
}
```

- [ ] **Step 4: 运行类型检查**

```bash
bun run typecheck
```

- [ ] **Step 5: 提交**

```bash
git add src/pipeline/collect.ts
git commit -m "feat: implement two-level concurrency model in collect"
```

---

### Task 4: normalize.ts 改造

**文件:**
- 修改: `src/pipeline/normalize.ts`

**改造说明:**
- 输出类型改为 `normalizedArticle`
- engagementScore 计算逻辑保留
- 添加 `topicIds`、`sourceWeightScore` 透传

- [ ] **Step 1: 修改 normalizeItem 输出类型**

```typescript
// src/pipeline/normalize.ts

export interface NormalizedArticle {
  id: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
  sourceKind: SourceKind;
  contentType: "article";
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
  // Runtime fields
  topicIds: string[];
  sourceWeightScore: number;
  engagementScore: number;
}

/**
 * @deprecated Use normalizeItem instead
 */
export function normalizeItems(items: RawItem[]): NormalizedItem[] {
  return items.map(normalizeItem).filter((item): item is NormalizedItem => item !== null);
}

/**
 * Normalize a RawItem into a normalizedArticle.
 */
export function normalizeItem(item: RawItem): NormalizedArticle | null {
  // ... 现有 normalize 逻辑

  // 从 filterContext 提取 topicIds
  const topicIds = item.filterContext?.topicIds ?? [];

  // 计算 engagementScore（已有逻辑）
  const engagementScore = calculateEngagementScore(metadata, sourceKind) ?? 0;

  // sourceWeightScore 在 run.ts 中赋值，这里从 metadata 或其他途径获取
  const sourceWeightScore = 0; // 将在 run.ts 中通过 pipeline 组装时填充

  return {
    id: item.id,
    sourceId: item.sourceId,
    title: item.title,
    publishedAt: item.publishedAt,
    sourceKind,
    contentType: "article",
    normalizedUrl,
    normalizedTitle,
    normalizedSummary,
    normalizedContent,
    metadataJson: item.metadataJson,
    topicIds,
    sourceWeightScore,
    engagementScore,
  };
}
```

**注意:** `sourceWeightScore` 的实际赋值将在 Task 6 的 pipeline 组装中进行（从 `Source.priority` 映射）。

- [ ] **Step 2: 运行类型检查**

```bash
bun run typecheck
```

- [ ] **Step 3: 提交**

```bash
git add src/pipeline/normalize.ts
git commit -m "feat: update normalize to output normalizedArticle with topicIds and sourceWeightScore"
```

---

### Task 5: rank.ts 简化

**文件:**
- 修改: `src/pipeline/rank.ts`

**改造说明:**
简化评分公式为：`finalScore = sourceWeightScore × 0.4 + engagementScore × 0.15`
移除 `freshnessScore`、`contentQualityAi`、`relationshipPenalty` 相关逻辑。

- [ ] **Step 1: 简化 rankCandidates 函数**

```typescript
// src/pipeline/rank.ts

export interface RankableCandidate {
  id: string;
  sourceWeightScore: number;
  engagementScore: number;
  // 移除: freshnessScore, contentQualityAi, relationshipToCanonical, contentType
}

export function rankCandidates<T extends RankableCandidate>(candidates: T[]): Array<T & { finalScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      // 简化评分公式：sourceWeightScore × 0.4 + engagementScore × 0.15
      finalScore:
        candidate.sourceWeightScore * 0.4 +
        Math.min(100, candidate.engagementScore) * 0.15,
    }))
    .sort((left, right) => right.finalScore - left.finalScore);
}
```

- [ ] **Step 2: 运行测试验证**

```bash
bun run src/pipeline/rank.test.ts
```

或运行所有测试：

```bash
bun test
```

- [ ] **Step 3: 提交**

```bash
git add src/pipeline/rank.ts
git commit -m "feat: simplify ranking formula to sourceWeight×0.4 + engagement×0.15"
```

---

### Task 6: run.ts 完整 pipeline 组装

**文件:**
- 修改: `src/cli/run.ts`

**改造说明:**
- 新增 CLI 参数：`--timeWindow`（必填），`--adapter-concurrency`，`--source-concurrency`
- 移除 JsonArticleStore 相关代码
- 组装完整 pipeline：collect → normalize → topic filter → rank → dedupe → quadrant → MD

- [ ] **Step 1: 添加 CLI 参数解析**

```typescript
// src/cli/run.ts

interface CLIArgs {
  timeWindow: string;           // 必填，格式 24h/7d/30d
  adapterConcurrency?: number;  // 默认 4
  sourceConcurrency?: number;   // 默认 4
}

function parseTimeWindow(value: string): number {
  const match = value.match(/^(\d+)(h|d)$/);
  if (!match) throw new Error(`Invalid timeWindow: ${value}`);
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const ms = unit === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return num * ms;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = { timeWindow: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--timeWindow" && i + 1 < args.length) {
      result.timeWindow = args[++i];
    } else if (args[i] === "--adapter-concurrency" && i + 1 < args.length) {
      result.adapterConcurrency = parseInt(args[++i], 10);
    } else if (args[i] === "--source-concurrency" && i + 1 < args.length) {
      result.sourceConcurrency = parseInt(args[++i], 10);
    }
  }
  if (!result.timeWindow) {
    throw new Error("--timeWindow is required (e.g., --timeWindow 24h)");
  }
  return result;
}
```

- [ ] **Step 2: 更新 loadSourcesConfig 读取 priority 和 topics**

```typescript
interface YamlSource {
  type: string;
  id: string;
  name?: string;
  url?: string;
  enabled?: boolean;
  topics?: string[];    // 新增
  priority?: number;   // 新增
  // ...
}

function loadSourcesConfig(): Source[] {
  const configPath = path.join(process.cwd(), "config", "sources.yaml");
  const content = fs.readFileSync(configPath, "utf-8");
  const raw = yaml.load(content) as { sources: YamlSource[] };

  return raw.sources
    .filter((s) => s.enabled !== false)
    .map((s) => ({
      kind: s.type as Source["kind"],
      id: s.id,
      url: s.url ?? "",
      description: s.name,
      enabled: true,
      topicIds: s.topics ?? [],         // 新增
      sourceWeightScore: s.priority ?? 0.5, // 新增（默认 0.5）
    }));
}
```

- [ ] **Step 3: 重写 main() 组装完整 pipeline**

```typescript
async function main() {
  const args = parseArgs();
  const timeWindow = parseTimeWindow(args.timeWindow);
  const adapterConcurrency = args.adapterConcurrency ?? 4;
  const sourceConcurrency = args.sourceConcurrency ?? 4;
  const startTime = Date.now();

  log({ level: "info", ts: new Date().toISOString(), stage: "collect", msg: "开始收集", data: { timeWindow: args.timeWindow } });

  // 1. 加载配置
  const sources = loadSourcesConfig();
  const adapters = buildAdapters();

  // 2. 并发收集
  const rawItems = await collectWithTwoLevelConcurrency(sources, {
    adapters,
    adapterConcurrency,
    sourceConcurrency,
    timeWindow,
    onSourceEvent: (event) => {
      log({ level: "info", ts: new Date().toISOString(), stage: "collect", msg: `Source ${event.sourceId}: ${event.status}`, data: event });
    },
  });

  if (rawItems.length === 0) {
    log({ level: "warn", ts: new Date().toISOString(), stage: "collect", msg: "无任何数据，退出" });
    return;
  }

  log({ level: "info", ts: new Date().toISOString(), stage: "collect", msg: `收集完成`, data: { total: rawItems.length } });

  // 3. normalize
  log({ level: "info", ts: new Date().toISOString(), stage: "normalize", msg: "开始 normalize" });
  const normalized = rawItems
    .map((item) => {
      // 填充 sourceWeightScore（从 source 配置获取）
      const source = sources.find((s) => s.id === item.sourceId);
      const sourceWeightScore = source?.sourceWeightScore ?? 0.5;
      const normalized = normalizeItem(item);
      if (normalized) {
        normalized.sourceWeightScore = sourceWeightScore;
      }
      return normalized;
    })
    .filter((item): item is NormalizedArticle => item !== null);

  log({ level: "info", ts: new Date().toISOString(), stage: "normalize", msg: `normalize 完成`, data: { total: normalized.length } });

  // 4. topic 过滤
  log({ level: "info", ts: new Date().toISOString(), stage: "filter", msg: "开始 topic 过滤" });
  const topicsConfig = loadTopicsConfig(); // 加载 topics.yaml
  const filtered = filterByTopics(normalized, topicsConfig); // 复用现有函数

  if (filtered.length === 0) {
    log({ level: "warn", ts: new Date().toISOString(), stage: "filter", msg: "topic 过滤后无数据，退出" });
    return;
  }

  log({ level: "info", ts: new Date().toISOString(), stage: "filter", msg: `topic 过滤完成`, data: { total: filtered.length } });

  // 5. 评分排序
  log({ level: "info", ts: new Date().toISOString(), stage: "rank", msg: "开始评分排序" });
  const ranked = rankCandidates(filtered);

  // 6. 全局去重（URL 精确 + 语义 LCS）
  log({ level: "info", ts: new Date().toISOString(), stage: "dedupe", msg: "开始去重" });
  const dedupedExact = dedupeExact(ranked);
  const deduped = dedupeNear(dedupedExact);

  if (deduped.length === 0) {
    log({ level: "warn", ts: new Date().toISOString(), stage: "dedupe", msg: "去重后无数据，退出" });
    return;
  }

  log({ level: "info", ts: new Date().toISOString(), stage: "dedupe", msg: `去重完成`, data: { total: deduped.length } });

  // 7. 生成日报（象限分类 + MD 生成）
  log({ level: "info", ts: new Date().toISOString(), stage: "output", msg: "开始生成日报" });

  try {
    const aiClient = createAiClient();
    if (aiClient) {
      const result = await generateDailyReport(new Date(), aiClient, deduped);
      log({ level: "info", ts: new Date().toISOString(), stage: "output", msg: "日报生成完成", data: { topics: result.topicCount } });
    } else {
      log({ level: "warn", ts: new Date().toISOString(), stage: "output", msg: "AI client not available, skipping report generation" });
    }
  } catch (err) {
    log({ level: "error", ts: new Date().toISOString(), stage: "output", msg: `日报生成失败: ${err}` });
  }

  log({ level: "info", ts: new Date().toISOString(), stage: "output", msg: "完成", data: { durationMs: Date.now() - startTime } });
}
```

**注意:** `generateDailyReport` 签名变更，将在 Task 7 中处理。

- [ ] **Step 4: 添加 loadTopicsConfig 函数**

```typescript
function loadTopicsConfig(): Topic[] {
  const configPath = path.join(process.cwd(), "config", "topics.yaml");
  const content = fs.readFileSync(configPath, "utf-8");
  const raw = yaml.load(content) as { topics: Topic[] };
  return raw.topics.filter((t) => t.enabled !== false);
}
```

- [ ] **Step 5: 移除 JsonArticleStore 相关代码**

移除：
- `import { JsonArticleStore } from '../archive/json-store.js'`
- `const store = new JsonArticleStore('data')`
- `await store.save(date, items)`

- [ ] **Step 6: 运行类型检查**

```bash
bun run typecheck
```

- [ ] **Step 7: 提交**

```bash
git add src/cli/run.ts
git commit -m "feat: wire up complete pipeline in run.ts with new CLI args"
```

---

### Task 7: daily.ts 改造

**文件:**
- 修改: `src/reports/daily.ts`

**改造说明:**
- 新增 `loadQuadrantPrompts()` 从 `reports.yaml` 读取象限 prompt
- 修改 `generateDailyReport` 接收 `normalizedArticle[]` 而非从 JsonArticleStore 读取
- 移除 `quadrantBonus` 加成逻辑
- 移除 weekly 相关代码

- [ ] **Step 1: 添加 QuadrantPromptConfig 类型和 loadQuadrantPrompts 函数**

```typescript
// src/reports/daily.ts

interface QuadrantPromptConfig {
  map: string;
  try: string;
  deep: string;
}

function loadQuadrantPrompts(): QuadrantPromptConfig {
  const configPath = path.join(process.cwd(), "config", "reports.yaml");
  const content = fs.readFileSync(configPath, "utf-8");
  const raw = yaml.load(content) as { daily: { quadrantPrompts: QuadrantPromptConfig } };
  return raw.daily.quadrantPrompts;
}
```

- [ ] **Step 2: 修改 generateDailyReport 签名**

```typescript
// 旧签名
export async function generateDailyReport(now: Date, aiClient: AiClient): Promise<DailyGenerateResult>

// 新签名
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: NormalizedArticle[],  // 直接接收 normalizedArticle 数组，不再从 JsonArticleStore 读取
): Promise<DailyGenerateResult>
```

- [ ] **Step 3: 移除 quadrantBonus 加成逻辑**

```typescript
// 移除 QUADRANT_BONUS 常量
// 移除 computeBaseScore 中的 quadrantBonus
// 评分简化为: finalScore = baseScore（无象限加成）
```

- [ ] **Step 4: 更新 QuadrantGroup 生成逻辑**

每个象限使用 `reports.yaml` 中对应的 prompt：
- `quadrantPrompts.map` → 地图感象限内容生成
- `quadrantPrompts.try` → 尝试象限内容生成
- `quadrantPrompts.deep` → 深度象限内容生成

- [ ] **Step 5: 运行类型检查**

```bash
bun run typecheck
```

- [ ] **Step 6: 提交**

```bash
git add src/reports/daily.ts
git commit -m "feat: update daily report to use quadrant prompts from config"
```

---

### Task 8: 配置文件变更

**文件:**
- 修改: `config/reports.yaml`
- 修改: `config/sources.yaml`（添加 priority 字段）

**注意:** `sources.yaml` 的 `priority` 字段已在 Task 6 的 `loadSourcesConfig` 中处理。

- [ ] **Step 1: 修改 reports.yaml**

```yaml
# config/reports.yaml

daily:
  maxItems: 50
  minScore: 0
  # 新增三个象限的 prompt
  quadrantPrompts:
    map: |
      你是一个信息整理助手。用户会提供一个话题下的多篇文章列表，你需要生成该话题的核心要点，用清晰的123...格式列出。
      每条要点应该简洁有力，反映该话题的主要趋势或发现。
    try: |
      你是一个信息整理助手。用户会提供一个话题下的多篇文章列表，你需要生成该话题的总结概括，用清晰的123...格式列出。
      每条需要说明：1)值得尝试的原因 2)预计投入时间。
    deep: |
      你是一个信息整理助手。对于每篇文章，说明"为什么值得深入阅读"，包括：文章解决了什么问题、提供了什么独特视角、适合什么程度的读者。

# 移除 weekly 配置
# 移除 quadrantBonus 配置
```

- [ ] **Step 2: 验证 sources.yaml 无需变更**

`topics` 字段已存在于 `YamlSource` 类型中，无需修改。

- [ ] **Step 3: 提交**

```bash
git add config/reports.yaml
git commit -m "feat: add quadrantPrompts to reports.yaml, remove weekly and quadrantBonus"
```

---

### Task 9: 清理 JsonArticleStore

**文件:**
- 删除: `src/archive/json-store.ts`
- 修改: `src/archive/index.ts`

- [ ] **Step 1: 删除 json-store.ts**

```bash
rm src/archive/json-store.ts
```

- [ ] **Step 2: 修改 archive/index.ts**

```typescript
// src/archive/index.ts

export interface Article {
  // ... 现有字段
}

// 移除 JsonArticleStore 导出
// export { JsonArticleStore } from "./json-store";
```

- [ ] **Step 3: 确保无其他文件引用 JsonArticleStore**

```bash
grep -r "JsonArticleStore" src/
```

如有引用，更新为不使用 JsonArticleStore。

- [ ] **Step 4: 运行类型检查**

```bash
bun run typecheck
```

- [ ] **Step 5: 提交**

```bash
git add src/archive/
git commit -m "feat: remove JsonArticleStore (no JSON persistence)"
```

---

### Task 10: prompts-reports.ts 清理

**文件:**
- 修改: `src/ai/prompts-reports.ts`

**改造说明:**
保留 `QUADRANT_PROMPT`，移除 `TOPIC_SUMMARY_PROMPT`（将被 quadrant prompts 替代），移除 weekly 相关 prompt。

- [ ] **Step 1: 移除 weekly 相关函数**

移除：
- `buildPickReasonPrompt`
- `parsePickReasonResult`
- `buildEditorialPrompt`
- `parseEditorialResult`

- [ ] **Step 2: 确认 QUADRANT_PROMPT 保留**

`QUADRANT_PROMPT` 用于象限分类（`classifyArticleQuadrant`），保留不变。

- [ ] **Step 3: 运行类型检查**

```bash
bun run typecheck
```

- [ ] **Step 4: 提交**

```bash
git add src/ai/prompts-reports.ts
git commit -m "feat: remove weekly prompts from prompts-reports"
```

---

## 端到端测试

### 测试命令

```bash
bun run src/cli/run.ts --timeWindow 1h --adapter-concurrency 4 --source-concurrency 6
```

### 验证点

1. **并发收集验证**：不同 adapter 和 source 并发执行
2. **timeWindow 过滤**：不同时间窗口参数下，过滤结果正确
3. **topicIds 传递**：normalizedArticle 包含 topicIds 字段
4. **priority 加载**：`sources.yaml` 中 `priority` 字段正确读取
5. **评分公式**：priority 和 engagementScore 加权正确
6. **去重正确性**：exact dedupe 和 near dedupe 的 winner 选择正确
7. **象限分类**：三象限分类结果符合各象限定义
8. **MD 输出**：三个象限的呈现格式符合设计
9. **JSON 不落盘**：运行全程无磁盘 IO（除最终 MD 输出）

---

### Task 11: 检查并更新文档

**文件:**
- 检查: `README.md`, `CLAUDE.md`

**规范:** 更新 `CLAUDE.md` 时，遵循 `claude-md-management:revise-claude-md` skill 规范：
- Step 1: Reflect - 反思本次 session 中缺失的上下文
- Step 2: Find CLAUDE.md Files - 确认文档位置
- Step 3: Draft Additions - 保持简洁，每行一个概念
- Step 4: Show Proposed Changes - 使用 diff 格式展示变更
- Step 5: Apply with Approval - 获得用户批准后再修改

**改造说明:**
任务完成后，检查项目文档是否需要更新。Pipeline 重构涉及：
- CLI 参数变更（新增 `--timeWindow`、`--adapter-concurrency`、`--source-concurrency`）
- 移除 JSON 持久化
- 简化评分体系
- 配置字段变更（`sources.yaml` 新增 `priority`，`reports.yaml` 新增 `quadrantPrompts`）

- [ ] **Step 1: 检查 README.md 是否需要更新**

检查项：
- CLI 命令参数是否与新实现一致
- Pipeline 流程图是否需要更新
- 配置说明是否需要添加新字段说明

```bash
# 查看当前 README
cat README.md
```

如需更新，添加/修改以下内容：
- `--timeWindow <duration>`: 时间窗口（必填），格式 `24h`/`7d`/`30d`
- `--adapter-concurrency <n>`: adapter 并发数，默认 4
- `--source-concurrency <n>`: source 并发数，默认 4

- [ ] **Step 2: 检查 CLAUDE.md 是否需要更新（遵循 revise-claude-md skill）**

按照 skill 规范执行：

**Reflect（本 session 学到的内容）：**
- Pipeline 重构涉及 CLI 参数、并发模型、评分公式、配置字段等变更
- 这些上下文对未来 Claude session 会有帮助

**Draft Additions（草拟更新内容）：**

```
### Pipeline Flow 更新
- collect → 并发收集（adapter × source 两级）
- normalize → 格式转换 + engagementScore
- topic 过滤 → include/exclude 初筛
- rank → sourceWeightScore×0.4 + engagementScore×0.15
- dedupe → URL 精确 + 语义 LCS
- quadrant → 三象限分类（各象限独立 prompt）
```

**Show Proposed Changes:**
按照 skill 格式展示 diff，获得用户批准后再 apply。

当前 `CLAUDE.md` 中的 Pipeline Flow：
```
1. 收集 (collect)     → 从数据源获取内容
2. 充实 (enrich)      → 正文提取
3. 去重 (dedupe)      → 精确去重
4. 评分 (score)       → 基于质量/热度评分
5. 象限分类 (quadrant) → AI 分类到尝试/深度/地图感
6. 话题生成 (topic)   → AI 聚类 + 生成摘要/要点
7. 输出 (output)      → 生成 Markdown
```

更新为：
```
1. 收集 (collect)     → 并发收集（adapter × source 两级）
2. 标准化 (normalize) → 格式转换 + engagementScore 计算
3. topic 过滤         → include/exclude 初筛
4. 评分 (rank)        → sourceWeightScore×0.4 + engagementScore×0.15
5. 去重 (dedupe)      → URL 精确 + 语义 LCS
6. 象限分类 (quadrant) → AI 分类到尝试/深度/地图感
7. 话题生成 (topic)   → AI 聚类 + 生成摘要/要点（各象限独立 prompt）
8. 输出 (output)      → 生成 Markdown
```

- [ ] **Step 3: 检查 config/reports.yaml 注释是否需要更新**

`CLAUDE.md` 中关于 `reports.yaml` 的说明：
```yaml
daily:
  maxItems: 50      # 输入 AI 的候选数量上限
  minScore: 0        # 最终分数门槛
  quadrantBonus:     # 象限评分加成
    near: 1.3
    mid: 1.0
    far: 0.8
```

需更新为：
```yaml
daily:
  maxItems: 50
  minScore: 0
  quadrantPrompts:    # 三个象限各自的 prompt
    map: ...
    try: ...
    deep: ...
```

- [ ] **Step 4: 提交文档更新（需先通过 Step 2 的 Approval）**

只有当 Step 2 获得用户批准后，才执行以下提交：

```bash
git add README.md CLAUDE.md
git commit -m "docs: update documentation for pipeline refactor"
```

---

## 实施顺序建议

1. Task 1: 类型定义变更
2. Task 2: Adapter 统一改造
3. Task 3: collect.ts 两级并发模型
4. Task 4: normalize.ts 改造
5. Task 5: rank.ts 简化
6. Task 6: run.ts 完整 pipeline 组装
7. Task 7: daily.ts 改造
8. Task 8: 配置文件变更
9. Task 9: 清理 JsonArticleStore
10. Task 10: prompts-reports.ts 清理
