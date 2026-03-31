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
