import fs from 'fs'
import path from 'path'
import { getWeekNumber, getWeekDates } from '../lib/date-utils.js'
import { generateWeeklyMarkdown, type WeeklyReport } from '../reports/weekly.js'
import { createAiClient } from '../../ai/client.js'
import type { AiClient } from '../../ai/client.js'
import type { CollectedItem } from '../data/writer.js'
import type { Topic, WeeklyConfig, AIConfig } from '../config/types.js'

interface WeeklyOptions {
  week?: string
  input?: string
  output?: string
}

/**
 * Stub function for AI-based weekly report generation.
 * TODO (Task 8): Implement full AI selection and editorial generation
 * using src/ai/prompts-reports.ts and the AI client.
 */
async function generateWeeklyReport(
  items: CollectedItem[],
  weekStr: string,
  weekDates: string[],
  config: { topics: Topic[]; weekly: WeeklyConfig; ai: AIConfig }
): Promise<WeeklyReport> {
  // Create AI client from config
  let client: AiClient | null = null
  try {
    const providerConfig = config.ai.providers[config.ai.default]
    if (providerConfig?.apiKey) {
      client = createAiClient(config.ai.default as 'anthropic' | 'gemini' | 'openai')
    }
  } catch (err) {
    console.warn('Failed to create AI client, using stub report:', err)
  }

  if (!client) {
    // Return stub report if no AI client available
    return {
      week: weekStr,
      weekLabel: `${weekStr} 周报`,
      startDate: weekDates[0],
      endDate: weekDates[6],
      editorial: 'AI 报告生成中...',
      picks: [],
    }
  }

  // TODO: Implement full AI weekly report using:
  // - buildEditorialPrompt() from prompts-reports.ts
  // - buildPickReasonPrompt() from prompts-reports.ts
  // - client.generateText()

  // For now, return a placeholder
  console.log(`AI client available, ${items.length} items to process`)
  return {
    week: weekStr,
    weekLabel: `${weekStr} 周报 (stub)`,
    startDate: weekDates[0],
    endDate: weekDates[6],
    editorial: '本周重要更新...',
    picks: [],
  }
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
