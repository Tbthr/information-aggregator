# Content Enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 dedupe 之后引入 content enrichment 环节，对 article 类型 item 动态判断是否需要 fetch 全文，提升 AI 象限分类准确性。

**Architecture:** Enrich 阶段采用"原地替换"策略：先通过 `contentQuality()` 评估现有 `normalizedContent` 是否有效，无效且有 URL 时调用 `agent-fetch` 获取全文，失败则回退到原有 content。放在 dedupe 之后是为了最大化 API 调用效率（只处理存留下来的 article）。

**Tech Stack:** Bun/TypeScript, `@teng-lin/agent-fetch`, js-yaml 配置

---

## File Structure

```
src/pipeline/enrich.ts          # 新建：enrich 主逻辑
src/pipeline/enrich.test.ts     # 新建：enrich 单元测试
src/cli/run.ts                  # 修改：pipeline 中增加 enrich 步骤
src/reports/daily.ts            # 修改：classifyArticlesQuadrantBatch 改用 normalizedContent
config/reports.yaml             # 修改：新增 enrich 配置段
src/types/index.ts              # 无需变更，沿用现有 normalizedContent 字段
```

> **注意**：`src/pipeline/extract-content.ts` 被 `src/cache/content-cache.ts` 引用，暂不删除。

---

## Task 1: Create `src/pipeline/enrich.ts`

**Files:**
- Create: `src/pipeline/enrich.ts`

### Steps

- [ ] **Step 1: Create enrich.ts with contentQuality and enrichArticleItem**

```typescript
// src/pipeline/enrich.ts
import type { normalizedArticle } from '../types/index.js'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

export interface EnrichOptions {
  batchSize: number
  minContentLength: number
  fetchTimeout: number
}

/**
 * 评估 normalizedContent 质量
 * - 纯文本字符数 > minContentLength (默认 500)
 * - ≥ 3 个完整句子（. 或 ！ 或 ？ 结尾）
 * - 不含截断特征 ([...]、Read more、click here)
 */
export function contentQuality(text: string, minLength: number = 500): 'pass' | 'fail' {
  const stripped = text.replace(/<[^>]*>/g, '').trim()

  // 长度检查
  if (stripped.length < minLength) return 'fail'

  // 句子数检查（找句号、感叹号、问号结尾的完整句）
  const sentenceMatches = stripped.match(/[^.!?。！？]*[.!?。！？]/g) || []
  const sentences = sentenceMatches.filter(s => s.trim().length > 10)
  if (sentences.length < 3) return 'fail'

  // 截断特征检查
  const truncationPatterns = ['[...]', 'Read more', 'click here', 'read more at', '来源：', 'Original:']
  for (const pattern of truncationPatterns) {
    if (stripped.toLowerCase().includes(pattern.toLowerCase())) return 'fail'
  }

  return 'pass'
}

/**
 * 判断单条 article 是否需要 enrich
 */
export function needsEnrichment(
  normalizedContent: string,
  url: string,
  options: EnrichOptions
): { needed: boolean; reason: string } {
  const quality = contentQuality(normalizedContent, options.minContentLength)

  if (quality === 'pass') {
    return { needed: false, reason: 'content quality sufficient' }
  }

  if (!url || url.trim() === '') {
    return { needed: false, reason: 'no URL available' }
  }

  return { needed: true, reason: 'content quality insufficient' }
}

/**
 * 调用 agent-fetch 获取文章正文
 */
export async function fetchArticleContent(url: string, timeout: number = 20000): Promise<string | null> {
  const agentFetchBin = './node_modules/.bin/agent-fetch'

  if (!existsSync(agentFetchBin)) {
    console.error('agent-fetch not found at', agentFetchBin)
    return null
  }

  try {
    const result = execSync(`node ${agentFetchBin} "${url}" --json`, {
      timeout,
      encoding: 'utf-8',
    })

    const parsed = JSON.parse(result)
    // agent-fetch 返回 { content: "...", title: "...", ... }
    return parsed.content || parsed.textContent || parsed.text || null
  } catch (err) {
    console.error(`agent-fetch failed for ${url}:`, err)
    return null
  }
}

/**
 * 对单条 article 执行 enrich（原地替换 normalizedContent）
 */
export async function enrichArticleItem(
  item: normalizedArticle,
  options: EnrichOptions
): Promise<normalizedArticle> {
  const { needed } = needsEnrichment(item.normalizedContent, item.normalizedUrl, options)

  if (!needed) {
    return item
  }

  const fetched = await fetchArticleContent(item.normalizedUrl, options.fetchTimeout)

  if (fetched && fetched.length > 0) {
    return {
      ...item,
      normalizedContent: fetched,
    }
  }

  // Fallback: 保留原有 content，不阻断 pipeline
  return item
}

/**
 * 对 dedupe 后的 articles 列表批量执行 enrich
 */
export async function enrichArticles(
  articles: normalizedArticle[],
  options: Partial<EnrichOptions> = {}
): Promise<normalizedArticle[]> {
  const opts: EnrichOptions = {
    batchSize: options.batchSize ?? 10,
    minContentLength: options.minContentLength ?? 500,
    fetchTimeout: options.fetchTimeout ?? 20000,
  }

  const results: normalizedArticle[] = []

  // 分批处理
  for (let i = 0; i < articles.length; i += opts.batchSize) {
    const batch = articles.slice(i, i + opts.batchSize)
    const batchResults = await Promise.all(
      batch.map(item => enrichArticleItem(item, opts))
    )
    results.push(...batchResults)
  }

  return results
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `bun run typecheck`
Expected: No errors (enrich.ts should compile cleanly)

- [ ] **Step 3: Commit**

```bash
git add src/pipeline/enrich.ts
git commit -m "feat: add content enrich module with quality detection and agent-fetch integration"
```

---

## Task 2: Create `src/pipeline/enrich.test.ts`

**Files:**
- Create: `src/pipeline/enrich.test.ts`

### Steps

- [ ] **Step 1: Write failing tests**

```typescript
// src/pipeline/enrich.test.ts
import { describe, expect, test } from 'bun:test'
import { contentQuality, needsEnrichment } from './enrich'

