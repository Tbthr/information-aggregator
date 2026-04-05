# AI快讯模块重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复何夕2077 提取边界、橘鸦去重，并将日报结构重组为 AI快讯（分类）→ 推特精选 → 文章列表

**Architecture:**
- `src/reports/ai-flash.ts` 修复提取逻辑，新增 `parseHexiMarkdownToItems` 和 `categorizeAiFlash`
- `src/reports/daily.ts` 重新设计 `DailyReportData` 接口，重写 `generateDailyMarkdown`
- `src/config/index.ts` 扩展 `DailyConfig` 以支持 AI 分类配置
- `config/reports.yaml` 新增 `ai-flash-categorization` 配置节
- `config/sources.yaml` 移除 3 个 redundant pipeline sources

**Tech Stack:** Bun/TypeScript, js-yaml, AI client (Anthropic)

---

## 变更总览

| 文件 | 变更类型 |
|---|---|
| `config/sources.yaml` | 删除 3 个 pipeline source |
| `config/reports.yaml` | 新增 `ai-flash-categorization` 配置节 |
| `src/config/index.ts` | 扩展 `DailyConfig` 接口 + `loadReportsConfig()` |
| `src/reports/ai-flash.ts` | 修复提取 + 新增类型 + 新增 `categorizeAiFlash` |
| `src/reports/daily.ts` | 重新设计接口 + 重写 `generateDailyMarkdown` |

---

## Task 1: 配置文件更新

**Files:**
- Modify: `config/sources.yaml`（删除 3 个 source）
- Modify: `config/reports.yaml`（新增 ai-flash-categorization 配置）

### 1a: 移除 redundant pipeline sources

从 `config/sources.yaml` 中删除以下 3 个 source：
- `clawfeed-kevinhe-io-feed-kevin`（与 dedicated clawfeed 完全重复）
- `ai-hubtoday-blog`（dedicated 已覆盖，pipeline enabled=false）
- `juya-ai-daily`（dedicated 已覆盖，pipeline enabled=false）

**验证：** `grep -E 'clawfeed|ai-hubtoday|juya-ai-daily' config/sources.yaml` 应无输出

### 1b: 新增 AI 分类配置

在 `config/reports.yaml` 末尾新增：

```yaml
ai-flash-categorization:
  enabled: true
  maxCategories: 6
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
```

**验证：** `bun run typecheck` 应无报错

---

## Task 2: Config 类型扩展

**Files:**
- Modify: `src/config/index.ts`

### 2a: 扩展 DailyConfig 接口

在 `src/config/index.ts` 中，找到 `DailyConfig` 接口（当前只有 `quadrantPrompt`），改为：

```typescript
export interface DailyConfig {
  quadrantPrompt: string
  aiFlashCategorization: {
    enabled: boolean
    maxCategories: number
    prompt: string
  }
}
```

### 2b: 扩展 loadReportsConfig()

修改 `loadReportsConfig()` 函数，新增解析 `ai-flash-categorization` 配置节：

```typescript
const dailyConfig: DailyConfig = {
  quadrantPrompt: raw.daily?.quadrantPrompt ?? '',
  aiFlashCategorization: {
    enabled: raw.aiFlashCategorization?.enabled ?? true,
    maxCategories: raw.aiFlashCategorization?.maxCategories ?? 6,
    prompt: raw.aiFlashCategorization?.prompt ?? '',
  },
}
```

**验证：** `bun run typecheck` 应无报错

---

## Task 3: ai-flash.ts — fetchHexiDaily 修复

**Files:**
- Modify: `src/reports/ai-flash.ts`

### 3a: 确认 beijingDayRange import

在 `src/reports/ai-flash.ts` 顶部确认以下 import 存在：
```typescript
import { beijingDayRange } from '../../lib/date-utils.js'
```
如果不存在，添加它。

### 3b: 修复日期计算

找到 `fetchHexiDaily` 函数（`ai-flash.ts:18-27`），替换日期计算逻辑：

