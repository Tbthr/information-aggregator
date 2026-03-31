# Simplified Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Information Aggregator 从 Supabase + Next.js 简化为 YAML 配置 + CLI 驱动 + GitHub Workflow + JSON 归档 + Markdown 渲染

**Architecture:** CLI 基于现有 `src/adapters/` 和 `src/ai/` 模块复用，配置迁移到 `config/*.yaml`，数据输出到 `data/` 和 `reports/`，前端用 `serve/index.html` 纯静态渲染

**Tech Stack:**
- CLI: TypeScript + Commander.js + js-yaml
- AI: 复用 `src/ai/client.ts`
- 数据源: 复用 `src/adapters/`
- 前端: `serve/index.html` + markdown-it

---

## File Structure

```
src/cli/
├── index.ts              # CLI 入口，aggregator 命令定义
├── commands/
│   ├── collect.ts        # aggregator collect
│   ├── daily.ts          # aggregator daily
│   ├── weekly.ts         # aggregator weekly
│   └── serve.ts          # aggregator serve
├── config/
│   ├── loader.ts         # YAML 配置加载 + env 占位符替换
│   ├── types.ts          # 配置类型定义
│   └── defaults.ts       # 默认值
├── lib/
│   ├── yaml-env.ts       # ${ENV_VAR} 占位符替换
│   └── date-utils.ts     # 日期/周计算工具
├── data/
│   └── writer.ts         # JSON 数据写入
└── reports/
    ├── daily.ts          # 日报 Markdown 生成
    └── weekly.ts         # 周报 Markdown 生成

config/
├── sources.yaml          # 数据源配置
├── topics.yaml          # Topic 配置
├── reports.yaml         # 日报/周报 prompt 配置
└── ai.yaml              # AI 配置

serve/
└── index.html            # 前端渲染（已存在）

.github/workflows/
├── collect.yml           # 每2小时收集
├── daily.yml            # 每天23:00 UTC生成日报
├── weekly.yml           # 每周一00:00 UTC生成周报
└── pages.yml            # GitHub Pages 部署
```

---

## Task 1: CLI 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts`
- Create: `src/cli/config/types.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@ai-enhance/aggregator-cli",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "aggregator": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "prepublish": "npm run build"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "markdown-it": "^14.0.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/markdown-it": "^14.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 src/cli/config/types.ts**

```typescript
export interface Source {
  type: 'rss' | 'json-feed' | 'twitter'
  id: string
  name: string
  url?: string
  handle?: string
  enabled: boolean
  topics: string[]
  auth?: {
    authToken: string
    ct0?: string
  }
  config?: Record<string, unknown>
}

export interface Topic {
  id: string
  name: string
  description?: string
  includeRules: string[]
  excludeRules: string[]
  maxItems: number
  scoreBoost?: number
  displayOrder?: number
}

export interface DailyConfig {
  maxItems: number
  minScore: number
  topicPrompt: string
  topicSummaryPrompt: string
}

export interface WeeklyConfig {
  days: number
  pickCount: number
  editorialPrompt?: string
  pickReasonPrompt?: string
}

export interface AIProvider {
  apiKey: string
  model: string
  baseUrl: string
}

export interface AIConfig {
  default: string
  providers: Record<string, AIProvider>
  retry?: {
    maxRetries: number
    initialDelayMs: number
    maxDelayMs: number
    backoffFactor: number
  }
  batch?: {
    size: number
    concurrency: number
  }
}

