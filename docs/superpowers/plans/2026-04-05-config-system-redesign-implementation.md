# 配置系统重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 4 个 YAML 配置统一为 2 个，添加 Zod Schema 校验，让硬编码值可配置

**Architecture:**
- 新建 `config/config.yaml` 合并原 tags + reports + ai-flash-sources
- 新建 `src/types/config.ts` 统一 Zod Schema 定义
- 重写 `src/config/index.ts` 为统一加载器，config.yaml 走 Zod 校验
- 各 pipeline 模块从 `loadConfig()` 返回值读取新配置项

**Tech Stack:** Zod, js-yaml, TypeScript

---

## 文件变更总览

| 文件 | 操作 |
|------|------|
| `config/config.yaml` | 新建 |
| `config/tags.yaml` | 删除 |
| `config/reports.yaml` | 删除 |
| `config/ai-flash-sources.yaml` | 删除 |
| `src/types/config.ts` | 新建 |
| `src/config/index.ts` | 重写 |
| `src/pipeline/enrich.ts` | 修改 |
| `src/pipeline/rank.ts` | 修改 |
| `src/pipeline/dedupe-near.ts` | 修改 |
| `src/reports/daily.ts` | 修改 |
| `src/reports/ai-flash.ts` | 修改 |
| `src/cli/run.ts` | 修改 |
| `lib/types.ts` | 清理 |

---

## Task 1: 创建 config.yaml

**文件:** `config/config.yaml`（新建）

- [ ] **Step 1: 创建 config.yaml**

内容从以下三个文件合并：
- `config/tags.yaml` → `tags` section
- `config/reports.yaml` → `enrich` + `aiFlashCategorization` section
- `config/ai-flash-sources.yaml` → `aiFlashSources` section
- 新增 `ranking`、`dedupe`、`content` sections（从硬编码迁移）

```yaml
# config/config.yaml
tags:
  - id: ai-news
    name: AI 资讯
    description: |
      关注 AI 领域的最新动态...
    enabled: true
    includeRules:
      - "openai"
      - "anthropic"
      # ... 其余规则从 tags.yaml 复制
    excludeRules:
      - "广告"
    scoreBoost: 1.0

  # ... 其余 tags 从 tags.yaml 复制

enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000

aiFlashCategorization:
  enabled: true
  prompt: |
    你是一个内容分类助手。请将以下 AI 快讯条目分类到以下类别：
    产品更新 / 前沿研究 / 行业动态 / 开源项目 / 社媒精选 / 其他

    规则：
    - 不要改写任何内容，只输出分类结果
    - 每个条目必须归属一个类别
    - 输出 JSON 格式：{ "categories": [{ "name": "产品更新", "items": [...] }, ...] }
    - 类别数量不超过 6 个，"其他"作为最后兜底

    输入条目：
    {items}

ranking:
  sourceWeight: 0.4
  engagement: 0.15

dedupe:
  nearThreshold: 0.75

content:
  truncationMarkers:
    - "[...]"
    - "Read more"
    - "click here"
    - "read more at"
    - "来源："
    - "Original:"

aiFlashSources:
  - id: hexi-daily
    adapter: hexi-daily
    url: https://r.jina.ai/https://ai.hubtoday.app/{month}/{date}/
    enabled: true
  - id: juya-daily
    adapter: juya-daily
    url: https://imjuya.github.io/juya-ai-daily/rss.xml
    enabled: true
  - id: clawfeed-daily
    adapter: clawfeed-daily
    url: https://clawfeed.kevinhe.io/feed/kevin
    enabled: true
```

---

## Task 2: 创建 src/types/config.ts（Zod Schema）

**文件:** `src/types/config.ts`（新建）

- [ ] **Step 1: 创建 Zod Schema 文件**

