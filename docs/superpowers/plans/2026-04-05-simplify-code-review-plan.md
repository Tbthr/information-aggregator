# 代码简化与优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对代码库进行 DRY 修复、质量优化、效率优化和错误处理增强，分 5 个 PR 提交。

**Architecture:** 基于已批准的设计文档 `2026-04-05-simplify-code-review-design.md`，按优先级顺序实施。

**Tech Stack:** Bun/TypeScript, 现有项目结构不变。

---

## 文件结构概览

### PR-1 新建文件
- `src/utils/discard-counter.ts` — 共享 discard counter 工具

### PR-1 修改文件
- `lib/utils.ts` — 添加 decodeHtmlEntities, stripHtml
- `src/pipeline/normalize-text.ts` — 使用共享函数
- `src/adapters/zeli.ts` — 使用 computeTimeCutoff
- `src/adapters/attentionvc.ts` — 使用 computeTimeCutoff + discard-counter
- `src/adapters/clawfeed.ts` — 使用 computeTimeCutoff
- `src/reports/ai-flash.ts` — 使用 beijingDayRange

### PR-2 修改文件
- `src/types/index.ts` — 添加 union types
- `src/adapters/rss.ts` — 使用共享类型和函数
- `src/adapters/json-feed.ts` — 使用共享类型和函数
- `src/adapters/x-bird.ts` — stringly-typed 修复
- `src/adapters/attentionvc.ts` — 使用 DiscardCounters
- `src/pipeline/normalize.ts` — 验证 Q-2
- `src/pipeline/collect.ts` — 简化 types 推导
- `src/pipeline/dedupe-near.ts` — 删除过度注释

### PR-3 修改文件
- `src/config/index.ts` — 改为 async
- `src/cli/run.ts` — 使用 Map 优化
- `src/pipeline/enrich.ts` — 全并发 batch
- `src/ai/providers/base.ts` — 优化日志
- `src/adapters/x-bird.ts` — buffer 限制
- `src/reports/ai-flash.ts` — regex 批量处理

### PR-4 修改文件
- `src/pipeline/enrich.ts` — 添加 warn 日志
- `src/reports/ai-flash.ts` — 优化错误检测
- `src/adapters/github-trending.ts` — 使用 logger
- `src/adapters/zeli.ts` — 简化 null 检查

### PR-5 删除文件
- `src/cache/content-cache.ts`
- `src/cache/content-cache.test.ts`
- `src/cache/unified-cache.ts`

---

## PR-1: P0 重复代码修复

### Task 1.1: 新建 discard-counter.ts

**Files:**
- Create: `src/utils/discard-counter.ts`

- [ ] **Step 1: 创建文件**

```typescript
import type { Logger } from '../utils/logger.js';

export interface DiscardCounters {
  noTimestamp: number;
  outsideWindow: number;
  invalidTimestamp: number;
}

export function createDiscardCounters(): DiscardCounters {
  return { noTimestamp: 0, outsideWindow: 0, invalidTimestamp: 0 };
}

export function logDiscardSummary(
  logger: Logger,
  sourceName: string,
  totalCollected: number,
  counters: DiscardCounters
): void {
  const total = counters.noTimestamp + counters.outsideWindow + counters.invalidTimestamp;
  logger.info(`[${sourceName}] 收集完成`, {
    stage: 'collect',
    total,
    totalCollected,
    ...counters,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/discard-counter.ts
git commit -m "feat: add discard-counter utils for shared adapter logging"
```

---

### Task 1.2: lib/utils.ts 添加统一工具函数

**Files:**
- Modify: `lib/utils.ts`

- [ ] **Step 1: 添加 decodeHtmlEntities**

在文件末尾添加:

```typescript
export interface DecodeHtmlEntitiesOptions {
  includeCdata?: boolean;
}

export function decodeHtmlEntities(
  value: string,
  options: DecodeHtmlEntitiesOptions = {}
): string {
  let result = value;
  if (options.includeCdata) {
    result = result.replace(/<!\[CDATA\[(.*?)\]]>/gs, "$1");
  }
  return result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
```

- [ ] **Step 2: 添加 StripHtmlOptions 和 stripHtml**