**原代码（行 19-27）：**
```typescript
const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
const yyyy = now.getUTCFullYear()
const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
const dd = String(now.getUTCDate()).padStart(2, '0')
```

**改为：**
```typescript
const todayStr = new Date().toISOString().split('T')[0]
const { start } = beijingDayRange(todayStr)
const yyyy = start.getUTCFullYear()
const mm = String(start.getUTCMonth() + 1).padStart(2, '0')
const dd = String(start.getUTCDate()).padStart(2, '0')
```

### 3c: 修复边界提取

替换 `fetchHexiDaily` 中的边界提取逻辑（行 37-55）：

**改为：**
```typescript
const lines = text.split('\n')
let startIdx = -1
let endIdx = lines.length

for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^## \*\*今日摘要\*\*$/)) {
    startIdx = i + 1
  }
  if (lines[i].match(/^## \*\*AI资讯日报多渠道\*\*$/)) {
    endIdx = i
    break
  }
}

if (startIdx < 0) return null

const contentLines = lines.slice(startIdx, endIdx).filter(line => {
  return !AD_KEYWORDS.some(keyword => line.includes(keyword))
})
```

**验证：**
```bash
curl -s "https://r.jina.ai/https://ai.hubtoday.app/2026-04/2026-04-05/" | grep -n "今日摘要\|AI资讯日报多渠道"
```
应找到双 `#` 的标题行（`## **今日摘要**`）

---

## Task 4: ai-flash.ts — fetchJuyaDaily 返回类型重构

**Files:**
- Modify: `src/reports/ai-flash.ts`

### 4a: extractJuyaItem 实现

在 `fetchJuyaDaily` 上方添加：

```typescript
function extractJuyaItem(itemHtml: string): { title: string; url: string; summary: string; links: string[] } | null {
  const h2Match = /<h2><a href="([^"]+)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/.exec(itemHtml)
  if (!h2Match) return null
  const mainUrl = h2Match[1]
  const title = h2Match[2].trim()

  const bqMatch = /<blockquote><p>([\s\S]*?)<\/p><\/blockquote>/.exec(itemHtml)
  const summary = bqMatch
    ? bqMatch[1].replace(/<[^>]+>/g, '').trim()
    : (itemHtml.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()

  const linkMatches = [...itemHtml.matchAll(/<li><a href="([^"]+)">(.*?)<\/a><\/li>/g)]
  const links = linkMatches.map(m => m[1]).filter(u => u !== mainUrl)

  return { title, url: mainUrl, summary, links }
}
```

### 4b: 重构 fetchJuyaDaily 返回类型

将 `fetchJuyaDaily` 的返回类型从 `Promise<AiFlashContent | null>` 改为 `Promise<{ title: string; url: string; summary: string; sourceName: string }[]>`。

在函数内部，将 `cleanedContent` 组装逻辑替换为：

```typescript
const items = []
for (const item of todayItems) {
  const parsed = extractJuyaItem(item.content)
  if (parsed) {
    items.push({
      title: parsed.title,
      url: parsed.url,
      summary: parsed.summary,
      sourceName: '橘鸦AI早报',
    })
  }
}
if (items.length === 0) return []
return items
```

同时将函数返回值的组装改为返回上述 `items` 数组（不再组装为 `AiFlashContent` 格式）。

> 注：`AiFlashItem` 类型在 Task 5 中定义。先用同名字面量结构替代，Task 5 再 import 正式类型。

**验证：** `bun run typecheck` 应无报错

---

## Task 5: ai-flash.ts — 类型定义 + categorizeAiFlash

**Files:**
- Modify: `src/reports/ai-flash.ts`

### 5a: 新增类型定义（放在文件顶部，与现有 AiFlashContent 相邻）

```typescript
export interface AiFlashItem {
  title: string
  url: string
  summary: string
  sourceName: string
}

export type AiFlashCategoryName = '产品更新' | '前沿研究' | '行业动态' | '开源项目' | '社媒精选' | '其他'

export interface AiFlashCategory {
  name: AiFlashCategoryName
  items: AiFlashItem[]
}
```

