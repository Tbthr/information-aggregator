// src/cli/run.ts
// Information Aggregator CLI - 单入口运行收集 + 生成日报

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { buildAdapters } from '../adapters/build-adapters.js'
import { JsonArticleStore } from '../archive/json-store.js'
import { generateDailyReport } from '../reports/daily.js'
import { createAiClient } from '../ai/client.js'
import type { Source } from '../types/index.js'
import type { RawItem } from '../types/index.js'
import type { Article } from '../archive/index.js'

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  ts: string
  stage: 'collect' | 'enrich' | 'dedupe' | 'score' | 'quadrant' | 'topic' | 'output'
  msg: string
  data?: Record<string, unknown>
}

function log(entry: LogEntry): void {
  console.log(JSON.stringify(entry))
}

interface YamlSource {
  type: string
  id: string
  name?: string
  url?: string
  enabled?: boolean
  topics?: string[]
  handle?: string
  sourceWeightScore?: number
  auth?: {
    authToken?: string
    ct0?: string
  }
}

interface YamlConfig {
  sources: YamlSource[]
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
      description: s.name,
      enabled: true,
      configJson: s.auth ? JSON.stringify(s.auth) : undefined,
      topicIds: s.topics ?? [],
      sourceWeightScore: s.sourceWeightScore ?? 1.0,
    }))
}

function rawItemToArticle(raw: RawItem, sourceName: string): Article {
  let kind: 'article' | 'tweet' = 'article'
  try {
    const metadata = raw.metadataJson ? JSON.parse(raw.metadataJson) : {}
    if (metadata.contentType === 'social_post' || metadata.sourceKind === 'x') {
      kind = 'tweet'
    }
  } catch {
    // default to article
  }

  return {
    id: raw.id,
    sourceId: raw.sourceId,
    sourceName,
    title: raw.title,
    url: raw.url,
    author: raw.author ?? '',
    publishedAt: raw.publishedAt ?? raw.fetchedAt,
    kind,
    content: raw.content ?? '',
  }
}

async function main() {
  const startTime = Date.now()
  const date = new Date().toISOString().split('T')[0]

  log({ level: 'info', ts: new Date().toISOString(), stage: 'collect', msg: '开始收集', data: { date } })

  // 1. 加载配置
  const sources = loadSourcesConfig()
  const adapters = buildAdapters()

  // 2. 收集数据
  const items: Article[] = []
  const sourceNames: Record<string, string> = {}
  const timeWindow = 24 // hours, default value

  for (const source of sources) {
    // 从 sources.yaml 获取 source name
    const yamlConfig = (yaml.load(fs.readFileSync(path.join(process.cwd(), 'config', 'sources.yaml'), 'utf-8')) as YamlConfig).sources
    const yamlSource = yamlConfig.find((s: YamlSource) => s.id === source.id)
    sourceNames[source.id] = yamlSource?.name ?? source.id

    log({ level: 'info', ts: new Date().toISOString(), stage: 'collect', msg: `Fetching ${sourceNames[source.id]}...`, data: { sourceId: source.id } })

    try {
      const adapter = adapters[source.kind]
      if (!adapter) {
        log({ level: 'warn', ts: new Date().toISOString(), stage: 'collect', msg: `No adapter for ${source.kind}`, data: { sourceId: source.id } })
        continue
      }

      const rawItems = await adapter(source, { timeWindow })
      const articles = rawItems.map(item => rawItemToArticle(item, sourceNames[source.id]))
      items.push(...articles)

      log({ level: 'info', ts: new Date().toISOString(), stage: 'collect', msg: `Got ${rawItems.length} items`, data: { sourceId: source.id, count: rawItems.length } })
    } catch (err) {
      log({ level: 'warn', ts: new Date().toISOString(), stage: 'collect', msg: `Failed: ${err}`, data: { sourceId: source.id } })
    }
  }

  // 3. 保存到 JsonArticleStore
  const store = new JsonArticleStore('data')
  await store.save(date, items)
  log({ level: 'info', ts: new Date().toISOString(), stage: 'collect', msg: `Saved ${items.length} items`, data: { date, total: items.length } })

  // 4. 生成日报
  log({ level: 'info', ts: new Date().toISOString(), stage: 'output', msg: '开始生成日报', data: { date } })

  try {
    const aiClient = createAiClient()

    if (aiClient) {
      const result = await generateDailyReport(new Date(date), aiClient)
      log({ level: 'info', ts: new Date().toISOString(), stage: 'output', msg: '日报生成完成', data: { date, topics: result.topicCount } })
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