```typescript
import { z } from 'zod'

export const TagSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  includeRules: z.array(z.string()).optional().default([]),
  excludeRules: z.array(z.string()).optional().default([]),
  scoreBoost: z.number().optional().default(1.0),
})

export const EnrichSchema = z.object({
  enabled: z.boolean().optional().default(true),
  batchSize: z.number().optional().default(10),
  minContentLength: z.number().optional().default(500),
  fetchTimeout: z.number().optional().default(20000),
})

export const AiFlashCategorizationSchema = z.object({
  enabled: z.boolean().optional().default(true),
  prompt: z.string().optional().default(''),
  // maxCategories 已删除
})

export const RankingSchema = z.object({
  sourceWeight: z.number().optional().default(0.4),
  engagement: z.number().optional().default(0.15),
})

export const DedupeSchema = z.object({
  nearThreshold: z.number().optional().default(0.75),
})

export const ContentSchema = z.object({
  truncationMarkers: z.array(z.string()).optional().default([
    '[...]', 'Read more', 'click here', 'read more at', '来源：', 'Original:',
  ]),
})

export const AiFlashSourceSchema = z.object({
  id: z.string(),
  adapter: z.enum(['hexi-daily', 'juya-daily', 'clawfeed-daily']),
  url: z.string(),
  enabled: z.boolean().optional().default(true),
})

export const AppConfigSchema = z.object({
  tags: z.array(TagSchema),
  enrich: EnrichSchema,
  aiFlashCategorization: AiFlashCategorizationSchema,
  ranking: RankingSchema,
  dedupe: DedupeSchema,
  content: ContentSchema,
  aiFlashSources: z.array(AiFlashSourceSchema),
})

// 从 Schema 推导 Type
export type AppConfig = z.infer<typeof AppConfigSchema>
export type Tag = z.infer<typeof TagSchema>
export type AiFlashSource = z.infer<typeof AiFlashSourceSchema>
export type EnrichOptions = z.infer<typeof EnrichSchema>
export type RankingConfig = z.infer<typeof RankingSchema>
export type DedupeConfig = z.infer<typeof DedupeSchema>
export type ContentConfig = z.infer<typeof ContentSchema>
```

- [ ] **Step 2: 验证 zod 已安装**

```bash
grep '"zod"' package.json
```
期望：看到 zod 在 dependencies 中

---

## Task 3: 重写 src/config/index.ts

**文件:** `src/config/index.ts`（重写）

**前置依赖:** Task 2 完成（Schema 类型已定义）

- [ ] **Step 1: 完全重写加载器**

新 `loadConfig()` 的返回类型：
```typescript
export interface AppConfig {
  sources: Source[]
  tags: Tag[]
  enrichOptions: EnrichOptions
  dailyConfig: {
    aiFlashCategorization: {
      enabled: boolean
      prompt: string
    }
  }
  aiFlashSources: AiFlashSource[]  // 含 url 字段
  rankingConfig: RankingConfig
  dedupeConfig: DedupeConfig
  contentConfig: ContentConfig
  authConfigs: AuthConfigMap
}
```

加载逻辑：
1. `loadSources()` — 读 `sources.yaml`（保持原结构不变）
2. 读 `config.yaml`（走 Zod 校验 `AppConfigSchema.parse()`）
3. `loadAuthConfigsFromEnv()` — 读环境变量中的 auth 配置

**关键：aiFlashSources 映射必须包含 url 字段：**
```typescript
return raw.sources.map(s => ({
  id: s.id,
  adapter: s.adapter as AiFlashSource['adapter'],
  url: s.url,  // 新增，从 YAML 读取
  enabled: s.enabled ?? true,
}))
```

- [ ] **Step 2: 确认无破坏性变更**

`loadConfig()` 返回的 `sources`、`tags`、`aiFlashSources` 结构与之前保持兼容。

- [ ] **Step 3: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 4: 修改 src/pipeline/enrich.ts

**文件:** `src/pipeline/enrich.ts`

**前置依赖:** Task 2 完成（EnrichOptions 类型定义后才能改接口）

- [ ] **Step 1: EnrichOptions 接口加 enabled 和 truncationMarkers 字段**

```typescript
export interface EnrichOptions {
  enabled: boolean  // 新增
  batchSize: number
  minContentLength: number
  fetchTimeout: number
  truncationMarkers?: string[]  // 新增
}
```

- [ ] **Step 2: 流程入口判断 enabled**

在 `enrichCandidates()` 或类似入口函数中：
```typescript
if (!options.enabled) {
  logger.info('enrich disabled, skipping')
  return articles
}
```

- [ ] **Step 3: truncationMarkers 传递到 contentQuality**

