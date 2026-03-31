import type { CandidateWithDistance } from "./classify-productivity"
import type { CandidateWithFreshness } from "./classify-freshness"
import type { DigestTopic } from "@prisma/client"
import { getQuadrant } from "./filter-quadrant"

export interface DistributionStats {
  quadrant: Record<string, number>
  freshness: Record<string, number>
  productivity: Record<string, number>
  inputCount: number
  filteredCount: number
  topicCount: number
}

export function logDistribution(
  allCandidates: (CandidateWithDistance & CandidateWithFreshness)[],
  filteredCandidates: CandidateWithDistance[],
  finalTopics: DigestTopic[]
): void {
  const quadrantCounts: Record<string, number> = { 噪音: 0, 地图感: 0, 尝试: 0, 深度: 0 }
  const freshnessCounts: Record<string, number> = { 热点: 0, 趋势: 0, 经典: 0 }
  const productivityCounts: Record<string, number> = { 近: 0, 中: 0, 远: 0 }

  for (const c of allCandidates) {
    const quadrant = getQuadrant(c.distance, c.freshness)
    quadrantCounts[quadrant]++
    freshnessCounts[c.freshness]++
    productivityCounts[c.distance]++
  }

  console.log("[daily-report] 分布统计:")
  console.log(`  象限分布: ${JSON.stringify(quadrantCounts)}`)
  console.log(`  保鲜期:   ${JSON.stringify(freshnessCounts)}`)
  console.log(`  生产力:   ${JSON.stringify(productivityCounts)}`)
  console.log(`  输入候选: ${allCandidates.length} → 过滤后: ${filteredCandidates.length} → 最终topics: ${finalTopics.length}`)
}
