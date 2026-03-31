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