describe('contentQuality', () => {
  test('pass: content > 500 chars with 3+ sentences', () => {
    const text = '这是一篇关于人工智能的文章。人工智能正在改变我们的生活。它已经应用于多个领域包括医疗和金融。'
    expect(contentQuality(text)).toBe('pass')
  })

  test('fail: content too short', () => {
    const text = '这是一篇短文。'
    expect(contentQuality(text)).toBe('fail')
  })

  test('fail: less than 3 sentences', () => {
    const text = '这是第一句。这是第二句。'
    expect(contentQuality(text)).toBe('fail')
  })

  test('fail: contains truncation marker [...]', () => {
    const text = '这是一篇关于AI的文章[...]。人工智能正在改变世界。它已经应用于多个领域。'
    expect(contentQuality(text)).toBe('fail')
  })

  test('fail: contains Read more', () => {
    const text = '这是一篇关于AI的文章。Read more about it here. 人工智能正在改变世界。'
    expect(contentQuality(text)).toBe('fail')
  })

  test('pass: HTML tags stripped, counts plain text', () => {
    const html = '<p>这是第一句话。</p><p>这是第二句话。</p><p>这是第三句话。</p>'
    expect(contentQuality(html)).toBe('pass')
  })
})

describe('needsEnrichment', () => {
  const defaultOptions = { batchSize: 10, minContentLength: 500, fetchTimeout: 20000 }

  test('false: quality sufficient', () => {
    const goodContent = '这是一篇关于人工智能的文章。人工智能正在改变我们的生活。它已经应用于多个领域包括医疗和金融。'
    const result = needsEnrichment(goodContent, 'https://example.com/article', defaultOptions)
    expect(result.needed).toBe(false)
  })

  test('true: quality insufficient, has URL', () => {
    const badContent = 'AI新闻'
    const result = needsEnrichment(badContent, 'https://example.com/article', defaultOptions)
    expect(result.needed).toBe(true)
  })

  test('false: quality insufficient, no URL', () => {
    const badContent = 'AI新闻'
    const result = needsEnrichment(badContent, '', defaultOptions)
    expect(result.needed).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test src/pipeline/enrich.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pipeline/enrich.ts src/pipeline/enrich.test.ts
git commit -m "feat: add content enrich tests"
```

---

## Task 3: Add enrich step to pipeline in `src/cli/run.ts`

**Files:**
- Modify: `src/cli/run.ts` (add enrich config loading + pipeline step + fix pre-existing bug)

### Steps

- [ ] **Step 1: Add enrich import**

Add after line 13:
```typescript
import { enrichArticles } from '../pipeline/enrich.js'
```

- [ ] **Step 2: Add enrich config loader (after loadTopicsConfig)**

Add after line 173 (after `loadTopicsConfig` function):
```typescript
interface YamlEnrichConfig {
  enabled?: boolean
  batchSize?: number
  minContentLength?: number
  fetchTimeout?: number
}

interface YamlReportsConfig {
  daily?: {
    enrich?: YamlEnrichConfig
  }
}

function loadEnrichConfig(): { enabled: boolean; batchSize: number; minContentLength: number; fetchTimeout: number } {
  const configPath = path.join(process.cwd(), 'config', 'reports.yaml')
  if (!fs.existsSync(configPath)) {
    return { enabled: true, batchSize: 10, minContentLength: 500, fetchTimeout: 20000 }
  }
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as YamlReportsConfig
  const enrich = raw.daily?.enrich ?? {}
  return {
    enabled: enrich.enabled ?? true,
    batchSize: enrich.batchSize ?? 10,
    minContentLength: enrich.minContentLength ?? 500,
    fetchTimeout: enrich.fetchTimeout ?? 20000,
  }
}
```

- [ ] **Step 3: Fix pre-existing normalize stage logging bug (line ~232)**

Find:
```typescript
  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'enrich',       // <-- bug: says 'enrich' but message says normalize
    msg: `标准化完成`,
  })
```

Replace with:
```typescript
  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'normalize',    // fixed: was incorrectly 'enrich'
    msg: `标准化完成`,
  })
