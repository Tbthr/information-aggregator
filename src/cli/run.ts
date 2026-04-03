// src/cli/run.ts
// Information Aggregator CLI - 单入口运行收集 + 生成日报

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { buildAdapters } from '../adapters/build-adapters.js'
import { collectWithTwoLevelConcurrency } from '../pipeline/collect.js'
import { normalizeItem } from '../pipeline/normalize.js'
import { filterByTags } from '../pipeline/filter-by-tag.js'
import { rankCandidates } from '../pipeline/rank.js'
import { dedupeExact } from '../pipeline/dedupe-exact.js'
import { dedupeNear } from '../pipeline/dedupe-near.js'
import { enrichArticles } from '../pipeline/enrich.js'
import { generateDailyReport } from '../reports/daily.js'
import { createAiClient } from '../ai/client.js'
import type { EnrichOptions } from '../pipeline/enrich.js'
import type { Source, Tag, normalizedArticle } from '../types/index.js'

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
  stage: 'collect' | 'enrich' | 'filter' | 'dedupe' | 'score' | 'normalize' | 'quadrant' | 'topic' | 'output'
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
  tagIds?: string[]
  handle?: string
  weightScore?: number
  contentType?: string
  auth?: {
    authToken?: string
    ct0?: string
  }
}

interface YamlConfig {
  sources: YamlSource[]
}

interface YamlTag {
  id: string
  name?: string
  description?: string
  enabled?: boolean
  includeRules?: string[]
  excludeRules?: string[]
  scoreBoost?: number
}

interface YamlTagsConfig {
  tags: YamlTag[]
}

interface YamlEnrichConfig {
  enrich: {
    enabled?: boolean
    batchSize?: number
    minContentLength?: number
    fetchTimeout?: number
  }
}

function loadSourcesConfig(): Source[] {
  const sourcesPath = path.join(process.cwd(), 'config', 'sources.yaml')
  const sourcesContent = fs.readFileSync(sourcesPath, 'utf-8')
  const raw = yaml.load(sourcesContent) as YamlConfig

  const tagsPath = path.join(process.cwd(), 'config', 'tags.yaml')
  const tagsContent = fs.readFileSync(tagsPath, 'utf-8')
  const tagsRaw = yaml.load(tagsContent) as YamlTagsConfig
  const tagMap = new Map(tagsRaw.tags.map(t => [t.id, t]))

  return raw.sources
    .filter(s => s.enabled !== false)
    .map(s => {
      if (!s.contentType) {
        throw new Error(`Source ${s.id} is missing required contentType field`)
      }
      const resolvedTags = (s.tagIds ?? [])
        .map(id => tagMap.get(id))
        .filter((t): t is Tag => t !== undefined)

      return {
        type: s.type,
        id: s.id,
        name: s.name ?? s.id,
        url: s.url ?? '',
        enabled: true,
        tags: resolvedTags,
        weightScore: null,
        contentType: s.contentType,
        authConfigJson: s.auth ? JSON.stringify(s.auth) : null,
        sourceWeightScore: s.weightScore ?? 1,
      }
    })
}

function loadTagsConfig(): Tag[] {
  const configPath = path.join(process.cwd(), 'config', 'tags.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as YamlTagsConfig

  return raw.tags
    .filter(t => t.enabled !== false)
    .map(t => ({
      id: t.id,
      name: t.name ?? t.id,
      description: t.description,
      enabled: t.enabled ?? true,
      includeRules: t.includeRules ?? [],
      excludeRules: t.excludeRules ?? [],
      scoreBoost: t.scoreBoost ?? 1.0,
    }))
}

function loadEnrichConfig(): EnrichOptions {
  const configPath = path.join(process.cwd(), 'config', 'reports.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as YamlEnrichConfig

  return {
    batchSize: raw.enrich?.batchSize ?? 10,
    minContentLength: raw.enrich?.minContentLength ?? 500,
    fetchTimeout: raw.enrich?.fetchTimeout ?? 20000,
  }
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
        // 传递 tagFilter，供 filterByTags 使用
        ;(normalized as any).tagFilter = item.tagFilter ?? source?.tags ?? []
      }
      return normalized
    })
    .filter((item): item is normalizedArticle => item !== null)


  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'normalize',
    msg: `标准化完成`,
    data: { totalItems: normalized.length },
  })

  // 4. tag 过滤
  const tagsConfig = loadTagsConfig()
  const filtered = filterByTags(normalized as any, tagsConfig) as normalizedArticle[]

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'filter',
    msg: `Tag 过滤完成`,
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

  // 7. 内容充实
  const enrichConfig = loadEnrichConfig()
  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'enrich',
    msg: '开始内容充实',
    data: { beforeEnrich: deduped.length },
  })

  const enriched = enrichArticles(deduped, enrichConfig)

  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'enrich',
    msg: '内容充实完成',
    data: { afterEnrich: enriched.length },
  })

  // 8. 生成日报
  log({
    level: 'info',
    ts: new Date().toISOString(),
    stage: 'output',
    msg: '开始生成日报',
  })

  try {
    const aiClient = createAiClient()

    if (aiClient) {
      const result = await generateDailyReport(new Date(), aiClient, enriched as any)
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
