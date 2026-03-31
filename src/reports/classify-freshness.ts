import type { ReportCandidate } from "@/src/types/index"

export type FreshnessTier = "热点" | "趋势" | "经典"

export interface CandidateWithFreshness {
  candidate: ReportCandidate
  freshness: FreshnessTier
  freshnessSignals: string[]
}

const FRESHNESS_KEYWORDS = {
  热点: ["发布", "更新", "紧急", "融资", "收购", "上线", "发布日"],
  经典: ["教程", "指南", "原理", "分析", "解读", "详解", "深入", "完全指南", "入门", "一步一步"],
}

/**
 * 综合判断内容的保鲜期
 * - 来源类型：HN/Reddit → 偏短；官方文档/博客 → 偏长
 * - 关键词：热点词 → 短，经典词 → 长
 * - 字数：长文 → 偏经典，短文 → 偏热点
 */
export function classifyFreshness(
  candidates: ReportCandidate[]
): CandidateWithFreshness[] {
  return candidates.map((candidate) => {
    const signals: string[] = []
    let score = 0

    // 来源类型
    const sourceKind = candidate.sourceKind
    if (sourceKind === "hn" || sourceKind === "reddit") {
      score -= 0.5
      signals.push(`sourceKind:${sourceKind}=偏短`)
    } else if (sourceKind === "website") {
      score += 0.5
      signals.push(`sourceKind:${sourceKind}=偏长`)
    }

    // 标题 + summary 文本
    const text = ((candidate.title ?? "") + " " + (candidate.summary ?? "")).toLowerCase()

    // 热点关键词
    for (const kw of FRESHNESS_KEYWORDS.热点) {
      if (text.includes(kw)) {
        score -= 1.5
        signals.push(`热点:${kw}`)
      }
    }

    // 经典关键词
    for (const kw of FRESHNESS_KEYWORDS.经典) {
      if (text.includes(kw)) {
        score += 1.5
        signals.push(`经典:${kw}`)
      }
    }

    // 字数判断（summary 长度）
    const summaryLen = (candidate.summary ?? "").length
    if (summaryLen > 2000) {
      score += 1
      signals.push(`长文:${summaryLen}字`)
    } else if (summaryLen < 300) {
      score -= 1
      signals.push(`短文:${summaryLen}字`)
    }

    // 判定
    let freshness: FreshnessTier
    if (score >= 1) {
      freshness = "经典"
    } else if (score <= -1) {
      freshness = "热点"
    } else {
      freshness = "趋势"
    }

    return { candidate, freshness, freshnessSignals: signals }
  })
}
