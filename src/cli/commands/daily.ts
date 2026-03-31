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
