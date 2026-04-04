# AI快讯日报模块重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构日报生成逻辑，移除象限分类，改为双模块结构：AI快讯（三个精选信息源自专用adapter）+ 文章列表（复用pipeline结果）

**Architecture:** 三层解耦——(1) `ai-flash-sources.yaml` 配置三个专用adapter；(2) `ai-flash.ts` 封装hexi/juya/clawfeed三个专用adapter，统一接口；(3) `daily.ts` 重写为 `generateDailyReport(now, aiClient, articles, aiFlashSources)`，输出 AI快讯 + 文章列表双模块

**Tech Stack:** Bun (TypeScript), jina.ai (HTML→Markdown), RSS parsing, JSON feed

---

## File Change Overview

| Op | File |
|----|------|
| DELETE | `src/reports/filter-quadrant.ts` |
| DELETE | `src/ai/prompts-reports.ts` 中的 `parseQuadrantResult` |
| CREATE | `config/ai-flash-sources.yaml` |
| CREATE | `src/reports/ai-flash.ts` |
| REWRITE | `src/reports/daily.ts` |
| MODIFY | `config/reports.yaml`（删除 `quadrantPrompt`） |
| MODIFY | `src/config/index.ts`（扩展 Config 类型，添加 `loadAiFlashSources`） |
| MODIFY | `src/cli/run.ts`（集成 AI快讯获取） |
| MODIFY | `config/sources.yaml`（将三个原 AI快讯 source 设为 `enabled: false`） |
| MODIFY | `README.md`（更新功能特性、架构、数据流） |
| MODIFY | `AGENTS.md`（更新 Pipeline Flow、Daily Report Structure、目录结构） |

---

## Task 1: Create `config/ai-flash-sources.yaml`

**Files:**
- Create: `config/ai-flash-sources.yaml`

- [ ] **Step 1: Write the config file**

```yaml
# AI快讯数据源配置
# 三个来源均为 dedicated adapter，不走 pipeline 的 adapter 机制

sources:
  - id: hexi-daily
    adapter: hexi-daily
    enabled: true

  - id: juya-daily
    adapter: juya-daily
    enabled: true

  - id: clawfeed-daily
    adapter: clawfeed-daily
    enabled: true
```

- [ ] **Step 2: Commit**

```bash
git add config/ai-flash-sources.yaml
git commit -m "feat: add ai-flash-sources.yaml config"
```

---

## Task 2: Create `src/reports/ai-flash.ts` — Dedicated Adapters

**Files:**
- Create: `src/reports/ai-flash.ts`
- Test: `src/reports/ai-flash.test.ts` (skip — spec says manual verification)

**Source names:**
- hexi-daily → "何夕2077 AI资讯"
- juya-daily → "橘鸦AI早报"
- clawfeed-daily → "ClawFeed"

### 2.1: Define types and interface

```typescript
export interface AiFlashSource {
  id: string
  adapter: 'hexi-daily' | 'juya-daily' | 'clawfeed-daily'
  enabled: boolean
}

export interface AiFlashContent {
  sourceId: string
  sourceName: string
  publishedAt: string  // UTC ISO 8601
  content: string      // cleaned Markdown
}

export async function fetchAiFlashSources(
  sources: AiFlashSource[],
  options: { fetchImpl?: typeof fetch }
): Promise<AiFlashContent[]>
```

### 2.2: Implement `fetchAiFlashSources` (fail-silent)

```typescript
export async function fetchAiFlashSources(
  sources: AiFlashSource[],
  options: { fetchImpl?: typeof fetch } = {}
): Promise<AiFlashContent[]> {
  const fetcher = options.fetchImpl ?? fetch
  const results: AiFlashContent[] = []

  await Promise.allSettled(
    sources.filter(s => s.enabled).map(async (source) => {
      try {
        let content: AiFlashContent | null = null
        if (source.adapter === 'hexi-daily') {
          content = await fetchHexiDaily(source, fetcher)
        } else if (source.adapter === 'juya-daily') {
          content = await fetchJuyaDaily(source, fetcher)
        } else if (source.adapter === 'clawfeed-daily') {
          content = await fetchClawfeedDaily(source, fetcher)
        }
        if (content) results.push(content)
      } catch {
        // fail-silent: skip single source failure
      }
    })
  )

  return results
}
```

