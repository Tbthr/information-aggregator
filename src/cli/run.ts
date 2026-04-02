// src/cli/run.ts
// Information Aggregator CLI - 单入口运行收集 + 生成日报

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { buildAdapters } from '../adapters/build-adapters.js'
import { collectWithTwoLevelConcurrency } from '../pipeline/collect.js'
import { normalizeItem } from '../pipeline/normalize.js'
import { filterByTopics } from '../pipeline/filter-by-topic.js'
import { rankCandidates } from '../pipeline/rank.js'
import { dedupeExact } from '../pipeline/dedupe-exact.js'
import { dedupeNear } from '../pipeline/dedupe-near.js'
import { generateDailyReport } from '../reports/daily.js'
import { createAiClient } from '../ai/client.js'
import type { Source, Topic, normalizedArticle } from '../types/index.js'

// ============================================================
// CLI Argument Parsing
// ============================================================

interface CLIArgs {
  timeWindow: string
  adapterConcurrency?: number
  sourceConcurrency?: number
}

function parseTimeWindow(value: string): number {
  const match = value.match(/^(\d+)(h|d)$/)
  if (!match) throw new Error(`Invalid timeWindow: ${value}`)
  const num = parseInt(match[1], 10)
  const unit = match[2]
  const ms = unit === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  return num * ms
}

function printHelp(): void {
  console.log(`
Information Aggregator CLI

Usage:
  bun run src/cli/run.ts [options]

Options:
  --time-window, -t <value>  时间窗口，如 24h, 7d, 30d (默认: 24h)
  --adapter-concurrency <n>  Adapter 并发数 (默认: 4)
  --source-concurrency <n>   Source 并发数 (默认: 4)
  --help, -h                 显示帮助信息

Examples:
  bun run src/cli/run.ts --time-window 24h
  bun run src/cli/run.ts -t 7d --adapter-concurrency 8
  bun run src/cli/run.ts --time-window 1h  # 本地测试用
`)
  process.exit(0)
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const result: CLIArgs = { timeWindow: '24h' } // 默认 24h

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      printHelp()
    } else if (arg === '--time-window' || arg === '-t') {
      result.timeWindow = args[++i]
    } else if (arg === '--adapter-concurrency') {
      result.adapterConcurrency = parseInt(args[++i], 10)
    } else if (arg === '--source-concurrency') {
      result.sourceConcurrency = parseInt(args[++i], 10)
    } else if (!arg.startsWith('-')) {
      // Positional arg: timeWindow
      result.timeWindow = arg
    }
  }

  return result
}

// ============================================================
// Logging
// ============================================================

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  ts: string
  stage: 'collect' | 'enrich' | 'filter' | 'dedupe' | 'score' | 'quadrant' | 'topic' | 'output'
  msg: string
  data?: Record<string, unknown>
}

function log(entry: LogEntry): void {
  console.log(JSON.stringify(entry))
}

// ============================================================
// Config Loading
// ============================================================

interface YamlSource {
  type: string
  id: string
  name?: string
  url?: string
  enabled?: boolean
  topics?: string[]
  handle?: string
  priority?: number
  auth?: {
    authToken?: string
    ct0?: string
  }
}

interface YamlConfig {
  sources: YamlSource[]
}

interface YamlTopic {
  id: string
  name?: string
  description?: string
  enabled?: boolean
  includeRules?: string[]
  excludeRules?: string[]
  scoreBoost?: number
  displayOrder?: number
  maxItems?: number
}

interface YamlTopicsConfig {
  topics: YamlTopic[]
}