```typescript
export interface StripHtmlOptions {
  removeSvg?: boolean;
}

export function stripHtml(value: string, options: StripHtmlOptions = {}): string {
  let result = value;
  if (options.removeSvg) {
    result = result.replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
  }
  return result.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add lib/utils.ts
git commit -m "feat: add decodeHtmlEntities and stripHtml to lib/utils"
```

---

### Task 1.3: normalize-text.ts 使用共享函数

**Files:**
- Modify: `src/pipeline/normalize-text.ts`

- [ ] **Step 1: 读取文件查看当前 import**

```bash
head -30 src/pipeline/normalize-text.ts
```

- [ ] **Step 2: 添加 import 并删除本地定义**

添加:
```typescript
import { removePunctuation, decodeHtmlEntities, stripHtml } from '../../lib/utils.js'
```

删除本地 `removePunctuation`, `decodeHtmlEntities`, `stripHtml` 函数定义。

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/normalize-text.ts
git commit -m "refactor: use shared utils from lib/utils.ts"
```

---

### Task 1.4: zeli.ts 使用 computeTimeCutoff

**Files:**
- Modify: `src/adapters/zeli.ts`

- [ ] **Step 1: 读取文件查看 import 和第29行**

```bash
head -35 src/adapters/zeli.ts
```

- [ ] **Step 2: 添加 import**

```typescript
import { computeTimeCutoff } from '../../lib/utils.js'
```

- [ ] **Step 3: 替换 inline 实现**

找到 `new Date(jobStartedAt).getTime() - timeWindow`，改为 `computeTimeCutoff(jobStartedAt, timeWindow)`

- [ ] **Step 4: typecheck + test**

```bash
bun run typecheck && bun test src/adapters/zeli.test.ts 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/zeli.ts
git commit -m "refactor: use computeTimeCutoff from lib/utils"
```

---

### Task 1.5: attentionvc.ts 使用 computeTimeCutoff 和 DiscardCounters

**Files:**
- Modify: `src/adapters/attentionvc.ts`

- [ ] **Step 1: 读取文件**

```bash
head -20 src/adapters/attentionvc.ts
grep -n "cutoffMs\|discard" src/adapters/attentionvc.ts
```

- [ ] **Step 2: 添加 import**

```typescript
import { computeTimeCutoff } from '../../lib/utils.js'
import { createDiscardCounters, logDiscardSummary } from '../utils/discard-counter.js'
```

- [ ] **Step 3: 替换 computeTimeCutoff**

找到 `new Date(jobStartedAt).getTime() - timeWindow`，改为 `computeTimeCutoff(jobStartedAt, timeWindow)`

- [ ] **Step 4: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/attentionvc.ts
git commit -m "refactor: use computeTimeCutoff and discard-counter"
```

---

### Task 1.6: clawfeed.ts 使用 computeTimeCutoff

**Files:**
- Modify: `src/adapters/clawfeed.ts`

- [ ] **Step 1: 读取文件**

```bash
head -40 src/adapters/clawfeed.ts
```

- [ ] **Step 2: 添加 import 并替换**

```typescript
import { computeTimeCutoff } from '../../lib/utils.js'
```

替换 `new Date(jobStartedAt).getTime() - timeWindow` 为 `computeTimeCutoff(jobStartedAt, timeWindow)`

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/clawfeed.ts
git commit -m "refactor: use computeTimeCutoff from lib/utils"
```

---

### Task 1.7: ai-flash.ts 使用 beijingDayRange

**Files:**
- Modify: `src/reports/ai-flash.ts`

- [ ] **Step 1: 读取文件查看函数**

```bash
grep -n "parseBeijingDate\|formatBeijingDate\|beijingDayRange" src/reports/ai-flash.ts
```

- [ ] **Step 2: 添加 import**

```typescript
import { beijingDayRange } from '../../lib/date-utils.js'
```

- [ ] **Step 3: 替换实现**

将 `parseBeijingDate` 和 `formatBeijingDate` 的调用处改为使用 `beijingDayRange`。

注意：这是**行为变更**，字符串相等比较改为时间范围比较。

```typescript
// 原来:
const todayStr = formatBeijingDate(new Date());
const todayItems = items.filter(item => formatBeijingDate(parseBeijingDate(item.pubDate)) === todayStr);

