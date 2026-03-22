/**
 * 前端日期格式化工具。
 * 使用浏览器原生 Intl.DateTimeFormat，将 UTC ISO 字符串转为用户本地时间。
 * 零依赖。
 */

type FormatOptions = Intl.DateTimeFormatOptions

/**
 * 格式化 UTC ISO 字符串为日期时间。
 * "2026-03-22T06:30:00.000Z" -> "3月22日 14:30"
 */
export function formatDateTime(isoString: string, options?: FormatOptions): string {
  if (!isoString) return ""
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  const defaultOptions: FormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
  return new Intl.DateTimeFormat("zh-CN", { ...defaultOptions, ...options }).format(date)
}

/**
 * 格式化 UTC ISO 字符串为日期。
 * "2026-03-22T06:30:00.000Z" -> "3月22日"
 */
export function formatDate(isoString: string): string {
  return formatDateTime(isoString, {
    month: "short",
    day: "numeric",
  })
}

/**
 * 格式化 UTC ISO 字符串为时间。
 * "2026-03-22T06:30:00.000Z" -> "14:30"
 */
export function formatTime(isoString: string): string {
  return formatDateTime(isoString, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/**
 * 格式化 UTC ISO 字符串为相对时间。
 * "今天 14:30" / "昨天 06:30" / "3月20日"
 */
export function formatRelative(isoString: string): string {
  if (!isoString) return ""
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  if (date >= todayStart) {
    return `今天 ${formatTime(isoString)}`
  }
  if (date >= yesterdayStart) {
    return `昨天 ${formatTime(isoString)}`
  }
  return formatDate(isoString)
}