export interface AggregatorConfig {
  sources: Source[]
  topics: Topic[]
  daily: DailyConfig
  weekly: WeeklyConfig
  ai: AIConfig
}
```

- [ ] **Step 4: 创建 src/cli/index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { collect } from './commands/collect.js'
import { daily } from './commands/daily.js'
import { weekly } from './commands/weekly.js'
import { serve } from './commands/serve.js'

const program = new Command()

program
  .name('aggregator')
  .description('Information Aggregator CLI')
  .version('1.0.0')

program.command('collect').action(collect)
program.command('daily').action(daily)
program.command('weekly').action(weekly)
program.command('serve').action(serve)

program.parse()
```

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/cli/
git commit -m "feat(cli): initial CLI scaffold with TypeScript"
```

---

## Task 2: 配置加载器

**Files:**
- Create: `src/cli/config/loader.ts`
- Create: `src/cli/lib/yaml-env.ts`
- Create: `config/sources.yaml`
- Create: `config/topics.yaml`
- Create: `config/reports.yaml`
- Create: `config/ai.yaml`

- [x] **Step 1: 创建 src/cli/lib/yaml-env.ts（环境变量替换）**

```typescript
/**
 * 将 YAML 中的 ${ENV_VAR} 替换为环境变量值
 */
export function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => {
      return process.env[key] ?? ''
    })
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVars(value)
    }
    return result
  }
  return obj
}
```

- [x] **Step 2: 创建 src/cli/config/loader.ts**

```typescript
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { resolveEnvVars } from '../lib/yaml-env.js'
import type { AggregatorConfig } from './types.js'

const CONFIG_DIR = path.resolve(process.cwd(), 'config')

export function loadConfig(): AggregatorConfig {
  const sources = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'sources.yaml'), 'utf-8')
  ) as { sources: unknown[] }

  const topics = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'topics.yaml'), 'utf-8')
  ) as { topics: unknown[] }

  const reports = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'reports.yaml'), 'utf-8')
  ) as { daily: unknown; weekly: unknown }

  const ai = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'ai.yaml'), 'utf-8')
  ) as unknown

  return resolveEnvVars({
    sources: sources.sources,
    topics: topics.topics,
    daily: reports.daily,
    weekly: reports.weekly,
    ai,
  }) as AggregatorConfig
}
```

- [x] **Step 3: 创建 config/sources.yaml（从 Prisma Source 迁移）**

```yaml
sources:
  # RSS 源示例
  - type: rss
    id: infoq-cn
    name: InfoQ 中文
    url: https://www.infoq.cn/feed
    enabled: true
    topics: [tech]

  # JSON Feed 示例
  - type: json-feed
    id: buzzing
    name: Buzzing
    url: https://www.buzzing.cc/feed.json
    enabled: true
    topics: [news, tech]

  # Twitter/X 示例（需要 auth）
  - type: twitter
    id: karpathy
    name: Andrej Karpathy
    handle: karpathy
    enabled: false
    topics: [ai, ml]
    auth:
      authToken: ${TWITTER_AUTH_TOKEN}
      ct0: ${TWITTER_CT0}
```

- [x] **Step 4: 创建 config/topics.yaml（从 Prisma Topic 迁移）**

```yaml
topics:
  - id: ai
    name: AI 与大模型
    description: AI、机器学习、大模型相关
    includeRules:
      - AI
      - LLM
      - GPT
      - Claude
      - Gemini
    excludeRules:
      - 广告
      - 推广
    maxItems: 10
    scoreBoost: 1.5
    displayOrder: 1

  - id: tech
    name: 技术趋势
    description: 编程语言、框架、开源
    includeRules:
      - Rust
      - Go
      - Kubernetes
      - React
    excludeRules:
      - 广告
    maxItems: 10
    displayOrder: 2
```

- [x] **Step 5: 创建 config/reports.yaml（从 DailyReportConfig + WeeklyReportConfig 迁移）**

```yaml
daily:
  maxItems: 50
  minScore: 0
  topicPrompt: |
    将以下内容按主题分类，每个主题给出一句话摘要。

  topicSummaryPrompt: |
    为每个主题写一段 20 字以内的摘要。

weekly:
  days: 7
  pickCount: 6
  editorialPrompt: |
    写一段本周的社评，总结重点趋势，100字以内。
  pickReasonPrompt: |
    为每条精选写一句话理由，20字以内。
```

- [x] **Step 6: 创建 config/ai.yaml（从 .env 迁移）**

```yaml
default: anthropic

providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514
    baseUrl: https://api.anthropic.com

  gemini:
    apiKey: ${GEMINI_API_KEY}
    model: gemini-2.5-flash
    baseUrl: https://generativelanguage.googleapis.com

