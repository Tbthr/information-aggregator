/**
 * 获取今天的 UTC 日期字符串
 */
export function getToday(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * 获取本周的 ISO 周编号
 */
export function getWeekNumber(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const oneJan = new Date(year, 0, 1)
  const weekNum = Math.ceil(
    ((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7
  )
  return `${year}-W${weekNum.toString().padStart(2, '0')}`
}

/**
 * 获取某日期所在周的所有日期（周一到周日）
 */
export function getWeekDates(weekStr: string): string[] {
  const [year, week] = weekStr.split('-W').map(Number)
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1))
  const daysOffset = (week - 1) * 7 - firstDayOfYear.getUTCDay() + 1
  const monday = new Date(firstDayOfYear.getTime() + daysOffset * 86400000)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 86400000)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

/**
 * 解析命令行 --date 参数（支持 YYYY-MM-DD）
 */
export function parseDate(dateStr?: string): string {
  if (!dateStr) return getToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`)
  }
  return dateStr
}