// 改为:
const { start, end } = beijingDayRange(new Date().toISOString().split('T')[0]);
const todayItems = items.filter(item => {
  const itemDate = parseBeijingDate(item.pubDate);
  return itemDate >= start && itemDate <= end;
});
```

- [ ] **Step 4: typecheck + test**

```bash
bun run typecheck && bun test src/reports/ai-flash.test.ts 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add src/reports/ai-flash.ts
git commit -m "refactor: use beijingDayRange from lib/date-utils"
```

---

### Task 1.8: rss.ts 使用统一 decodeHtmlEntities

**Files:**
- Modify: `src/adapters/rss.ts`

- [ ] **Step 1: 读取文件**

```bash
grep -n "decodeXml\|function decode" src/adapters/rss.ts
```

- [ ] **Step 2: 添加 import**

```typescript
import { decodeHtmlEntities } from '../../lib/utils.js'
```

- [ ] **Step 3: 删除本地 decodeXml，调用处改为 decodeHtmlEntities(raw, { includeCdata: true })**

- [ ] **Step 4: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/rss.ts
git commit -m "refactor: use decodeHtmlEntities from lib/utils"
```

---

### Task 1.9: github-trending.ts 使用共享 stripHtml

**Files:**
- Modify: `src/adapters/github-trending.ts`

- [ ] **Step 1: 读取文件**

```bash
grep -n "stripHtml\|function strip" src/adapters/github-trending.ts
```

- [ ] **Step 2: 添加 import**

```typescript
import { stripHtml } from '../../lib/utils.js'
```

- [ ] **Step 3: 删除本地 stripHtml，调用处改为 stripHtml(html, { removeSvg: true })**

- [ ] **Step 4: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/github-trending.ts
git commit -m "refactor: use stripHtml from lib/utils"
```

---

### Task 1.10: PR-1 验证

- [ ] **Step 1: 运行完整验证**

```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

---

## PR-2: P1 代码质量修复

### Task 2.1: types/index.ts 添加 union types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 读取文件查看当前类型定义**

```bash
grep -n "type: string\|contentType: string" src/types/index.ts
```

- [ ] **Step 2: 添加 union types**

在文件末尾添加:

```typescript
export type SourceType = 'rss' | 'x' | 'json-feed' | 'github-trending' | 'zeli' | 'attentionvc' | 'clawfeed' | 'github';
export type ContentType = 'article' | 'tweet' | 'github';
export type AdapterType = 'hexi-daily' | 'juya-daily' | 'clawfeed-daily';

export const ADAPTER_TYPES = {
  JSON_FEED: 'json-feed',
  RSS: 'rss',
  X: 'x',
  ZELI: 'zeli',
  ATTENTIONVC: 'attentionvc',
  CLAWFEED: 'clawfeed',
} as const;

export interface ParseItemsOptions {
  jobStartedAt: string;
  timeWindow: number;
  source: Source;
}
```

- [ ] **Step 3: 更新 Source interface 中的 type 和 contentType**

```typescript
export interface Source {
  type: SourceType;
  contentType: ContentType;
  // ... 其他字段
}
```

- [ ] **Step 4: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add union types for SourceType, ContentType, AdapterType"
```

---

### Task 2.2: rss.ts 使用共享类型

**Files:**
- Modify: `src/adapters/rss.ts`

- [ ] **Step 1: 读取 ParseRssItemsOptions**

```bash
grep -n "ParseRssItemsOptions\|interface Parse" src/adapters/rss.ts
```

- [ ] **Step 2: 导入 ParseItemsOptions，简化 ParseRssItemsOptions**

```typescript
import type { ParseItemsOptions } from '../types/index.js'

// 删除重复的 ParseRssItemsOptions 或让它扩展 ParseItemsOptions
export type ParseRssItemsOptions = ParseItemsOptions & {
  sourceContentType: string; // 可从 source.contentType 获取，保留向后兼容
}
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/rss.ts
git commit -m "refactor: use shared ParseItemsOptions type"
```

---

### Task 2.3: json-feed.ts 使用共享类型

**Files:**
- Modify: `src/adapters/json-feed.ts`

- [ ] **Step 1: 类似 rss.ts，导入 ParseItemsOptions**

- [ ] **Step 2: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/adapters/json-feed.ts
git commit -m "refactor: use shared ParseItemsOptions type"
```

---

### Task 2.4: x-bird.ts 修复 stringly-typed

**Files:**
- Modify: `src/adapters/x-bird.ts`

- [ ] **Step 1: 读取 BirdSourceConfig**

