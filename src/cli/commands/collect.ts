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