### 2.3: Implement `fetchHexiDaily`

**URL pattern:** `https://ai.hubtoday.app/{YYYY-MM}/{YYYY-MM-DD}/`

**Fetching:** `GET https://r.jina.ai/https://ai.hubtoday.app/{date}/`

**Cleaning:**
1. Skip first ~700 lines (sidebar/toc from jina.ai)
2. Find first `# AI资讯日报` heading, start from next line
3. Stop at `© 2026 何夕2077` or EOF
4. Filter lines containing `ucloud` or `6.9元购` (advertisement)
5. Keep `![alt](url)` image links as-is

```typescript
async function fetchHexiDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`
  const monthStr = `${yyyy}-${mm}`

  const url = `https://r.jina.ai/https://ai.hubtoday.app/${monthStr}/${dateStr}/`
  const resp = await fetcher(url)
  if (!resp.ok) return null
  const text = await resp.text()

  // Find start: first "# AI资讯日报" heading
  const lines = text.split('\n')
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^#\s+AI资讯日报/)) {
      startIdx = i + 1
      break
    }
  }
  if (startIdx < 0) startIdx = 0

  // Find end: "© 2026 何夕2077"
  let endIdx = lines.length
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes('© 2026 何夕2077')) {
      endIdx = i
      break
    }
  }

  // Filter ad lines and rejoin
  const contentLines = lines.slice(startIdx, endIdx).filter(line => {
    if (line.includes('ucloud')) return false
    if (line.includes('6.9元购')) return false
    return true
  })

  return {
    sourceId: source.id,
    sourceName: '何夕2077 AI资讯',
    publishedAt: new Date().toISOString(),
    content: contentLines.join('\n').trim(),
  }
}
```

### 2.4: Implement `fetchJuyaDaily`

**RSS URL:** `https://imjuya.github.io/juya-ai-daily/rss.xml`

**Today's filter:** Parse `pubDate`, compare date string (北京时间) with today

**Cleaning rules:**
- Parse `content:encoded` field
- Strip HTML tags, keep `<a>` as `文本(url)`, `<strong>` as `**文本**`
- `<br>` and block tags → newline

```typescript
async function fetchJuyaDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const resp = await fetcher('https://imjuya.github.io/juya-ai-daily/rss.xml')
  if (!resp.ok) return null
  const xml = await resp.text()

  // Parse RSS items from XML (simple regex-based for bun compat)
  // Extract items where pubDate matches today (Beijing)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/
  const contentRegex = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/

  const todayStr = formatBeijingDate(new Date())
  const items: { pubDate: string; content: string }[] = []
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const pubDateMatch = pubDateRegex.exec(itemXml)
    const contentMatch = contentRegex.exec(itemXml)
    if (pubDateMatch && contentMatch) {
      items.push({ pubDate: pubDateMatch[1], content: contentMatch[1] })
    }
  }

  // Filter today's items
  const todayItems = items.filter(item => {
    const itemDate = parseBeijingDate(item.pubDate)
    return formatBeijingDate(itemDate) === todayStr
  })

  if (todayItems.length === 0) return null

  // Clean HTML: strip tags, keep links and bold
  const cleanedContent = todayItems.map(item => cleanHtmlContent(item.content)).join('\n\n')

  return {
    sourceId: source.id,
    sourceName: '橘鸦AI早报',
    publishedAt: new Date().toISOString(),
    content: cleanedContent,
  }
}

function cleanHtmlContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2($1)')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function parseBeijingDate(pubDateStr: string): Date {
  // pubDate format: "Mon, 05 Apr 2026 12:00:00 GMT"
  const date = new Date(pubDateStr)
  // Convert to Beijing time by adding 8 hours
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
}

function formatBeijingDate(date: Date): string {
  const d = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
```

### 2.5: Implement `fetchClawfeedDaily`

**API URL:** `https://clawfeed.kevinhe.io/feed/kevin`

