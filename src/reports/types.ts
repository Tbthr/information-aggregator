/**
 * 日报模块的类型定义
 */

/**
 * Digest 来源的原始条目（从 RSS content 提取）
 */
export interface DigestItem {
  id: string
  sourceId: string
  sourceName: string
  title: string
  content: string   // 原始正文内容
  url: string
  publishedAt?: string
}

/**
 * AI 分类后的要点
 */
export interface DigestBulletPoint {
  text: string
  source?: string
}

/**
 * 按主题分组的 Digest 内容
 */
export interface DigestGroup {
  topic: string
  items: DigestBulletPoint[]
}

/**
 * AI 生成的完整 Digest 结果
 */
export interface DigestResult {
  summary: string
  groups: DigestGroup[]
}

/**
 * 日报最终数据结构（用于 Markdown 渲染）
 */
export interface DailyReportSections {
  date: string
  dateLabel: string
  digest?: {
    summary: string
    groups: DigestGroup[]
  }
  articles: ArticleForReport[]
}

export interface ArticleForReport {
  title: string
  url: string
  sourceName: string
}