`truncationMarkers` 在 `contentQuality` 函数内使用（enrich.ts:64）。需要通过函数参数传递：
- `needsEnrichment` 函数增加 `truncationMarkers` 参数
- `contentQuality` 函数增加 `truncationMarkers` 参数
- 调用链：`入口函数` → `needsEnrichment(options)` → `contentQuality(text, options.minContentLength, truncationMarkers)`

```typescript
// contentQuality 函数签名改为：
function contentQuality(text: string, minLength: number, truncationMarkers: string[]): ContentQualityResult {
  // ...
  const truncationMarkersConst = truncationMarkers
  // ...
}

// needsEnrichment 函数签名改为：
function needsEnrichment(item: normalizedArticle, options: EnrichOptions): NeedsEnrichmentResult {
  // ...
  const quality = contentQuality(normalizedContent, options.minContentLength, options.truncationMarkers ?? [...])
  // ...
}
```

- [ ] **Step 4: 确认 loadConfig() 返回值匹配**

`enrichOptions` 从 `config.content.truncationMarkers` 和 `config.enrich` 读取。

- [ ] **Step 5: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 5: 修改 src/pipeline/rank.ts

**文件:** `src/pipeline/rank.ts`

- [ ] **Step 1: rankCandidates 接受 rankingConfig 参数**

```typescript
export interface RankingOptions {
  sourceWeight: number
  engagement: number
}

export function rankCandidates<T extends RankableCandidate>(
  candidates: T[],
  options: RankingOptions = { sourceWeight: 0.4, engagement: 0.15 }
): Array<T & { finalScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      finalScore:
        candidate.sourceWeightScore * options.sourceWeight +
        candidate.engagementScore * options.engagement,
    }))
    .sort((left, right) => right.finalScore - left.finalScore)
}
```

- [ ] **Step 2: 找到调用 rankCandidates 的地方**

```bash
grep -rn "rankCandidates" src/
```
在调用处传入 `rankingConfig`（从 `loadConfig()` 获取）。

- [ ] **Step 3: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 6: 修改 src/pipeline/dedupe-near.ts

**文件:** `src/pipeline/dedupe-near.ts`

- [ ] **Step 1: findClusters 和 dedupeNear 接受 threshold 参数**

当前签名（第 70 行和第 141 行）：
```typescript
function findClusters<T extends NearDedupItem>(items: T[], threshold = 0.75): Map<number, T[]>
export function dedupeNear<T extends NearDedupItem>(items: T[], threshold = 0.75): T[]
```

改为显式接受参数，不再有默认值（默认值由调用方从 config 传入）。

- [ ] **Step 2: 找到调用 dedupeNear 的地方**

```bash
grep -rn "dedupeNear" src/
```
在调用处传入 `dedupeConfig.nearThreshold`。

- [ ] **Step 3: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 7: 修改 src/reports/daily.ts

**文件:** `src/reports/daily.ts`

- [ ] **Step 1: aiFlashCategorization.enabled 判断**

找到 categorize 调用处（约第 122 行）：
```typescript
const { dailyConfig } = await loadConfig()
// 改为：
const { dailyConfig } = await loadConfig()
if (!dailyConfig.aiFlashCategorization.enabled) {
  // 跳过 AI 分类，直接使用未分类的 flash items
} else {
  const categorizedFlash = await categorizeAiFlash(...)
}
```

- [ ] **Step 2: 移除 maxCategories 参数**

第 125 行：
```typescript
// 之前：
{ maxCategories: dailyConfig.aiFlashCategorization.maxCategories }
// 改为：直接调用，不传 maxCategories
```

- [ ] **Step 3: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 8: 修改 src/reports/ai-flash.ts

**文件:** `src/reports/ai-flash.ts`

- [ ] **Step 1: 删除本地 AiFlashSource 接口，改用 src/types/config.ts 的定义**

找到 ai-flash.ts 第 4-8 行的本地 `AiFlashSource` 接口定义：
```typescript
// 删除本地的重复定义
// import { AiFlashSource } from '../types/config.js'
// 并确保导入来自统一的 config.ts
```

- [ ] **Step 2: categorizeAiFlash 移除 maxCategories**