**Today's filter:** Parse `created_at`, compare to Beijing today

**Cleaning:** Already Markdown, minimal processing — filter empty-line spam

```typescript
async function fetchClawfeedDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const resp = await fetcher('https://clawfeed.kevinhe.io/feed/kevin')
  if (!resp.ok) return null
  const data = await resp.json() as Array<{ created_at: string; content: string }>

  const todayStr = formatBeijingDate(new Date())
  const todayItems = data.filter(item => {
    const itemDate = new Date(item.created_at)
    return formatBeijingDate(itemDate) === todayStr
  })

  if (todayItems.length === 0) return null

  // Already Markdown, filter excessive blank lines
  const content = todayItems
    .map(item => item.content)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    sourceId: source.id,
    sourceName: 'ClawFeed',
    publishedAt: new Date().toISOString(),
    content,
  }
}
```

- [ ] **Step 2: Create the file with all implementations above**
- [ ] **Step 3: Commit**

```bash
git add src/reports/ai-flash.ts
git commit -m "feat: add dedicated AI flash adapters (hexi, juya, clawfeed)"
```

---

## Task 3: Rewrite `src/reports/daily.ts`

**Files:**
- Modify: `src/reports/daily.ts` (complete rewrite)

### 3.1: Write new types and interfaces

```typescript
import fs from 'fs'
import path from 'path'
import type { AiClient } from '../ai/types.js'
import { formatUtcDate, formatUtcDayLabel } from '../../lib/date-utils.js'
import type { normalizedArticle } from '../types/index.js'
import type { AiFlashSource, AiFlashContent } from './ai-flash.js'

export interface DailyGenerateResult {
  date: string
  articleCount: number
  errorSteps: string[]
}

interface ArticleForReport {
  title: string
  url: string
  sourceName: string
}

export interface DailyReportData {
  date: string
  dateLabel: string
  aiFlash: AiFlashContent[]
  articles: ArticleForReport[]
}
```

### 3.2: Write `generateDailyMarkdown`

