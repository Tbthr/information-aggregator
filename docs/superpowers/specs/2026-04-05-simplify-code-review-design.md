# 代码简化与优化设计

## 背景

对项目全部代码进行复用性（Code Reuse）、质量（Quality）和效率（Efficiency）审查后，识别出 **30+ 个问题**，分为 4 个优先级。本文档描述所有问题的修复方案和分 PR 策略。

**审查范围**: `src/cli/`, `src/pipeline/`, `src/adapters/`, `src/ai/`, `src/reports/`, `src/archive/`, `lib/`

---

## 分 PR 策略

| PR | 优先级 | 问题数 | 涉及文件 |
|----|--------|--------|---------|
| PR-1 | P0 | 7 | lib/utils.ts, src/pipeline/normalize-text.ts, zeli.ts, attentionvc.ts, clawfeed.ts, src/reports/ai-flash.ts, 新建 discard-counter.ts |
| PR-2 | P1 | 8 | src/types/index.ts, x-bird.ts, ai-flash.ts, build-adapters.ts, rss.ts, json-feed.ts |
| PR-3 | P2 | 4 | config/index.ts, cli/run.ts, enrich.ts, ai/providers/base.ts, x-bird.ts, ai-flash.ts |
| PR-4 | P3 | 5 | enrich.ts, ai-flash.ts, github-trending.ts, zeli.ts |
| PR-5 | 清理 | 3 | 删除 src/cache/ 目录（content-cache.ts, unified-cache.ts, content-cache.test.ts） |

> 注: E-4, E-10, E-11 — 因删除 content-cache.ts（日报每天执行一次，缓存无意义），连带删除 unified-cache.ts 及相关测试

**验证标准**: 每个 PR 需通过 `bun run typecheck && bun test && bun run src/cli/run.ts -t 1h`

---

## PR-1: P0 重复代码修复（DRY 违规）

### R-1: `removePunctuation` 重复定义

**问题**: `lib/utils.ts:86` 已有正确实现，`src/pipeline/normalize-text.ts:42-44` 重复定义。

**修复**:
```typescript
// src/pipeline/normalize-text.ts
// 删除第 42-44 行本地定义，添加 import
import { removePunctuation } from '../../lib/utils.ts'
```

### R-2: `computeTimeCutoff` 未被所有 adapter 使用

**问题**: `lib/utils.ts:101` 有正确实现，但 `zeli.ts`, `attentionvc.ts`, `clawfeed.ts` 各自 inline 实现。

**修复**: 三个 adapter 都改为:
```typescript
import { computeTimeCutoff } from '../../lib/utils.ts'
// 将 new Date(jobStartedAt).getTime() - timeWindow 改为 computeTimeCutoff(jobStartedAt, timeWindow)
```

### R-3: 北京时间工具函数重复

**问题**: `src/reports/ai-flash.ts:68-81` 重复实现了 `lib/date-utils.ts` 中的 `beijingDayRange`。

**行为变更**: 原实现用 `formatBeijingDate` 做**字符串相等**比较，新实现用 `beijingDayRange` 做**时间范围**比较。后者更正确（处理 timezone 边界），但语义有变化。

**修复**:
```typescript
import { beijingDayRange } from '../../lib/date-utils.ts'

// 原: formatBeijingDate(itemDate) === todayStr
// 改为: itemDate >= start && itemDate <= end
const { start, end } = beijingDayRange(formatBeijingDate(new Date()));
const todayItems = items.filter(item => {
  const itemDate = parseBeijingDate(item.pubDate);
  return itemDate >= start && itemDate <= end;
});
```

### R-4: `decodeXml` vs `decodeHtmlEntities` 功能重叠

**问题**: `rss.ts` 有完整版（含 CDATA），`normalize-text.ts` 有子集版（多 &nbsp;）。