函数签名（第 313 行）：
```typescript
// 之前：
export async function categorizeAiFlash(
  items: AiFlashItem[],
  aiClient: AiClient,
  options?: { maxCategories?: number }
): Promise<AiFlashCategory[]>
// 改为：
export async function categorizeAiFlash(
  items: AiFlashItem[],
  aiClient: AiClient
): Promise<AiFlashCategory[]>
```

- [ ] **Step 3: systemPrompt 使用 config 中的 prompt**

第 319 行硬编码 prompt 改为从 `loadConfig()` 获取：
```typescript
const { dailyConfig } = await loadConfig()
const systemPrompt = dailyConfig.aiFlashCategorization.prompt ||
  `你是一个内容分类助手...`  // 回退 prompt
```

- [ ] **Step 4: fetchHexiDaily/fetchJuyaDaily/fetchClawfeedDaily 使用 source.url**

第 40 行、230 行、280 行的硬编码 URL 改为使用 `source.url`：
```typescript
// fetchHexiDaily 第 40 行：
// 之前：const url = `https://r.jina.ai/...`
// 改为：const url = source.url
// （{month}/{date} 占位符填充逻辑保留）
```

**注意：** hexi 的 URL 包含 `{month}/{date}` 占位符，填充逻辑保留，只是不再硬编码域名。

- [ ] **Step 5: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 9: 修改 src/cli/run.ts

**文件:** `src/cli/run.ts`

- [ ] **Step 1: 修正 weightScore 默认值**

第 145 行：
```typescript
// 之前：const sourceWeightScore = source?.sourceWeightScore ?? 0.5
// 改为：
const sourceWeightScore = source?.sourceWeightScore ?? 1
```

- [ ] **Step 2: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

---

## Task 10: 清理 lib/types.ts

**文件:** `lib/types.ts`

- [ ] **Step 1: 检查被引用情况**

```bash
grep -rn "from.*lib/types" src/ | head -20
grep -rn "lib/types" src/ | grep -v ".test." | head -20
```

- [ ] **Step 2: 确认哪些类型可删除**

以下类型检查方法：
```bash
grep -rn "Topic\|Article\|DigestTopic\|DailyReportData" src/ | grep "lib/types"
```

- `Topic` — 检查 `src/reports/daily.ts` 是否使用 `lib/types` 的定义（不是 `src/types/index.ts` 的）
- `Article` — 检查是否有 importer
- `DigestTopic`、`DailyReportData`、`WeeklyReportData` — 检查是否有 importer
- `Tweet` — 确认仍被使用（不要删）

如果上述类型在 `src/` 中无 importer，则删除。

---

## Task 11: 删除旧的 YAML 配置文件

**文件:** `config/tags.yaml`、`config/reports.yaml`、`config/ai-flash-sources.yaml`

- [ ] **Step 1: 确认 config.yaml 已包含所有必要内容**
- [ ] **Step 2: 删除三个旧文件**

```bash
rm config/tags.yaml config/reports.yaml config/ai-flash-sources.yaml
```

- [ ] **Step 3: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

- [ ] **Step 4: 运行 CLI 完整流程测试**

```bash
bun run src/cli/run.ts -t 1h
```
期望：正常运行，日报生成

---

## Task 12: 最终验证

- [ ] **Step 1: 运行所有测试**

```bash
bun test
```
期望：全部通过

- [ ] **Step 2: 运行 typecheck**

```bash
bun run typecheck
```
期望：无错误

- [ ] **Step 3: 生成日报并检查**

```bash
bun run src/cli/run.ts -t 1h
```
检查 `reports/daily/YYYY-MM-DD.md` 中的：
- AI 快讯是否正常（hexi/juya/clawfeed）
- 分类是否正确
- enrich 是否生效

---

## 执行顺序

1. **Task 2** (Zod schema) → **Task 4** (enrich.ts EnrichOptions 接口变更) → **Task 3** (config loader 重写，依赖 Task 2 类型)
2. **Task 1** (config.yaml 创建，依赖 Task 3 完成后确认字段)
3. **Task 5-9** (各模块使用新配置)
4. **Task 10** (lib/types cleanup)
5. **Task 11** (删除旧 YAML)
6. **Task 12** (验证)

**注意：Task 1 放在最后是因为 config.yaml 的内容需要等 Task 3 确认 Schema 后才能最终确定。**
