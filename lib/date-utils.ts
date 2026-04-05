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

/** Parse ISO week number string like "2026-W13" to the Monday date */
export function parseWeekNumber(weekStr: string): Date {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/)
  if (!match) throw new Error(`Invalid week number format: ${weekStr}`)
  const year = parseInt(match[1], 10)
  const week = parseInt(match[2], 10)

  // Find the Monday of week 1 of the year
  // Jan 4 is always in week 1 (ISO 8601)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay()
  // Days from Jan4 Monday to Jan4
  const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day
  const week1Monday = new Date(jan4.getTime() + daysToMonday * 24 * 60 * 60 * 1000)

  // Add (week - 1) weeks
  const monday = new Date(week1Monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000)
  return monday
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
 * 将 Date 对象转换为北京时间的日期字符串（YYYY-MM-DD）。
 * 通过 UTC+8 偏移后提取 UTC components 实现，避免 toISOString() 的 UTC 日期偏差。
 */
export function formatBeijingDate(date: Date): string {
  const d = new Date(date.getTime() + BEIJING_OFFSET_HOURS * 60 * 60 * 1000)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 北京时间某天的 UTC 起止范围。
 * 北京时间 3月22日 00:00 = UTC 3月21日 16:00
 * 北京时间 3月22日 23:59 = UTC 3月22日 15:59
 */
export function beijingDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`)
  start.setUTCHours(start.getUTCHours() - BEIJING_OFFSET_HOURS)

  // End: 23:59 Beijing = 15:59 UTC same day (subtract offset directly).
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

// ============================================================
// Unified ParseDate (for RSS and JSON Feed adapters)
// ============================================================

export interface ParseDateSuccess {
  valid: true;
  date: Date;
  rawPublishedAt: string;
  timeSourceField: string;
  timeParseNote: string;
}

export interface ParseDateFailure {
  valid: false;
  rawPublishedAt: string;
  reason: "relative" | "invalid";
}

export type ParseDateResult = ParseDateSuccess | ParseDateFailure | null;

// Pre-compiled regex patterns for relative date detection
const RELATIVE_DATE_PATTERNS = [/\bago\b/i, /\bhours?\b/i, /\bdays?\b/i, /\bminutes?\b/i, /\byesterday\b/i, /\bjust now\b/i];

/**
 * Parse a date string into UTC Date.
 * Supports:
 * - RFC 2822 (RFC 822) format: "Mon, 09 Mar 2026 08:00:00 GMT"
 * - ISO 8601 with Z: "2026-03-09T08:00:00Z"
 * - ISO 8601 with offset: "2026-03-09T08:00:00+08:00"
 * - Date only: "2026-03-09" (filled to 23:59:59 UTC)
 *
 * Returns null for empty input, { valid: false } for invalid/relative timestamps.
 */
export function parseDate(dateStr: string, timeSourceField = "date"): ParseDateResult {
  if (!dateStr || dateStr.trim() === "") {
    return null;
  }

  const trimmed = dateStr.trim();

  // Check for relative timestamps (contain words like "ago", "hours", "days", etc.)
  if (RELATIVE_DATE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { valid: false, rawPublishedAt: trimmed, reason: "relative" };
  }

  // Try pure date format (YYYY-MM-DD)
  const dateOnlyMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);

  if (dateOnlyMatch) {
    // Date-only: treat as UTC 23:59:59 of that date
    const parsed = new Date(`${trimmed}T23:59:59.000Z`);
    if (isNaN(parsed.getTime())) {
      return { valid: false, rawPublishedAt: trimmed, reason: "invalid" };
    }
    return {
      valid: true,
      date: parsed,
      rawPublishedAt: trimmed,
      timeSourceField,
      timeParseNote: "date-only, filled to 23:59:59 UTC",
    };
  }

  // Try standard Date.parse first for ISO 8601 formats
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return {
      valid: true,
      date: new Date(parsed.toISOString()),
      rawPublishedAt: trimmed,
      timeSourceField,
      timeParseNote: parsed.getTimezoneOffset() === 0 ? "parsed as UTC" : "parsed with timezone conversion",
    };
  }

  // Try manual RFC 2822 parsing for formats like "Mon, 09 Mar 2026 08:00:00 GMT"
  const rfc2822Manual = trimmed.match(
    /^[A-Za-z]{3},?\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([\+\-]\d{4}|[A-Z]{2,4})?$/i
  );

  if (rfc2822Manual) {
    const [, day, monthStr, year, hour, minute, second, tz] = rfc2822Manual;
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const month = months[monthStr];
    if (month !== undefined) {
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      const s = parseInt(second, 10);
      const d = parseInt(day, 10);
      const y = parseInt(year, 10);

      let date: Date;
      if (tz) {
        // Handle timezone
        let offsetMs = 0;
        if (tz === "GMT" || tz === "UT" || tz === "UTC") {
          offsetMs = 0;
        } else if (tz.match(/^\+\d{4}$/)) {
          const offsetStr = tz.substring(1);
          const offsetH = parseInt(offsetStr.substring(0, 2), 10);
          const offsetM = parseInt(offsetStr.substring(2, 4), 10);
          offsetMs = (offsetH * 60 + offsetM) * 60 * 1000;
        } else if (tz.match(/^\-\d{4}$/)) {
          const offsetStr = tz.substring(1);
          const offsetH = parseInt(offsetStr.substring(0, 2), 10);
          const offsetM = parseInt(offsetStr.substring(2, 4), 10);
          offsetMs = -((offsetH * 60 + offsetM) * 60 * 1000);
        }
        date = new Date(Date.UTC(y, month, d, h, m, s) - offsetMs);
      } else {
        // Assume UTC if no timezone
        date = new Date(Date.UTC(y, month, d, h, m, s));
      }

      if (!isNaN(date.getTime())) {
        return {
          valid: true,
          date,
          rawPublishedAt: trimmed,
          timeSourceField,
          timeParseNote: tz ? `parsed as RFC 2822 with timezone ${tz}` : "parsed as RFC 2822, assumed UTC",
        };
      }
    }
  }

  // Unparseable
  return { valid: false, rawPublishedAt: trimmed, reason: "invalid" };
}