**修复**: 在 `lib/utils.ts` 统一实现:
```typescript
export function decodeHtmlEntities(
  value: string,
  options: { includeCdata?: boolean } = {}
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
`rss.ts` 调用 `decodeHtmlEntities(raw, { includeCdata: true })`，`normalize-text.ts` 调用 `decodeHtmlEntities(raw)`。

### R-5: `stripHtml` 多个变体

**问题**: `normalize-text.ts` 简单版 vs `github-trending.ts` 含 SVG 移除版。

**修复**: 在 `lib/utils.ts` 添加带选项版本:
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

### R-6: Discard counter 模式重复

**问题**: `rss.ts`, `json-feed.ts`, `x-bird.ts`, `attentionvc.ts` 四个 adapter 有完全相同的 discard counter 模式。

**修复**: 新建 `src/utils/discard-counter.ts`:
```typescript
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

### R-7: `normalizeWhitespace` 未导出

**修复**: `normalize-text.ts` 的 `normalizeWhitespace` 已在文件内 export，确认 `lib/utils.ts` 也有一致版本或添加导出。

---

## PR-2: P1 代码质量修复

### Q-1: Discard 计数器可合并

**问题**: 每个 adapter 用 3 个独立变量追踪。

**修复**: 使用 R-6 的 `DiscardCounters` 接口，统一管理。

### Q-2: `?? 0` 冗余（需验证）

**问题**: `normalize.ts:38-40` 中 `?? 0` 可能冗余。

**⚠️ 实现前验证**: `calculateEngagementScore` 对 x/twitter 类型返回 `number`，对其他类型返回 `null`。需要确认 x/twitter 分支不会返回 `null`，否则删除 `?? 0` 会引入 bug。

**修复**: 验证后如确认安全:
```typescript
// 删除 ?? 0
const engagementScore = item.engagement
  ? calculateEngagementScore(item.engagement, sourceType)
  : 0;
```

### Q-3: `types` 从 Map keys 冗余推导

**问题**: `collect.ts:55-63` 先 build Map 再取 keys。

**修复**:
```typescript
// 原来: byType Map + Array.from(keys)
// 改为:
const types = [...new Set(sources.map(s => s.type))];
```

### Q-4: Adapter 参数过多

**问题**: `rss.ts`, `json-feed.ts`, `github-trending.ts` 都有 4-5 个独立参数。

**修复**: 创建统一接口:
```typescript
export interface SourceItemOptions {
  source: Source;
  jobStartedAt: string;
  timeWindow: number;
}

export function parseRssItems(xml: string, options: SourceItemOptions): RawItem[] {
  const { source, jobStartedAt, timeWindow } = options;
  // ...
}
```

### Q-6: Stringly-typed 代码

**问题**: `Source.type`, `Source.contentType` 等用 `string` 而非 union type。

**修复**: 在 `src/types/index.ts` 添加:
```typescript
export type SourceType = 'rss' | 'x' | 'json-feed' | 'github-trending' | 'zeli' | 'attentionvc' | 'clawfeed' | 'github';
export type ContentType = 'article' | 'tweet' | 'github';
export type AdapterType = 'hexi-daily' | 'juya-daily' | 'clawfeed-daily';

export interface Source {
  type: SourceType;
  contentType: ContentType;
  // ...
}
```

### Q-7: Adapter string literal 散落

**修复**: 集中到 `src/types/index.ts`:
```typescript
export const ADAPTER_TYPES = {
  JSON_FEED: 'json-feed',
  RSS: 'rss',
  X: 'x',
  ZELI: 'zeli',
  ATTENTIONVC: 'attentionvc',
  CLAWFEED: 'clawfeed',
} as const;
```

### Q-5: Adapter parseDate/options 接口重复

**问题**: RSS 和 JSON-feed adapter 有相同的 `ParseRssItemsOptions` 和 `ParseJsonFeedItemsOptions` 接口，且 timestamp 解析逻辑相同。