```bash
grep -n "birdMode\|BirdSourceConfig" src/adapters/x-bird.ts | head -20
```

- [ ] **Step 2: 添加 BirdMode 类型**

```typescript
type BirdMode = 'home' | 'bookmarks' | 'likes' | 'list' | 'user-tweets' | 'search' | 'news' | 'trending';

interface BirdSourceConfig {
  birdMode?: BirdMode;
  // ...
}
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/x-bird.ts
git commit -m "fix: add BirdMode union type for birdMode"
```

---

### Task 2.5: normalize.ts 验证 Q-2

**Files:**
- Modify: `src/pipeline/normalize.ts`

- [ ] **Step 1: 读取 calculateEngagementScore**

```bash
grep -n "calculateEngagementScore" src/pipeline/normalize.ts
grep -n "calculateEngagementScore" src/pipeline/normalize.ts -A 15
```

- [ ] **Step 2: 验证 x/twitter 分支是否可能返回 null**

如果 x/twitter 分支保证返回 number，则删除 `?? 0`。

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit（如有修改）**

```bash
git add src/pipeline/normalize.ts
git commit -m "refactor: remove redundant ?? 0 in engagementScore"
```

---

### Task 2.6: collect.ts 简化 types 推导

**Files:**
- Modify: `src/pipeline/collect.ts`

- [ ] **Step 1: 读取相关代码**

```bash
grep -n "byType\|types ==" src/pipeline/collect.ts
```

- [ ] **Step 2: 替换为 Set**

```typescript
// 原来: byType Map + Array.from(keys)
// 改为:
const types = [...new Set(sources.map(s => s.type))];
```

- [ ] **Step 3: typecheck + test**

```bash
bun run typecheck && bun test src/pipeline/collect.test.ts 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/collect.ts
git commit -m "refactor: simplify types extraction using Set"
```

---

### Task 2.7: dedupe-near.ts 删除过度注释

**Files:**
- Modify: `src/pipeline/dedupe-near.ts`

- [ ] **Step 1: 读取并识别过度注释**

```bash
sed -n '1,10p' src/pipeline/dedupe-near.ts
sed -n '19,22p' src/pipeline/dedupe-near.ts
sed -n '69,72p' src/pipeline/dedupe-near.ts
sed -n '81,86p' src/pipeline/dedupe-near.ts
```

- [ ] **Step 2: 删除以下注释块**
- 行 3-4（NearDedupItem interface 说明）
- 行 19-21（tokenize 说明）
- 行 69-70（hasSharedToken 说明）
- 行 81-84（Union-Find 说明）

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/dedupe-near.ts
git commit -m "refactor: remove excessive comments in dedupe-near"
```

---

### Task 2.8: attentionvc.ts 使用 DiscardCounters

**Files:**
- Modify: `src/adapters/attentionvc.ts`

- [ ] **Step 1: 读取 discard counter 相关代码**

```bash
grep -n "discardNoTimestamp\|discardOutsideWindow\|discardInvalidTimestamp\|totalDiscarded" src/adapters/attentionvc.ts
```

- [ ] **Step 2: 替换为 DiscardCounters 接口**

```typescript
const counters = createDiscardCounters();
// ...
logDiscardSummary(logger, sourceName, items.length, counters);
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/attentionvc.ts
git commit -m "refactor: use DiscardCounters from discard-counter"
```

---

### Task 2.9: PR-2 验证

- [ ] **Step 1: 运行完整验证**

```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

---

## PR-3: P2 效率问题修复

### Task 3.1: config/index.ts 改为 async

**Files:**
- Modify: `src/config/index.ts`

- [ ] **Step 1: 读取 loadConfig**

```bash
grep -n "export function loadConfig" src/config/index.ts
sed -n '164,170p' src/config/index.ts
```

- [ ] **Step 2: 改为 async 实现**

```typescript
export async function loadConfig(): Promise<AppConfig> {
  const [sources, tags, { enrichOptions, dailyConfig }, aiFlashSources] = await Promise.all([
    loadSources(),
    loadTags(),
    loadReportsConfig(),
    loadAiFlashSources(),
  ]);
  return { sources, tags, enrichOptions, dailyConfig, aiFlashSources };
}
```

- [ ] **Step 3: 查找调用方并更新**

```bash
grep -rn "loadConfig()" src/
```