```typescript
export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []

  lines.push(`# ${report.dateLabel}`)
  lines.push('')

  lines.push('## AI快讯')
  lines.push('')
  for (const flash of report.aiFlash) {
    lines.push(`### ${flash.sourceName}`)
    lines.push('')
    lines.push(flash.content)
    lines.push('')
  }

  lines.push('## 文章列表')
  lines.push('')
  for (const article of report.articles) {
    lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
  }

  return lines.join('\n')
}
```

### 3.3: Write `generateDailyReport`

```typescript
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],
  aiFlashSources: AiFlashSource[]
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Fetch AI flash sources (fail-silent, imported from ai-flash.ts)
  const { fetchAiFlashSources } = await import('./ai-flash.js')
  const aiFlash = await fetchAiFlashSources(aiFlashSources, {})

  // Map articles for report
  const reportArticles: ArticleForReport[] = articles.map(a => ({
    title: a.title || a.normalizedTitle || '',
    url: a.normalizedUrl || '',
    sourceName: a.sourceName || a.sourceId || '',
  }))

  const reportData: DailyReportData = {
    date: dateStr,
    dateLabel: `${dayLabel} 日报`,
    aiFlash,
    articles: reportArticles,
  }

  const markdown = generateDailyMarkdown(reportData)
  const outputDir = path.join(process.cwd(), 'reports', 'daily')
  const outputPath = path.join(outputDir, `${dateStr}.md`)

  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(outputPath, markdown, 'utf-8')
  } catch {
    errorSteps.push('writeOutput')
  }

  return { date: dateStr, articleCount: reportArticles.length, errorSteps }
}
```

- [ ] **Step 1: Write the complete new daily.ts**
- [ ] **Step 2: Commit**

```bash
git add src/reports/daily.ts
git commit -m "refactor: rewrite daily report as dual-module (AI flash + article list)"
```

---

## Task 4: Modify `src/ai/prompts-reports.ts` — Remove `parseQuadrantResult`

**Files:**
- Modify: `src/ai/prompts-reports.ts`

```typescript
// REMOVE the entire parseQuadrantResult function and its comment block
```

- [ ] **Step 1: Remove parseQuadrantResult**
- [ ] **Step 2: Commit**

```bash
git add src/ai/prompts-reports.ts
git commit -m "refactor: remove parseQuadrantResult (unused after quadrant removal)"
```

---

## Task 5: Modify `config/reports.yaml` — Remove `quadrantPrompt`

**Files:**
- Modify: `config/reports.yaml`

```yaml
daily:
enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000
```

- [ ] **Step 1: Remove `quadrantPrompt` from daily section**
- [ ] **Step 2: Commit**

```bash
git add config/reports.yaml
git commit -m "refactor: remove quadrantPrompt from reports.yaml"
```

---

## Task 6: Modify `src/config/index.ts` — Add `loadAiFlashSources`

**Files:**
- Modify: `src/config/index.ts`

### 6.1: Add AiFlashSource type import (inline, not from ai-flash.ts to avoid circular dep)

```typescript
// Add near top of file, after existing imports
export interface AiFlashSource {
  id: string
  adapter: string
  enabled: boolean
}
```

### 6.2: Add AppConfig field

```typescript
export interface AppConfig {
  sources: Source[]
  tags: Tag[]
  enrichOptions: EnrichOptions
  dailyConfig: DailyConfig
  aiFlashSources: AiFlashSource[]  // NEW
}
```

### 6.3: Add `loadAiFlashSources` function

```typescript
function loadAiFlashSources(): AiFlashSource[] {
  const configPath = path.join(process.cwd(), 'config', 'ai-flash-sources.yaml')
  if (!fs.existsSync(configPath)) {
    return []
  }
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as { sources: Array<{
    id: string
    adapter: string
    enabled?: boolean
  }> }

  return raw.sources.map(s => ({
    id: s.id,
    adapter: s.adapter,
    enabled: s.enabled ?? true,
  }))
}
```

### 6.4: Update `loadConfig` to include aiFlashSources

```typescript
export function loadConfig(): AppConfig {
  const sources = loadSources()
  const tags = loadTags()
  const { enrichOptions, dailyConfig } = loadReportsConfig()
  const aiFlashSources = loadAiFlashSources()  // NEW

  return { sources, tags, enrichOptions, dailyConfig, aiFlashSources }
}
```

- [ ] **Step 1: Apply all changes to src/config/index.ts**
- [ ] **Step 2: Commit**

```bash
git add src/config/index.ts
git commit -m "feat: add loadAiFlashSources() and aiFlashSources to Config"
```

---

## Task 7: Modify `src/cli/run.ts` — Integrate AI快讯获取

**Files:**
- Modify: `src/cli/run.ts:112` (loadConfig call)
- Modify: `src/cli/run.ts:229` (generateDailyReport call)

### 7.1: Update loadConfig destructuring

```typescript
// Before
const { sources, tags, enrichOptions, dailyConfig } = loadConfig()

// After
const { sources, tags, enrichOptions, dailyConfig, aiFlashSources } = loadConfig()
```

### 7.2: Update generateDailyReport call

```typescript
// Before
const result = await generateDailyReport(new Date(), aiClient, enriched as any, dailyConfig.quadrantPrompt)

// After
const result = await generateDailyReport(new Date(), aiClient, enriched as any, aiFlashSources)
```

### 7.3: Update LogEntry stage type

Remove `'quadrant'` from the union since it's no longer used.

```typescript
// Before
stage: 'collect' | 'enrich' | 'filter' | 'dedupe' | 'score' | 'normalize' | 'quadrant' | 'topic' | 'output'

