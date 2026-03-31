import type { ReportCandidate } from "@/src/types/index"

export type ProductivityDistance = "近" | "中" | "远"

export interface CandidateWithDistance {
  candidate: ReportCandidate
  distance: ProductivityDistance
  distanceSignals: string[]  // 用于日志：哪些信号判定为该距离
}

const PRODUCTIVITY_KEYWORDS = {
  近: ["开发", "教程", "实战", "代码", "编程", "架构", "API", "SDK", "Bug", "修复"],
  中: ["趋势", "分析", "行业", "竞品", "市场"],
  远: ["融资", "并购", "高管", "战略", "宫斗", "估值", "IPO", "财报", "八卦"],
}

/**
 * 综合判断内容与生产力的距离
 * - 来源类型：HN/Reddit 热帖 → 中/远；官方博客/论文 → 近
 * - 关键词匹配
 */
export function classifyProductivityDistance(
  candidates: ReportCandidate[]
): CandidateWithDistance[] {
  return candidates.map((candidate) => {
    const signals: string[] = []
    let score = 0

    // 来源类型判断
    const sourceKind = candidate.sourceKind
    if (sourceKind === "website") {
      score += 1
      signals.push(`sourceKind:${sourceKind}=近`)
    } else if (sourceKind === "hn" || sourceKind === "reddit") {
      score -= 0.5
      signals.push(`sourceKind:${sourceKind}=中/远`)
    }

    // 标题 + summary 文本
    const text = ((candidate.title ?? "") + " " + (candidate.summary ?? "")).toLowerCase()

    // 近距离关键词
    for (const kw of PRODUCTIVITY_KEYWORDS.近) {
      if (text.includes(kw)) {
        score += 1
        signals.push(`近:${kw}`)
      }
    }

    // 远距离关键词
    for (const kw of PRODUCTIVITY_KEYWORDS.远) {
      if (text.includes(kw)) {
        score -= 2
        signals.push(`远:${kw}`)
      }
    }

    // 中距离关键词（轻微加成）
    for (const kw of PRODUCTIVITY_KEYWORDS.中) {
      if (text.includes(kw)) {
        score += 0.5
        signals.push(`中:${kw}`)
      }
    }

    // 判定
    let distance: ProductivityDistance
    if (score >= 1) {
      distance = "近"
    } else if (score <= -1) {
      distance = "远"
    } else {
      distance = "中"
    }

    return { candidate, distance, distanceSignals: signals }
  })
}