**修复**: 抽取公共类型到 `src/types/index.ts`:
```typescript
export interface ParseItemsOptions {
  jobStartedAt: string;
  timeWindow: number;
  source: Source;  // 包含 sourceName, sourceType, contentType
}
```

### Q-8: 过度解释的注释

**问题**: `dedupe-near.ts`, `x-bird.ts`, `concurrency.ts`, `enrich.ts` 有大量自说明注释。

**修复**: 删除以下注释:
- dedupe-near.ts: 行 3-4, 19-21, 69-70, 81-84
- x-bird.ts: 行 80-98 JSDoc
- concurrency.ts: 行 13-14
- enrich.ts: 行 44-48

---

## PR-3: P2 效率问题修复

### E-1: 顺序文件读取阻塞启动 ⭐ 性能热点

**问题**: `config/index.ts:164-168` 四个加载函数顺序执行。

**修复**:
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
// 调用方改为 await loadConfig()
```

### E-2: N+1 sources.find() ⭐ 性能热点

**问题**: `cli/run.ts:143` 每条 item 都执行 `sources.find()`。

**修复**:
```typescript
const sourceMap = new Map(sources.map(s => [s.id, s]));
const normalized = rawItems.map(item => {
  const source = sourceMap.get(item.sourceId);  // O(1)
  // ...
});
```

### E-3: 批处理顺序执行 → 全并行 ⭐ 性能热点

**问题**: `enrich.ts:219-222` 批处理串行（当前批次完成才处理下一批次）。

**行为变更**: 原实现是"顺序 batch + 并发 item"，新实现是"全并发 batch + 并发 item"。这是**有意为之的性能优化**，可显著提升 throughput，但会短暂增加内存使用。

**修复**:
```typescript
const batches: Article[][] = [];
for (let i = 0; i < articles.length; i += options.batchSize) {
  batches.push(articles.slice(i, i + options.batchSize));
}
await Promise.all(
  batches.map(batch => Promise.all(batch.map(article => enrichArticleItem(article, options))))
);
```

### E-4: while 循环反复执行 regex

**问题**: `normalize-text.ts:24` while 循环多次 match。

**修复**:
```typescript
// 原来: while (SITE_NAME_PATTERN.test(result)) result = result.replace(...)
// 改为: SITE_NAME_PATTERN 带 global flag，一次全清
function removeSiteName(value: string): string {
  return value.replace(SITE_NAME_PATTERN, '');
}
```

### E-5: 响应完整序列化截断日志

**问题**: `ai/providers/base.ts:133` JSON.stringify 完整响应再截断。

**修复**:
```typescript
const responseStr = JSON.stringify(json);
this.logger.debug("Response details", {
  response: responseStr.length > 1000 ? responseStr.substring(0, 1000) + '...' : responseStr,
  fullLength: responseStr.length,
});
```

### E-6: JSON parse 后立即 stringify

**问题**: `json-feed.ts:180-193` parse 再 stringify 仅用于日志。

**修复**: 用结构化日志替代完整序列化预览。

### E-7: x-bird 无界 buffer 增长

**问题**: `x-bird.ts:404-414` 无上限累积。

**修复**: 添加 10MB 限制:
```typescript
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;
let stdoutSize = 0;
proc.stdout?.on("data", (chunk: Buffer) => {
  if (stdoutSize + chunk.length > MAX_BUFFER_SIZE) {
    stdoutChunks.push(chunk.subarray(0, MAX_BUFFER_SIZE - stdoutSize));
    return;
  }
  stdoutChunks.push(chunk);
  stdoutSize += chunk.length;
});
```

### E-8: 每条目重复 regex exec

**问题**: `ai-flash.ts:108-113` 循环内多次 exec。

**修复**: 用 `matchAll` 批量处理。

---

## PR-4: P3 错误处理增强

### H-1: `execSync` 错误静默吞掉

**问题**: `enrich.ts:150-154` execSync 异常无日志。

**修复**:
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

### H-2: 字符串匹配检测错误内容

**问题**: `ai-flash.ts:28-30` 用 `includes('Warning:')` 和 `includes('error')` 检测 r.jina.ai 返回的错误页面。

**注意**: r.jina.ai 返回的是**内容**（HTML/Markdown），不是 HTTP 协议头，所以不能用 HTTP 状态码正则。保留原有字符串匹配，但增强为更精确的 pattern:

**修复**:
```typescript
// r.jina.ai error page detection - more precise pattern
if (/<title>Error<\/title>/i.test(text) || (text.includes('Warning:') && text.includes('error'))) {
  return null;
}
```

### H-3: 广告过滤硬编码

**问题**: `ai-flash.ts:53-58` 硬编码广告关键词。

**修复**: 提取为配置常量:
```typescript
const AD_KEYWORDS = ['ucloud', '6.9元购'];
```

### H-4: 使用 `console.warn`

**问题**: `github-trending.ts:153-156` 用 `console.warn` 而非项目 logger。

**修复**: 改用 `logger.warn`。

### H-5: null 检查冗余

**问题**: `zeli.ts:15` `ts === undefined || ts === null`。

**修复**: `ts == null` 同时处理。

---

## 影响范围汇总

| 文件 | PR-1 | PR-2 | PR-3 | PR-4 |
|------|------|------|------|------|
| `lib/utils.ts` | R-1,R-4,R-5 | | | |
| `src/pipeline/normalize-text.ts` | R-1,R-4,R-5 | | E-5 | |
| `src/pipeline/normalize.ts` | | Q-2 | | |
| `src/pipeline/collect.ts` | | Q-3 | | |
| `src/pipeline/enrich.ts` | | | E-3 | H-1 |
| `src/pipeline/dedupe-near.ts` | | Q-8 | | |
| `src/config/index.ts` | | | E-1 | |
| `src/cli/run.ts` | | | E-2 | |
| `src/adapters/rss.ts` | R-4 | Q-1,Q-4,Q-5 | | |
| `src/adapters/json-feed.ts` | | Q-1,Q-4,Q-5 | | E-6 |
| `src/adapters/x-bird.ts` | | Q-6 | E-7 | |
| `src/adapters/zeli.ts` | R-2 | | | H-5 |
| `src/adapters/attentionvc.ts` | R-2,R-6 | Q-1 | | |
| `src/adapters/clawfeed.ts` | R-2 | | | |
| `src/adapters/github-trending.ts` | R-5 | | | H-4 |
| `src/reports/ai-flash.ts` | R-3 | | E-8 | H-2,H-3 |
| `src/types/index.ts` | | Q-5,Q-6,Q-7 | | |
| `src/ai/providers/base.ts` | | | E-4,E-5 | |
| `src/utils/discard-counter.ts` | R-6 | | | (新建) |
| `src/cache/` | | | | PR-5 删除 |

## 实施顺序

1. **PR-1 (P0)**: 先修重复代码，建立共享基础
2. **PR-2 (P1)**: 类型系统 + 质量清理
3. **PR-3 (P2)**: 效率优化（涉及 config 改 async）
4. **PR-4 (P3)**: 错误处理增强
5. **PR-5 (清理)**: 删除 src/cache/ 目录

---

## PR-5: 清理 — 删除 content-cache

### 背景

日报每天执行一次，`content-cache.ts` 的缓存意义不大（进程结束即清空，重启后无缓存收益）。

### 删除文件

- `src/cache/content-cache.ts`
- `src/cache/content-cache.test.ts`
- `src/cache/unified-cache.ts`（依赖 content-cache）

### 影响

`UnifiedContentCache` 无其他调用方，可安全删除。删除后需确保 `enrich.ts` 等模块不再引用这些缓存。

---

每个 PR 后执行:
```bash
bun run typecheck && bun test && bun run src/cli/run.ts -t 1h
```
