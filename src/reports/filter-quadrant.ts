import type { ReportCandidate } from "../types/index.js"

export type Quadrant = "噪音" | "地图感" | "尝试" | "深度"

export interface CandidateWithDistance {
  candidate: ReportCandidate
  distance: "近" | "中" | "远"
}

export interface CandidateWithFreshness {
  candidate: ReportCandidate
  freshness: "热点" | "趋势" | "经典"
}

export function getQuadrant(
  distance: CandidateWithDistance["distance"],
  freshness: CandidateWithFreshness["freshness"]
): Quadrant {
  const isFar = distance === "远"
  const isHot = freshness === "热点"

  if (isFar && isHot) return "噪音"
  if (isFar) return "地图感"
  if (freshness === "经典") return "深度"
  return "尝试"
}

/**
 * 左下角噪音过滤：远 + 热点 → 丢弃
 * 其他象限保留
 */
export function filterByQuadrant(
  candidatesWithDistance: CandidateWithDistance[],
  allCandidatesWithFreshness: CandidateWithFreshness[]
): CandidateWithDistance[] {
  const freshnessMap = new Map(
    allCandidatesWithFreshness.map(({ candidate, freshness }) => [candidate.id, freshness])
  )

  return candidatesWithDistance.filter(({ candidate, distance }) => {
    const freshness = freshnessMap.get(candidate.id) ?? "趋势"
    const quadrant = getQuadrant(distance, freshness)
    return quadrant !== "噪音"
  })
}
