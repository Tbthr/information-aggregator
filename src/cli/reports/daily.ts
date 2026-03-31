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