所有调用方需改为 `await loadConfig()`。

- [ ] **Step 4: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/config/index.ts
git commit -m "perf: parallelize config loading with Promise.all"
```

---

### Task 3.2: cli/run.ts 使用 Map 优化

**Files:**
- Modify: `src/cli/run.ts`

- [ ] **Step 1: 读取 sources.find 相关代码**

```bash
grep -n "sources.find\|sourceWeightScore" src/cli/run.ts
```

- [ ] **Step 2: 在循环前构建 Map**

```typescript
const sourceMap = new Map(sources.map(s => [s.id, s]));
```

- [ ] **Step 3: 循环内使用 Map.get**

```typescript
const source = sourceMap.get(item.sourceId);  // O(1) 替代 O(n)
```

- [ ] **Step 4: typecheck + e2e 验证**

```bash
bun run typecheck && bun run src/cli/run.ts -t 1h
```

- [ ] **Step 5: Commit**

```bash
git add src/cli/run.ts
git commit -m "perf: use Map for O(1) source lookup"
```

---

### Task 3.3: enrich.ts 改为全并发 batch

**Files:**
- Modify: `src/pipeline/enrich.ts`

- [ ] **Step 1: 读取 batch 处理代码**

```bash
grep -n "batchSize\|for (let i" src/pipeline/enrich.ts
```

- [ ] **Step 2: 改为全并发实现**

```typescript
const batches: Article[][] = [];
for (let i = 0; i < articles.length; i += options.batchSize) {
  batches.push(articles.slice(i, i + options.batchSize));
}
await Promise.all(
  batches.map(batch => Promise.all(batch.map(article => enrichArticleItem(article, options))))
);
```

- [ ] **Step 3: typecheck + test**

```bash
bun run typecheck && bun test src/pipeline/enrich.test.ts 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/enrich.ts
git commit -m "perf: run all batches concurrently in enrich"
```

---

### Task 3.4: base.ts 优化日志

**Files:**
- Modify: `src/ai/providers/base.ts`

- [ ] **Step 1: 读取 response 日志代码**

```bash
grep -n "JSON.stringify.*1000\|truncateWithLength.*JSON" src/ai/providers/base.ts
```

- [ ] **Step 2: 优化为只序列化一次**

```typescript
const responseStr = JSON.stringify(json);
this.logger.debug("Response details", {
  response: responseStr.length > 1000 ? responseStr.substring(0, 1000) + '...' : responseStr,
  fullLength: responseStr.length,
});
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/ai/providers/base.ts
git commit -m "perf: optimize response logging in AI provider"
```

---

### Task 3.5: x-bird.ts 添加 buffer 限制

**Files:**
- Modify: `src/adapters/x-bird.ts`

- [ ] **Step 1: 读取 buffer 处理代码**

```bash
grep -n "stdoutChunks\|stderrChunks" src/adapters/x-bird.ts
sed -n '400,420p' src/adapters/x-bird.ts
```

- [ ] **Step 2: 添加 10MB 限制**

```typescript
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;
let stdoutSize = 0;
let stderrSize = 0;

proc.stdout?.on("data", (chunk: Buffer) => {
  if (stdoutSize + chunk.length > MAX_BUFFER_SIZE) {
    stdoutChunks.push(chunk.subarray(0, MAX_BUFFER_SIZE - stdoutSize));
    stdoutSize = MAX_BUFFER_SIZE;
    return;
  }
  stdoutChunks.push(chunk);
  stdoutSize += chunk.length;
});
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/x-bird.ts
git commit -m "perf: add 10MB buffer limit in x-bird adapter"
```

---

### Task 3.6: ai-flash.ts 使用 matchAll 批量处理

**Files:**
- Modify: `src/reports/ai-flash.ts`

- [ ] **Step 1: 读取 regex 处理代码**

```bash
grep -n "itemRegex.exec\|pubDateRegex.exec\|contentRegex.exec" src/reports/ai-flash.ts
```

- [ ] **Step 2: 用 matchAll 批量处理**

```typescript
const matches = [...xml.matchAll(itemRegex)];
const items = matches.map(match => {
  const itemXml = match[1];
  const pubDateMatch = itemXml.match(pubDateRegex);
  const contentMatch = itemXml.match(contentRegex);
  return {
    pubDate: pubDateMatch?.[1],
    content: contentMatch?.[1],
  };
});
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/reports/ai-flash.ts
git commit -m "perf: use matchAll for batch regex processing in ai-flash"
```

---

### Task 3.7: PR-3 验证

- [ ] **Step 1: 运行完整验证**

```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

