/**
 * 服务端日期工具函数。
 * 所有逻辑基于 UTC，因为 Vercel serverless 运行在 UTC 时区。
 * 日报/周报按北京时间（UTC+8）界定"某一天"。
 */

/** 北京时间偏移（小时） */
const BEIJING_OFFSET_HOURS = 8

/** Get start of current UTC day */
export function utcStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date.getTime())
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Get end of current UTC day */
export function utcEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date.getTime())
  d.setUTCHours(23, 59, 59, 999)
  return d
}

/** Get N days ago at midnight UTC */
export function utcDaysAgo(days: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

/** Get start of UTC week (Monday 00:00:00.000Z) */
export function utcStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getTime())
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Get end of UTC week (Sunday 23:59:59.999Z) */
export function utcEndOfWeek(date: Date = new Date()): Date {
  const start = utcStartOfWeek(date)
  const end = new Date(start.getTime())
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

/** Format a Date to YYYY-MM-DD string using UTC */
export function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Format a Date to Chinese day label using UTC (e.g. "3月22日") */
export function formatUtcDayLabel(date: Date): string {
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

/** Format a Date to Chinese weekday using UTC (e.g. "周一") */
export function formatUtcWeekday(date: Date): string {
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  return days[date.getUTCDay()]
}

/** Compute ISO week number from a UTC Monday */
export function utcWeekNumber(monday: Date): string {
  const year = monday.getUTCFullYear()
  const firstDayOfYear = Date.UTC(year, 0, 1)
  const days = Math.floor((monday.getTime() - firstDayOfYear) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + new Date(firstDayOfYear).getUTCDay() + 1) / 7)
  return `${year}-W${String(weekNum).padStart(2, "0")}`
}

/**
 * 北京时间某天的 UTC 起止范围。
 * 北京时间 3月22日 00:00 = UTC 3月21日 16:00
 * 北京时间 3月22日 23:59 = UTC 3月22日 15:59
 */
export function beijingDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`)
  start.setUTCHours(start.getUTCHours() - BEIJING_OFFSET_HOURS)

  const end = new Date(`${dateStr}T23:59:59.999Z`)
  end.setUTCHours(end.getUTCHours() - BEIJING_OFFSET_HOURS)

  return { start, end }
}

/**
 * 北京时间某周（周一~周日）的 UTC 起止范围。
 */
export function beijingWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date.getTime())
  // 偏移到北京时间后再计算星期
  const beijingOffset = BEIJING_OFFSET_HOURS * 60 * 60 * 1000
  const beijingTime = new Date(d.getTime() + beijingOffset)
  const day = beijingTime.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(beijingTime.getTime())
  monday.setUTCDate(beijingTime.getUTCDate() + diffToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  // 转回 UTC
  monday.setTime(monday.getTime() - beijingOffset)

  const sunday = new Date(monday.getTime())
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)

  return { start: monday, end: sunday }
}
