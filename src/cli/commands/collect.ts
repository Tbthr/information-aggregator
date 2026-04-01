import { loadConfig } from '../config/loader.js'
import { parseDate } from '../lib/date-utils.js'
import { writeDailyData } from '../data/writer.js'
import type { CollectedItem, SourceData } from '../data/writer.js'
import { collectRssSource } from '../../adapters/rss.js'
import { collectJsonFeedSource } from '../../adapters/json-feed.js'
import { collectXBirdSource } from '../../adapters/x-bird.js'
import type { RawItem, Source } from '../../types/index.js'
import type { Source as ConfigSource } from '../config/types.js'

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

/**
 * Convert RawItem from adapters to CollectedItem for CLI output
 */
function rawItemToCollectedItem(raw: RawItem): CollectedItem {
  let kind = 'unknown'
  try {
    const metadata = raw.metadataJson ? JSON.parse(raw.metadataJson) : {}
    kind = metadata.contentType ?? metadata.provider ?? 'unknown'
    // Normalize kind values
    if (kind === 'social_post') kind = 'tweet'
    else if (kind === 'article' && metadata.provider === 'bird') kind = 'tweet'
  } catch {
    // Use default 'unknown' if parsing fails
  }

  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    author: raw.author,
    publishedAt: raw.publishedAt ?? raw.fetchedAt,
    kind,
    content: raw.content,
  }
}

async function fetchSource(source: ConfigSource): Promise<CollectedItem[]> {
  const jobStartedAt = new Date().toISOString()

  switch (source.type) {
    case 'rss': {
      const items = await collectRssSource({ id: source.id, url: source.url }, fetch, jobStartedAt)
      return items.map(rawItemToCollectedItem)
    }
    case 'json-feed': {
      const items = await collectJsonFeedSource({ id: source.id, url: source.url }, fetch, jobStartedAt)
      return items.map(rawItemToCollectedItem)
    }
    case 'twitter': {
      // Construct Source object for x-bird adapter
      const birdSource: Source = {
        id: source.id,
        kind: 'x',
        url: source.url ?? '',
        configJson: JSON.stringify({
          birdMode: 'user-tweets',
          username: source.handle,
          authToken: source.auth?.authToken,
          ct0: source.auth?.ct0,
        }),
      }
      const items = await collectXBirdSource(birdSource, async (cmd: string[]) => {
        // Execute bird CLI command
        const { spawn } = await import('node:child_process')
        return new Promise<string>((resolve, reject) => {
          const proc = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] })
          let stdout = ''
          let stderr = ''
          proc.stdout?.on('data', (chunk: Buffer) => stdout += chunk.toString())
          proc.stderr?.on('data', (chunk: Buffer) => stderr += chunk.toString())
          proc.on('close', (code) => {
            if (code === 0) resolve(stdout)
            else reject(new Error(stderr || `bird CLI exited with code ${code}`))
          })
        })
      }, jobStartedAt)
      return items.map(rawItemToCollectedItem)
    }
    default:
      throw new Error(`Unknown source type: ${source.type}`)
  }
}