```

- [ ] **Step 4: Add enrich step after dedupe, before generateDailyReport**

Find:
```typescript
  // 6. 全局去重
  const dedupedExact = dedupeExact(ranked)
  const deduped = dedupeNear(dedupedExact)

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'dedupe',
    msg: `去重完成`,
    data: { beforeDedup: ranked.length, afterDedup: deduped.length },
  })

  // 7. 生成日报
```

Replace with:
```typescript
  // 6. 全局去重
  const dedupedExact = dedupeExact(ranked)
  const deduped = dedupeNear(dedupedExact)

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'dedupe',
    msg: `去重完成`,
    data: { beforeDedup: ranked.length, afterDedup: deduped.length },
  })

  // 7. Content enrichment (仅对 article 类型且 quality 不足的 item fetch 正文)
  const enrichConfig = loadEnrichConfig()

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'enrich',
    msg: '开始内容充实',
  })

  const enriched = enrichConfig.enabled
    ? await enrichArticles(deduped as normalizedArticle[], enrichConfig)
    : deduped as normalizedArticle[]

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'enrich',
    msg: `内容充实完成`,
    data: { totalItems: enriched.length },
  })

  // 8. 生成日报
```

- [ ] **Step 5: Update generateDailyReport call to use enriched**

Find:
```typescript
  const result = await generateDailyReport(new Date(), aiClient, deduped as any)
```

Replace with:
```typescript
  const result = await generateDailyReport(new Date(), aiClient, enriched as any)
```

- [ ] **Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/cli/run.ts
git commit -m "feat: add enrich step to pipeline after dedupe"
```

---

## Task 4: Change AI classification to use `normalizedContent` in `src/reports/daily.ts`

**Files:**
- Modify: `src/reports/daily.ts:82-86` (classifyArticlesQuadrantBatch input)

### Steps

- [ ] **Step 1: Find and update the idAndContent mapping**

Find around line 82-86:
```typescript
  const idAndContent = articles.map((a, i) => ({
    id: a.id || `article-${i}`,
    title: a.title || a.normalizedTitle || '',
    summary: (a.normalizedSummary || '')?.slice(0, 300) ?? '',
  }))
```

Replace with:
```typescript
  const idAndContent = articles.map((a, i) => ({
    id: a.id || `article-${i}`,
    title: a.title || a.normalizedTitle || '',
    content: (a.normalizedContent || '')?.slice(0, 2000) ?? '', // 截断到 2000 字符防 token 膨胀
  }))
```

- [ ] **Step 2: Update prompt to reflect content field**

The prompt template itself in `getQuadrantPrompt()` mentions "内容" generically so no change needed there.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/reports/daily.ts
git commit -m "feat: use normalizedContent (up to 2000 chars) for AI quadrant classification"
```

---

## Task 5: Add enrich config to `config/reports.yaml`

**Files:**
- Modify: `config/reports.yaml`

### Steps

- [ ] **Step 1: Add enrich section at end of file**

Add after existing content:
```yaml
enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000  # agent-fetch 超时（毫秒）
```

- [ ] **Step 2: Commit**

```bash
git add config/reports.yaml
git commit -m "feat: add enrich configuration to reports.yaml"
```

---

## Task 6: Integration test with minimal data

**Files:**
- Test: Full pipeline with `--time-window 1h`

### Steps

- [ ] **Step 1: Run CLI with 1h window**

Run: `bun run src/cli/run.ts --time-window 1h`
Expected: JSON logs showing enrich stage running, daily report generated

- [ ] **Step 2: Verify output**

Check that `reports/daily/YYYY-MM-DD.md` exists and contains quadrant-classified articles

- [ ] **Step 3: Commit integration test result if needed**

Only commit if you fixed something; don't commit successful test output

---

## Summary

| Task | File | Change |
|------|------|--------|
| 1 | `src/pipeline/enrich.ts` | 新建：contentQuality + enrichArticleItem + enrichArticles |
| 2 | `src/pipeline/enrich.test.ts` | 新建：单元测试 |
| 3 | `src/cli/run.ts` | pipeline 增加 enrich 步骤 + 修复 normalize stage bug + 配置加载 |
| 4 | `src/reports/daily.ts` | classifyArticlesQuadrantBatch 改用 normalizedContent |
| 5 | `config/reports.yaml` | 新增 enrich 配置段 |