retry:
  maxRetries: 3
  initialDelayMs: 1000
  maxDelayMs: 30000
  backoffFactor: 2

batch:
  size: 5
  concurrency: 2
```

- [x] **Step 7: Commit**

```bash
git add src/cli/config/ src/cli/lib/ config/
git commit -m "feat(config): add YAML config files and loader"
```

---

## Task 3: aggregator collect 命令

**Files:**
- Create: `src/cli/commands/collect.ts`
- Create: `src/cli/data/writer.ts`
- Create: `src/cli/lib/date-utils.ts`
- Modify: `src/cli/index.ts`（添加 --date 参数）

- [x] **Step 1: 创建 src/cli/lib/date-utils.ts**

```typescript
/**
 * 获取今天的 UTC 日期字符串
 */
export function getToday(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * 获取本周的 ISO 周编号
 */
export function getWeekNumber(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const oneJan = new Date(year, 0, 1)
  const weekNum = Math.ceil(
    ((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7
  )
  return `${year}-W${weekNum.toString().padStart(2, '0')}`
}

/**
 * 获取某日期所在周的所有日期（周一到周日）
 */
export function getWeekDates(weekStr: string): string[] {
  const [year, week] = weekStr.split('-W').map(Number)
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1))
  const daysOffset = (week - 1) * 7 - firstDayOfYear.getUTCDay() + 1
  const monday = new Date(firstDayOfYear.getTime() + daysOffset * 86400000)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 86400000)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

/**
 * 解析命令行 --date 参数（支持 YYYY-MM-DD）
 */
export function parseDate(dateStr?: string): string {
  if (!dateStr) return getToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`)
  }
  return dateStr
}
```

- [x] **Step 2: 创建 src/cli/data/writer.ts**

```typescript
import fs from 'fs'
import path from 'path'

export interface CollectedItem {
  id: string
  title: string
  url: string
  author?: string
  publishedAt: string
  kind: string
  content?: string
}

export interface SourceData {
  id: string
  name: string
  items: CollectedItem[]
}

export interface DailyData {
  date: string
  collectedAt: string
  sources: SourceData[]
  totalItems: number
}

export function writeDailyData(date: string, data: DailyData): void {
  const outputDir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const filePath = path.join(outputDir, `${date}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Written: ${filePath}`)
}
```

- [x] **Step 3: 创建 src/cli/commands/collect.ts**

```typescript
import { loadConfig } from '../config/loader.js'
import { parseDate } from '../lib/date-utils.js'
import { writeDailyData } from '../data/writer.js'
import type { CollectedItem, SourceData } from '../data/writer.js'

interface CollectOptions {
  date?: string
}

export async function collect(options: CollectOptions): Promise<void> {
  const date = parseDate(options.date)
  console.log(`Collecting data for ${date}...`)

  const config = loadConfig()
  const sources: SourceData[] = []

  for (const source of config.sources) {
    if (!source.enabled) continue

    console.log(`Fetching ${source.name}...`)
    try {
      const items = await fetchSource(source)
      sources.push({
        id: source.id,
        name: source.name,
        items,
      })
      console.log(`  -> Got ${items.length} items`)
    } catch (err) {
      console.error(`  -> Failed: ${err}`)
    }
  }

  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0)

  writeDailyData(date, {
    date,
    collectedAt: new Date().toISOString(),
    sources,
    totalItems,
  })

  console.log(`Done. Total: ${totalItems} items from ${sources.length} sources`)
}

async function fetchSource(source: { type: string; id: string; url?: string; handle?: string }): Promise<CollectedItem[]> {
  switch (source.type) {
    case 'rss':
    case 'json-feed':
      return fetchFeed(source.url!)
    case 'twitter':
      return fetchTwitter(source.handle!)
    default:
      throw new Error(`Unknown source type: ${source.type}`)
  }
}

async function fetchFeed(url: string): Promise<CollectedItem[]> {
  // 在 Task 8 中复用 src/adapters/rss.ts 实现
  // 此处先用 throw 提示必须完成 Task 8
  throw new Error('fetchFeed not implemented - complete Task 8 first')
}

async function fetchTwitter(handle: string): Promise<CollectedItem[]> {
  // 在 Task 8 中复用 src/adapters/x-bird.ts 实现
  throw new Error('fetchTwitter not implemented - complete Task 8 first')
}
```

- [x] **Step 4: 更新 src/cli/index.ts 添加参数支持**

```typescript
program
  .command('collect')
  .option('--date <YYYY-MM-DD>', 'Specify collection date (default: today)')
  .option('--config <path>', 'Config directory (default: ./config)')
  .option('--output <path>', 'Output directory (default: ./data)')
  .action(collect)
```

- [x] **Step 5: Commit**

```bash
git add src/cli/commands/collect.ts src/cli/data/ src/cli/lib/date-utils.ts
git commit -m "feat(cli): implement aggregator collect command"
```

---

## Task 4: aggregator daily 命令

**Files:**
- Create: `src/cli/commands/daily.ts`
- Create: `src/cli/reports/daily.ts`

- [ ] **Step 1: 创建 src/cli/reports/daily.ts**

```typescript
import fs from 'fs'
import path from 'path'
import type { DailyData } from '../data/writer.js'

export interface DailyReport {
  date: string
  dateLabel: string
  totalPicks: number
  topics: TopicReport[]
}

export interface TopicReport {
  title: string
  summary: string
  picks: Pick[]
}

export interface Pick {
  n: number
  title: string
  reason: string
  url?: string
}

export function generateDailyMarkdown(report: DailyReport): string {
  const lines: string[] = []

  lines.push(`# ${report.dateLabel} 今日简报`)
  lines.push('')
  lines.push(`共 ${report.totalPicks} 条精选`)
  lines.push('')

  for (const topic of report.topics) {
    lines.push(`## # ${topic.title}`)
    lines.push('')
    lines.push(`摘要：${topic.summary}`)
    lines.push('')

    for (const pick of topic.picks) {
      lines.push(`${pick.n}. **${pick.title}**`)
      lines.push(`   "${pick.reason}"`)
      if (pick.url) {
        lines.push(`   [原文](${pick.url})`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 2: 创建 src/cli/commands/daily.ts**

```typescript
import fs from 'fs'
import path from 'path'
import { loadConfig } from '../config/loader.js'
import { parseDate } from '../lib/date-utils.js'
import { generateDailyMarkdown, type DailyReport } from '../reports/daily.js'

interface DailyOptions {
  date?: string
  input?: string
  output?: string
}

export async function daily(options: DailyOptions): Promise<void> {
  const date = options.date ?? (() => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 1) // 默认昨天（UTC）
    return d.toISOString().split('T')[0]
  })()

  console.log(`Generating daily report for ${date}...`)

  // 读取收集数据
  const inputPath = options.input ?? path.resolve(process.cwd(), 'data', `${date}.json`)
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Data file not found: ${inputPath}`)
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

  // TODO (Task 8): 调用 AI 进行分类和摘要
  // 复用 src/ai/client.ts + src/ai/prompts-daily-brief.ts
  // 当前生成临时示例报告

  // 临时：生成示例报告
  const report: DailyReport = {
    date,
    dateLabel: `${date} 今日简报`,
    totalPicks: 10,
    topics: [
      {
        title: 'AI 与大模型',
        summary: 'Claude 4 发布，GPT-5 进展',
        picks: [
          { n: 1, title: 'Anthropic 发布 Claude 4 系列模型', reason: '多模态能力大幅提升' },
        ],
      },
    ],
  }

  const markdown = generateDailyMarkdown(report)

  // 写入 Markdown
  const outputDir = options.output ?? path.resolve(process.cwd(), 'reports', 'daily')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, `${date}.md`)
  fs.writeFileSync(outputPath, markdown, 'utf-8')
  console.log(`Written: ${outputPath}`)
}
```

- [ ] **Step 3: 更新 src/cli/index.ts**

```typescript
program
  .command('daily')
  .option('--date <YYYY-MM-DD>', 'Specify date (default: yesterday)')
  .option('--input <path>', 'Input JSON path')
  .option('--output <path>', 'Output directory')
  .action(daily)
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/daily.ts src/cli/reports/daily.ts
git commit -m "feat(cli): implement aggregator daily command"
```

---

## Task 5: aggregator weekly 命令

**Files:**
- Create: `src/cli/commands/weekly.ts`
- Create: `src/cli/reports/weekly.ts`

- [ ] **Step 1: 创建 src/cli/reports/weekly.ts**

```typescript
import type { Pick } from './daily.js'

export interface WeeklyReport {
  week: string
  weekLabel: string
  startDate: string
  endDate: string
  editorial: string
  picks: (Pick & { date: string })[]
}

export function generateWeeklyMarkdown(report: WeeklyReport): string {
  const lines: string[] = []

  lines.push(`# ${report.week} 周报`)
  lines.push('')
  lines.push(`${report.startDate} ~ ${report.endDate}`)
  lines.push('')
  lines.push('## 社评')
  lines.push('')
  lines.push(report.editorial)
  lines.push('')
  lines.push('## 本周精选')
  lines.push('')

  for (const pick of report.picks) {
    lines.push(`${pick.n}. **${pick.title}**`)
    lines.push(`   ${pick.reason}`)
    if (pick.url) {
      lines.push(`   [原文](${pick.url}) | ${pick.date}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
```

- [ ] **Step 2: 创建 src/cli/commands/weekly.ts**

```typescript
import fs from 'fs'
import path from 'path'
import { getWeekNumber, getWeekDates } from '../lib/date-utils.js'
import { generateWeeklyMarkdown, type WeeklyReport } from '../reports/weekly.js'

interface WeeklyOptions {
  week?: string
  input?: string
  output?: string
}

export async function weekly(options: WeeklyOptions): Promise<void> {
  const weekStr = options.week ?? getWeekNumber()
  const weekDates = getWeekDates(weekStr)

  console.log(`Generating weekly report for ${weekStr}...`)
  console.log(`Dates: ${weekDates.join(' ~ ')}`)

  // 读取本周所有日的数据
  const allItems: { date: string; url: string; title: string; [key: string]: unknown }[] = []

  for (const date of weekDates) {
    const inputPath = path.resolve(process.cwd(), 'data', `${date}.json`)
    if (fs.existsSync(inputPath)) {
      const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
      for (const source of data.sources) {
        for (const item of source.items) {
          allItems.push({ ...item, date })
        }
      }
    }
  }

  // URL 去重（保留最早发布的）
  const seen = new Set<string>()
  const dedupedItems = allItems.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })

  console.log(`Total items after dedup: ${dedupedItems.length}`)

  // TODO (Task 8): 调用 AI 选 6 条周精选 + 生成社评
  // 复用 src/ai/client.ts + src/ai/prompts-reports.ts
  // 当前生成临时示例报告

  // 临时：生成示例报告
  const report: WeeklyReport = {
    week: weekStr,
    weekLabel: `${weekStr} 周报`,
    startDate: weekDates[0],
    endDate: weekDates[6],
    editorial: '本周 AI 领域迎来重要更新...',
    picks: [
      { n: 1, title: 'Claude 4 系列发布', reason: '重新定义多模态 AI 标准', date: weekDates[0] },
    ],
  }

  const markdown = generateWeeklyMarkdown(report)

  // 写入 Markdown
  const outputDir = options.output ?? path.resolve(process.cwd(), 'reports', 'weekly')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, `${weekStr}.md`)
  fs.writeFileSync(outputPath, markdown, 'utf-8')
  console.log(`Written: ${outputPath}`)
}
```

- [ ] **Step 3: 更新 src/cli/index.ts**

```typescript
program
  .command('weekly')
  .option('--week <YYYY-Www>', 'Specify week (default: current week)')
  .option('--input <path>', 'Input JSON path (default: data/)')
  .option('--output <path>', 'Output directory')
  .action(weekly)
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/weekly.ts src/cli/reports/weekly.ts
git commit -m "feat(cli): implement aggregator weekly command"
```

---

## Task 6: aggregator serve 命令

**Files:**
- Modify: `src/cli/commands/serve.ts`（新增 serve 命令）
- Modify: `serve/index.html`（增强 Markdown 渲染和导航）

- [ ] **Step 1: 创建 src/cli/commands/serve.ts**

```typescript
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

interface ServeOptions {
  port?: string
  reports?: string
}

export async function serve(options: ServeOptions): Promise<void> {
  const port = parseInt(options.port ?? '3000')
  const reportsDir = options.reports ?? path.resolve(process.cwd(), 'reports')

  // 扫描 reports/daily/ 和 reports/weekly/
  const dailyFiles = fs.readdirSync(path.join(reportsDir, 'daily'))
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()

  const weeklyFiles = fs.readdirSync(path.join(reportsDir, 'weekly'))
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()

  // 注入索引数据到 index.html
  const indexPath = path.resolve(process.cwd(), 'serve', 'index.html')
  let html = fs.readFileSync(indexPath, 'utf-8')

  // 注入配置
  html = html.replace(
    '</body>',
    `<script>window.__REPORTS_CONFIG = ${JSON.stringify({ dailyFiles, weeklyFiles })};</script></body>`
  )

  const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url!).pathname!

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
      return
    }

    // 代理 Markdown 文件请求
    const filePath = path.join(process.cwd(), pathname)
    if (fs.existsSync(filePath) && filePath.endsWith('.md')) {
      res.writeHead(200, { 'Content-Type': 'text/markdown' })
      res.end(fs.readFileSync(filePath, 'utf-8'))
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
    console.log(`Daily reports: ${dailyFiles.length} files`)
    console.log(`Weekly reports: ${weeklyFiles.length} files`)
  })
}
```

- [ ] **Step 2: 更新 serve/index.html 添加动态加载逻辑**

```typescript
// 在 script 末尾添加

// 获取索引配置
const { dailyFiles, weeklyFiles } = window.__REPORTS_CONFIG

// 渲染导航列表
function renderNav(files: string[], type: 'daily' | 'weekly') {
  const nav = document.getElementById(`${type}-nav`)
  nav.innerHTML = files.map(f => {
    const date = f.replace('.md', '')
    return `<li class="nav-item"><a href="#" class="nav-link" data-type="${type}" data-file="${f}">${date}</a></li>`
  }).join('')
}

renderNav(dailyFiles, 'daily')
renderNav(weeklyFiles, 'weekly')

// 点击导航加载对应 Markdown
document.addEventListener('click', async (e) => {
  const link = (e.target as HTMLElement).closest('.nav-link')
  if (!link) return

  e.preventDefault()
  const { type, file } = link.dataset

  // 加载 Markdown
  const resp = await fetch(`/reports/${type}/${file}`)
  const markdown = await resp.text()

  // 渲染
  const html = md.render(markdown)
  document.getElementById('report-content').innerHTML = html
})
```

- [ ] **Step 3: 更新 src/cli/index.ts 添加 serve 命令**

```typescript
program
  .command('serve')
  .option('--port <number>', 'Port to listen on', '3000')
  .option('--reports <path>', 'Reports directory')
  .action(serve)
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/serve.ts serve/index.html
git commit -m "feat(cli): implement aggregator serve command"
```

---

## Task 7: GitHub Workflows

**Files:**
- Create: `.github/workflows/collect.yml`
- Create: `.github/workflows/daily.yml`
- Create: `.github/workflows/weekly.yml`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: 创建 .github/workflows/collect.yml**

```yaml
name: Collect Data
on:
  schedule:
    - cron: "0 */2 * * *"  # 每2小时 UTC
  workflow_dispatch:

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build CLI
        run: npm run build

      - name: Collect
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          TWITTER_AUTH_TOKEN: ${{ secrets.TWITTER_AUTH_TOKEN }}
          TWITTER_CT0: ${{ secrets.TWITTER_CT0 }}
        run: node dist/cli/index.js collect

      - name: Commit data
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "data: collect $(date +%Y-%m-%d)"
          file_pattern: "data/*.json"
```

- [ ] **Step 2: 创建 .github/workflows/daily.yml**

```yaml
name: Generate Daily Report
on:
  schedule:
    - cron: "0 23 * * *"  # 每天 23:00 UTC = 7:00 北京时间
  workflow_dispatch:

jobs:
  daily:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build CLI
        run: npm run build

      - name: Generate Daily
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node dist/cli/index.js daily

      - name: Commit report
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "report: daily $(date +%Y-%m-%d)"
          file_pattern: "reports/daily/*.md"
```

- [ ] **Step 3: 创建 .github/workflows/weekly.yml**

```yaml
name: Generate Weekly Report
on:
  schedule:
    - cron: "0 0 * * 1"  # 每周一 00:00 UTC = 8:00 北京时间
  workflow_dispatch:

jobs:
  weekly:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build CLI
        run: npm run build

      - name: Generate Weekly
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node dist/cli/index.js weekly

      - name: Commit report
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "report: weekly $(date +%Y-W%V)"
          file_pattern: "reports/weekly/*.md"
```

- [ ] **Step 4: 创建 .github/workflows/pages.yml**

```yaml
name: Build and Deploy to Pages
on:
  push:
    branches: [main]
    paths:
      - 'reports/**'
      - 'serve/**'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Zola
        uses: cmwylie19/zola-deploy@latest
        with:
          args: build --base-url ${{ vars.BASE_URL }}

      - name: Deploy to Pages
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/
git commit -m "ci: add GitHub workflows for collect, daily, weekly, pages"
```

---

## Task 8: 复用现有代码（适配层）

**Files:**
- Modify: `src/cli/commands/collect.ts`（导入现有 adapters）
- Modify: `src/cli/commands/daily.ts`（导入现有 AI client）
- Modify: `src/cli/commands/weekly.ts`（导入现有 AI client）

- [ ] **Step 1: 在 collect.ts 中复用 src/adapters/**

```typescript
import { buildAdapters } from '../../adapters/build-adapters.js'

async function fetchSource(source: ConfigSource): Promise<CollectedItem[]> {
  const adapters = await buildAdapters()

  switch (source.type) {
    case 'rss':
      return adapters.rss.fetch(source.url)
    case 'json-feed':
      return adapters.jsonFeed.fetch(source.url)
    case 'twitter':
      return adapters.twitter.fetch({
        handle: source.handle,
        authToken: source.auth?.authToken,
        ct0: source.auth?.ct0,
      })
    default:
      throw new Error(`Unknown source type: ${source.type}`)
  }
}
```

- [ ] **Step 2: 在 daily.ts 中复用 src/ai/client.ts**

```typescript
import { createClient } from '../../ai/client.js'
import type { AIConfig } from '../config/types.js'

async function classifyAndSummarize(
  items: CollectedItem[],
  config: { topics: Topic[]; daily: DailyConfig; ai: AIConfig }
): Promise<DailyReport> {
  const client = createClient({
    provider: config.ai.default,
    apiKey: config.ai.providers[config.ai.default].apiKey,
    model: config.ai.providers[config.ai.default].model,
  })

  // TODO: 调用 AI 进行分类和摘要
  // 复用 src/ai/prompts-daily-brief.ts
  return mockReport()
}
```

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/collect.ts src/cli/commands/daily.ts src/cli/commands/weekly.ts
git commit -m "refactor(cli): integrate existing adapters and AI client"
```

---

## 依赖关系

```
Task 1 (CLI scaffold)
    ↓
Task 2 (config loader) ← 并行 →
Task 3 (collect)        → Task 8 (reuse adapters)
Task 4 (daily)          → Task 8 (reuse AI client)
Task 5 (weekly)         → Task 8 (reuse AI client)
Task 6 (serve)          → Task 1
Task 7 (workflows)      → Task 3, 4, 5
```