### 5b: parseHexiMarkdownToItems 函数

将何夕 Markdown 内容解析为 `AiFlashItem[]`（放在 `fetchHexiDaily` 附近）：

```typescript
function parseHexiMarkdownToItems(content: string): AiFlashItem[] {
  const lines = content.split('\n')
  const items: AiFlashItem[] = []
  let currentCategory = ''

  for (const line of lines) {
    // 检测分类标题，如 "### 产品与功能更新"
    const categoryMatch = line.match(/^###\s+(.+)/)
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim()
      continue
    }

    // 检测条目：如 "1.   **Gemini深度嵌入安卓底层.**"
    const itemMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*[\s:.。](.+)/)
    if (itemMatch && currentCategory) {
      const title = itemMatch[1].trim()
      const summary = itemMatch[2]?.trim() ?? ''
      const urlMatch = title.match(/\[([^\]]+)\]\(([^)]+)\)/)
      items.push({
        title: urlMatch ? urlMatch[1] : title,
        url: urlMatch ? urlMatch[2] : '',
        summary: summary.slice(0, 200),
        sourceName: '何夕2077',
      })
    }
  }

  return items
}
```

### 5c: categorizeAiFlash 函数

在 `fetchAiFlashSources` 函数上方添加：

```typescript
export async function categorizeAiFlash(
  items: AiFlashItem[],
  aiClient: AiClient,
  options?: { maxCategories?: number }
): Promise<AiFlashCategory[]> {
  if (items.length === 0) return []

  const { maxCategories = 6 } = options ?? {}

  const systemPrompt = `你是一个内容分类助手。将输入的 AI 快讯条目分类到以下六个类别之一：产品更新 / 前沿研究 / 行业动态 / 开源项目 / 社媒精选 / 其他。不要改写任何内容，只输出 JSON。`

  const userPrompt = `请将以下条目分类，输出 JSON 格式：{ "categories": [{ "name": "分类名", "items": [{ "title": "...", "url": "...", "summary": "...", "sourceName": "..." }] }, ...] }。每个条目必须归属一个类别。

条目：
${items.map((item, i) => `${i + 1}. [${item.title}](${item.url}) — ${item.summary}（来源：${item.sourceName}）`).join('\n')}

输出（只输出 JSON，不要其他内容）：`

  try {
    const response = await aiClient.complete({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4096,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallbackCategorize(items)

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.categories ?? fallbackCategorize(items)
  } catch {
    return fallbackCategorize(items)
  }
}

function fallbackCategorize(items: AiFlashItem[]): AiFlashCategory[] {
  return [{ name: '其他', items }]
}
```

> 注：`aiClient.complete()` 的调用方式参考 `src/ai/client.ts`，如有差异按实际接口调整。

**验证：** `bun run typecheck` 应无报错

---

## Task 6: daily.ts — generateDailyReport 重构

**Files:**
- Modify: `src/reports/daily.ts`

### 6a: 更新 DailyReportData 接口

替换 `DailyReportData` 接口：

```typescript
export interface DailyReportData {
  date: string
  dateLabel: string
  mergedAiFlash: AiFlashCategory[]   // 分类后的 AI快讯（来自 hexi + juya）
  clawfeed: AiFlashContent | null  // ClawFeed 独立（保持原格式，不分类）
  articles: ArticleForReport[]
}
```

### 6b: 重写 generateDailyReport 数据处理逻辑

修改 `generateDailyReport` 函数中 `fetchAiFlashSources` 调用后的处理逻辑。

**关键设计**：由于 `fetchHexiDaily` 和 `fetchJuyaDaily` 在 Task 4/5 中已重构为返回 `AiFlashItem[]`，`fetchAiFlashSources` 的返回类型变为 `(AiFlashItem[] | AiFlashContent)[]`。在 `generateDailyReport` 中分离处理：