// After
stage: 'collect' | 'enrich' | 'filter' | 'dedupe' | 'score' | 'normalize' | 'output'
```

- [ ] **Step 1: Apply all changes to src/cli/run.ts**
- [ ] **Step 2: Commit**

```bash
git add src/cli/run.ts
git commit -m "feat: integrate AI flash sources into CLI pipeline"
```

---

## Task 8: Modify `config/sources.yaml` — Disable old AI快讯 sources

**Files:**
- Modify: `config/sources.yaml`

Find and disable these three sources (set `enabled: false` or comment out):
- `ai-hubtoday-blog`
- `juya-ai-daily`
- `clawfeed-kevinhe-io-feed-kevin`

- [ ] **Step 1: Set enabled: false for the three old sources**
- [ ] **Step 2: Commit**

```bash
git add config/sources.yaml
git commit -m "chore: disable old AI flash sources (replaced by dedicated adapters)"
```

---

## Task 9: Delete `src/reports/filter-quadrant.ts`

**Files:**
- Delete: `src/reports/filter-quadrant.ts`

- [ ] **Step 1: Delete the file**

```bash
git rm src/reports/filter-quadrant.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: remove filter-quadrant.ts (quadrant classification removed)"
```

---

## Task 10: Verify — TypeScript Check + Dry Run

**Files:**
- Test: `bun run typecheck`
- Test: `bun test`

```bash
# Run typecheck
bun run typecheck

# Expected: no errors (all removed/changed types resolved)

# Run tests
bun test

# Expected: all tests pass

# Optional: dry run with 1h window
# bun run src/cli/run.ts -t 1h
# Check reports/daily/YYYY-MM-DD.md has AI快讯 + 文章列表 sections
```

- [ ] **Step 1: Run typecheck**
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit any fixes**

---

## Task 11: Update README.md and AGENTS.md

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

### 11.1: Update README.md — 功能特性 section

```markdown
## 功能特性

- **AI 快讯** - 三个精选信息源（何夕2077、橘鸦AI早报、ClawFeed）当日完整内容
- **文章列表** - 复用 pipeline 结果，按评分排序
- **历史去重** - 基于 URL 和内容的精确去重
- **GitHub Pages 部署** - 静态网站，自动更新
```

### 11.2: Update README.md — 配置 section

```markdown
| 文件 | 说明 |
|------|------|
| `config/sources.yaml` | 数据源配置（RSS、JSON Feed、X/Twitter） |
| `config/tags.yaml` | Tag 配置（include/exclude 规则、scoreBoost） |
| `config/reports.yaml` | 日报参数（enrich 配置） |
| `config/ai-flash-sources.yaml` | AI快讯数据源配置（hexi/juya/clawfeed） |
```

### 11.3: Update README.md — 架构 section

```markdown
## 架构

```
数据源 → 并发收集 → 标准化 → Tag 过滤 → 评分排序 → 去重 → 内容充实 → 日报生成
                                                    ↓
                              AI快讯（hexi/juya/clawfeed）→ AI快讯模块
```
```

### 11.4: Update README.md — 数据流 section (remove quadrant/topic references)

```markdown
### 数据流

1. **收集 (collect)** - 并发收集（adapter × source 两级并发）
2. **标准化 (normalize)** - 格式转换 + engagementScore 计算
3. **Tag 过滤** - include/exclude 规则初筛
4. **评分排序 (rank)** - sourceWeightScore×0.4 + engagementScore×0.15
5. **去重 (dedupe)** - URL 精确去重 + 语义 LCS 去重
6. **内容充实 (enrich)** - 提取正文、AI摘要和关键点
7. **日报生成 (output)** - 生成 Markdown 日报（AI快讯 + 文章列表）
```

### 11.5: Update AGENTS.md — Pipeline Flow section

```markdown
### Pipeline Flow

```
1. 收集 (collect)     → 并发收集（adapter × source 两级）
2. 标准化 (normalize) → 格式转换 + engagementScore 计算
3. tag 过滤          → include/exclude 初筛
4. 评分 (rank)        → sourceWeightScore×0.4 + engagementScore×0.15
5. 去重 (dedupe)      → URL 精确 + 语义 LCS
6. 内容充实 (enrich)  → 提取正文 + AI 摘要/关键点
7. 输出 (output)      → 生成 Markdown（AI快讯 + 文章列表）
```
```

### 11.6: Update AGENTS.md — Daily Report Structure section

```markdown
### Daily Report Structure