---

## PR-4: P3 错误处理增强

### Task 4.1: enrich.ts 添加 warn 日志

**Files:**
- Modify: `src/pipeline/enrich.ts`

- [ ] **Step 1: 读取 catch 块**

```bash
grep -n "catch.*error\|return null" src/pipeline/enrich.ts
```

- [ ] **Step 2: 添加 warn 日志**

```typescript
} catch (error) {
  logger.warn('内容提取失败', {
    stage: 'enrich',
    url,
    error: error instanceof Error ? error.message : String(error),
  });
  return null;
}
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/enrich.ts
git commit -m "fix: add warn log for content extraction failures"
```

---

### Task 4.2: ai-flash.ts 优化错误检测

**Files:**
- Modify: `src/reports/ai-flash.ts`

- [ ] **Step 1: 读取错误检测代码**

```bash
grep -n "Warning:.*error\|includes.*Warning" src/reports/ai-flash.ts
```

- [ ] **Step 2: 增强检测 pattern**

```typescript
if (/<title>Error<\/title>/i.test(text) || (text.includes('Warning:') && text.includes('error'))) {
  return null;
}
```

- [ ] **Step 3: 提取广告关键词为常量**

```typescript
const AD_KEYWORDS = ['ucloud', '6.9元购'];

const contentLines = lines.slice(startIdx, endIdx).filter(line => {
  return !AD_KEYWORDS.some(keyword => line.includes(keyword));
});
```

- [ ] **Step 4: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/reports/ai-flash.ts
git commit -m "fix: improve error detection and ad filtering in ai-flash"
```

---

### Task 4.3: github-trending.ts 使用 logger

**Files:**
- Modify: `src/adapters/github-trending.ts`

- [ ] **Step 1: 读取 console.warn**

```bash
grep -n "console.warn" src/adapters/github-trending.ts
```

- [ ] **Step 2: 改为 logger.warn**

```typescript
logger.warn('文章解析失败', {
  stage: 'collect',
  source: 'github-trending',
  articleIndex: index + 1,
  error: error instanceof Error ? error.message : String(error),
});
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/github-trending.ts
git commit -m "fix: use logger.warn instead of console.warn"
```

---

### Task 4.4: zeli.ts 简化 null 检查

**Files:**
- Modify: `src/adapters/zeli.ts`

- [ ] **Step 1: 读取 null 检查**

```bash
grep -n "=== undefined.*=== null" src/adapters/zeli.ts
```

- [ ] **Step 2: 改为 == null**

```typescript
if (ts == null) return null;  // 同时处理 undefined 和 null
```

- [ ] **Step 3: typecheck 验证**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/adapters/zeli.ts
git commit -m "refactor: simplify null check to == null"
```

---

### Task 4.5: PR-4 验证

- [ ] **Step 1: 运行完整验证**

```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

---

## PR-5: 清理 — 删除 content-cache

### Task 5.1: 删除缓存相关文件

**Files:**
- Delete: `src/cache/content-cache.ts`
- Delete: `src/cache/content-cache.test.ts`
- Delete: `src/cache/unified-cache.ts`

- [ ] **Step 1: 确认无其他引用**

```bash
grep -rn "UnifiedContentCache\|createUnifiedCache\|content-cache" src/ --include="*.ts" | grep -v "src/cache/"
```

应该无输出。

- [ ] **Step 2: 删除文件**

```bash
rm src/cache/content-cache.ts src/cache/content-cache.test.ts src/cache/unified-cache.ts
```

- [ ] **Step 3: typecheck + test 验证**

```bash
bun run typecheck && bun test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "cleanup: remove content-cache (not useful for daily job)"
```

---

### Task 5.2: PR-5 验证

- [ ] **Step 1: 运行完整验证**

```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

---

## 最终验证

### Task F1: 全部 PR 合并后验证

- [ ] **Step 1: 运行完整验证**

```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

---

## 验证命令汇总

每个 PR 后执行:
```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```

**Spec 位置**: `docs/superpowers/specs/2026-04-05-simplify-code-review-design.md`