```typescript
const rawFlashSources = await fetchAiFlashSources(aiFlashSources, {})

// 分离 ClawFeed（保持 AiFlashContent）和 hexi+juya（已是 AiFlashItem[][]）
const clawfeedContent = (rawFlashSources.find(
  (f): f is AiFlashContent => f.sourceId === 'clawfeed-daily'
) ?? null) as AiFlashContent | null

// 收集所有 AiFlashItem[]（hexi 和 juya）
const allItems: AiFlashItem[] = []
for (const flash of rawFlashSources) {
  if (flash.sourceId !== 'clawfeed-daily') {
    allItems.push(...(flash as unknown as AiFlashItem[]))
  }
}

// AI 分类
const categorizedFlash = await categorizeAiFlash(
  allItems,
  aiClient,
  { maxCategories: dailyConfig.aiFlashCategorization.maxCategories }
)

const reportData: DailyReportData = {
  date: dateStr,
  dateLabel: `${dayLabel} 日报`,
  mergedAiFlash: categorizedFlash,
  clawfeed: clawfeedContent,
  articles: reportArticles,
}
```

> 注：如果类型断言造成 `tsc` 报错，改为在 `fetchAiFlashSources` 内部用 tagged union 返回。具体实现时根据 tsc 报错调整。

### 6c: 重写 generateDailyMarkdown

完全替换 `generateDailyMarkdown` 函数：

```typescript
export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []

  lines.push(`# ${report.dateLabel}`)
  lines.push('')

  // ## AI快讯
  lines.push('## AI快讯')
  lines.push('')
  if (report.mergedAiFlash.length === 0) {
    lines.push('暂无内容')
  } else {
    for (const category of report.mergedAiFlash) {
      lines.push(`### ${category.name}`)
      lines.push('')
      for (const item of category.items) {
        lines.push(`- [**${item.title}**](${item.url}) — ${item.summary}`)
      }
      lines.push('')
    }
  }

  // ## 推特精选
  lines.push('## 推特精选')
  lines.push('')
  if (report.clawfeed) {
    lines.push(report.clawfeed.content)
  } else {
    lines.push('暂无内容')
  }
  lines.push('')

  // ## 文章列表
  lines.push('## 文章列表')
  lines.push('')
  for (const article of report.articles) {
    lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
  }

  return lines.join('\n')
}
```

**验证：** `bun run typecheck` 应无报错

---

## Task 7: 验证与测试

### 7a: Typecheck

```bash
bun run typecheck
```
预期：无 TypeScript 错误

### 7b: 单元验证（fetchHexiDaily 边界修复）

```bash
# curl 实际页面，确认 "## **今日摘要**" 存在
curl -s "https://r.jina.ai/https://ai.hubtoday.app/2026-04/2026-04-05/" | grep -c "今日摘要"
```
预期：1（行数）

### 7c: E2E 测试

```bash
bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts -t 1h'
```

检查输出 `reports/daily/YYYY-MM-DD.md`：
- [ ] 何夕部分不再有整页导航（无 `* [2026-04]` 月份列表）
- [ ] 橘鸦部分每条只出现一次，无重复段落
- [ ] AI快讯 有分类子标题（如 `### 产品更新`）
- [ ] 推特精选 独立成块，在 AI快讯 之后
- [ ] 文章列表 在最后

### 7d: 配置验证

```bash
grep -E 'clawfeed|ai-hubtoday|juya-ai-daily' config/sources.yaml
```
预期：无输出（已全部移除）

---

## 依赖关系

```
Task 1 (config) ──┐
                   ├──► Task 2 (config types)
Task 3 (fetchHexi fix) ──┐
                           ├──► Task 4 (fetchJuya重构) ──► Task 5 (categorize + types) ──► Task 6 (daily rewrite) ──► Task 7 (verify)
```

**执行顺序：Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7**

**关键依赖说明**：
- Task 5 的 `AiFlashItem` 类型定义被 Task 4（橘鸦解析）和 Task 6（daily.ts import）共同依赖
- Task 6 依赖 Task 5 的 `AiFlashCategory` 类型和 Task 2 的 `DailyConfig.aiFlashCategorization` 字段扩展