```markdown
# 4月1日 日报

## AI快讯

### 何夕2077 AI资讯

[当日 Markdown 内容]

### 橘鸦AI早报

[当日 HTML 清理后的内容]

### ClawFeed

[当日内容]

## 文章列表

- [文章标题](url) (来源)
- ...
```
```

### 11.7: Update AGENTS.md — config/reports.yaml section

Remove quadrantPrompts reference:

```markdown
### config/reports.yaml

```yaml
enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000
```
```

### 11.8: Update AGENTS.md — Directory Structure

Add `ai-flash-sources.yaml` to config/ listing, and `ai-flash.ts` to reports/ listing:

```markdown
├── config/
│   ├── sources.yaml        # 数据源配置
│   ├── tags.yaml           # Tag 配置
│   ├── reports.yaml         # 报表配置（日报参数、prompts）
│   └── ai-flash-sources.yaml # AI快讯数据源配置
...
│   ├── reports/           # 日报生成
│   │   ├── daily.ts       # 日报逻辑
│   │   └── ai-flash.ts    # AI快讯专用 adapters
```

- [ ] **Step 1: Update README.md** (功能特性, 配置, 架构, 数据流)
- [ ] **Step 2: Update AGENTS.md** (Pipeline Flow, Daily Report Structure, config/reports.yaml, Directory Structure)
- [ ] **Step 3: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: update for dual-module daily report (AI flash + article list)"
```

---

## Task 12: E2E Full Run — 1h Window, Output to File

**Files:**
- Test: `bun run src/cli/run.ts -t 1h`
- Verify: `reports/daily/YYYY-MM-DD.md`

### 12.1: Run with .env.local and stdout/stderr to file

```bash
bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts -t 1h' > reports/e2e-run.log 2>&1
```

### 12.2: Verify output format

检查生成的 `reports/daily/YYYY-MM-DD.md` 包含：

```
# X月X日 日报

## AI快讯

### 何夕2077 AI资讯
[内容]

### 橘鸦AI早报
[内容]

### ClawFeed
[内容]

## 文章列表

- [标题](url) (来源)
```

### 12.3: Grep log for key stages

```bash
grep '"stage":"collect"' reports/e2e-run.log | head -5
grep '"stage":"output"' reports/e2e-run.log
grep '"stage":"enrich"' reports/e2e-run.log
grep '"level":"error"' reports/e2e-run.log
```

Expected: no errors. All stages complete.

- [ ] **Step 1: Run E2E with logging**
- [ ] **Step 2: Verify report has AI快讯 + 文章列表 sections**
- [ ] **Step 3: Grep log for errors**
- [ ] **Step 4: Commit any fixes**

---

## Execution Order

1. Task 1 — `ai-flash-sources.yaml`
2. Task 2 — `ai-flash.ts` (adapters)
3. Task 3 — `daily.ts` (rewrite)
4. Task 4 — `prompts-reports.ts` (remove parseQuadrantResult)
5. Task 5 — `reports.yaml` (remove quadrantPrompt)
6. Task 6 — `config/index.ts` (add loadAiFlashSources)
7. Task 7 — `run.ts` (CLI integration)
8. Task 8 — `sources.yaml` (disable old sources)
9. Task 9 — Delete `filter-quadrant.ts`
10. Task 10 — TypeScript + tests verification
11. Task 11 — README.md + AGENTS.md update
12. Task 12 — E2E full run (1h window, output to file)

---

## Key Design Decisions

1. **Fail-silent AI flash fetching**: If any single source fails (network, parse error), it's skipped silently. Other sources still appear in the report.
2. **Beijing time for daily filtering**: hexi/juya/clawfeed all filter by Beijing date (`formatBeijingDate`), not UTC, matching the report's "today" definition.
3. **No new dependencies**: All parsing uses built-in APIs (Date, RegExp, String). No external RSS parser library.
4. **Circular dep avoided**: `src/config/index.ts` defines `AiFlashSource` inline rather than importing from `ai-flash.ts`, which is loaded dynamically inside `generateDailyReport`.
5. **`timeWindow` ignored**: The three dedicated adapters have no timeWindow concept — they always fetch "today's" content.