function loadSourcesConfig(): Source[] {
  const configPath = path.join(process.cwd(), 'config', 'sources.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as YamlConfig

  return raw.sources
    .filter(s => s.enabled !== false)
    .map(s => ({
      kind: s.type as Source['kind'],
      id: s.id,
      url: s.url ?? '',
      name: s.name ?? s.id,
      enabled: true,
      configJson: s.auth ? JSON.stringify(s.auth) : undefined,
      topicIds: s.topics ?? [],
      sourceWeightScore: s.priority ?? 0.5,
    }))
}

function loadTopicsConfig(): Topic[] {
  const configPath = path.join(process.cwd(), 'config', 'topics.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as YamlTopicsConfig

  return raw.topics
    .filter(t => t.enabled !== false)
    .map(t => ({
      id: t.id,
      name: t.name ?? t.id,
      description: t.description,
      enabled: t.enabled ?? true,
      includeRules: t.includeRules ?? [],
      excludeRules: t.excludeRules ?? [],
      scoreBoost: t.scoreBoost ?? 1.0,
      displayOrder: t.displayOrder ?? 0,
      maxItems: t.maxItems ?? 10,
    }))
}

async function main() {
  const startTime = Date.now()
  const args = parseArgs()
  const timeWindow = parseTimeWindow(args.timeWindow)
  const adapterConcurrency = args.adapterConcurrency ?? 4
  const sourceConcurrency = args.sourceConcurrency ?? 4

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'collect',
    msg: '开始收集',
    data: { timeWindow, adapterConcurrency, sourceConcurrency },
  })

  // 1. 加载配置
  const sources = loadSourcesConfig()
  const adapters = buildAdapters()

  // 2. 并发收集
  const rawItems = await collectWithTwoLevelConcurrency(sources, {
    adapters,
    adapterConcurrency,
    sourceConcurrency,
    timeWindow,
    onSourceEvent: (event) => {
      log({
        level: event.status === 'failure' ? 'warn' : 'info',
        ts: new Date().toISOString(),
        stage: 'collect',
        msg: `Source ${event.sourceId}: ${event.status} (${event.itemCount} items, ${event.latencyMs}ms)`,
        data: { ...event },
      })
    },
  })

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'collect',
    msg: `收集完成`,
    data: { totalItems: rawItems.length },
  })

  // 3. normalize
  const normalized = rawItems
    .map((item) => {
      const source = sources.find(s => s.id === item.sourceId)
      const sourceWeightScore = source?.sourceWeightScore ?? 0.5
      const normalized = normalizeItem(item)
      if (normalized) {
        normalized.sourceWeightScore = sourceWeightScore
      }
      return normalized
    })
    .filter((item): item is normalizedArticle => item !== null)

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'enrich',
    msg: `标准化完成`,
    data: { totalItems: normalized.length },
  })

  // 4. topic 过滤
  const topicsConfig = loadTopicsConfig()
  const filtered = filterByTopics(normalized as any, topicsConfig) as normalizedArticle[]

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'filter',
    msg: `Topic 过滤完成`,
    data: { afterFilter: filtered.length },
  })

  // 5. 评分排序
  const ranked = rankCandidates(filtered)

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'score',
    msg: `评分排序完成`,
    data: { totalItems: ranked.length },
  })

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
  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'output',
    msg: '开始生成日报',
  })

  try {
    const aiClient = createAiClient()

    if (aiClient) {
      const result = await generateDailyReport(new Date(), aiClient, deduped as any)
      log({
        level: 'info',
        ts: new Date().toISOString(),
        stage: 'output',
        msg: '日报生成完成',
        data: { articles: result.articleCount },
      })
    } else {
      log({ level: 'warn', ts: new Date().toISOString(), stage: 'output', msg: 'AI client not available, skipping report generation' })
    }
  } catch (err) {
    log({ level: 'error', ts: new Date().toISOString(), stage: 'output', msg: `日报生成失败: ${err}` })
  }

  log({ level: 'info', ts: new Date().toISOString(), stage: 'output', msg: '完成', data: { durationMs: Date.now() - startTime } })
}

main().catch(err => {
  log({ level: 'error', ts: new Date().toISOString(), stage: 'output', msg: '执行失败', data: { error: String(err) } })
  process.exit(1)
})
