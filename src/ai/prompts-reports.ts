// ============================================================
// Types
// ============================================================

export interface TopicClusterItem {
  title: string
  summary: string
  type: "item" | "tweet"
  index: number
}

export interface TopicCluster {
  title: string
  itemIndexes: number[]
  tweetIndexes: number[]
}

export interface TopicClusteringResult {
  topics: TopicCluster[]
}

export interface TopicSummaryResult {
  summary: string
}

export interface PickReasonResult {
  reason: string
}

export interface EditorialResult {
  editorial: string
}

// ============================================================
// Topic Clustering (Step 3)
// ============================================================

export function buildTopicClusteringPrompt(
  items: TopicClusterItem[],
  prompt: string
): string {
  const contentList = items
    .map((item, i) => `[${i}] [${item.type === "item" ? "文章" : "推文"}] ${item.title}\n    ${item.summary}`)
    .join("\n\n")

  return `${prompt}\n\n---\n\n以下是需要分类的内容列表：\n\n${contentList}`
}

export function parseTopicClusteringResult(text: string): TopicClusteringResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI response does not contain valid JSON for topic clustering")
  const parsed = JSON.parse(jsonMatch[0])
  return parsed as TopicClusteringResult
}

// ============================================================
// Topic Summary (Step 4a)
// ============================================================

export function buildTopicSummaryPrompt(
  topicTitle: string,
  contents: { title: string; summary: string; type: string }[],
  prompt: string
): string {
  const contentList = contents
    .map((c) => `- [${c.type === "item" ? "文章" : "推文"}] ${c.title}: ${c.summary}`)
    .join("\n")

  return `${prompt}\n\n---\n\n话题：${topicTitle}\n\n该话题下的内容：\n${contentList}`
}

export function parseTopicSummaryResult(text: string): TopicSummaryResult {
  return { summary: text.trim() }
}

// ============================================================
// AI Filter (Step 2, optional)
// ============================================================

export function buildFilterPrompt(
  items: TopicClusterItem[],
  prompt: string
): string {
  const contentList = items
    .map((item, i) => `[${i}] [${item.type === "item" ? "文章" : "推文"}] ${item.title}\n    ${item.summary}`)
    .join("\n\n")

  return `${prompt}\n\n---\n\n以下是需要过滤的内容列表：\n\n${contentList}`
}

export function parseFilterResult(text: string): { keep: number[]; discard: number[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI response does not contain valid JSON for filtering")
  return JSON.parse(jsonMatch[0])
}

// ============================================================
// Pick Reason (weekly picks)
// ============================================================

export function buildPickReasonPrompt(
  title: string,
  summary: string,
  prompt: string
): string {
  return `${prompt}\n\n---\n\n文章标题：${title}\n文章摘要：${summary}`
}

export function parsePickReasonResult(text: string): PickReasonResult {
  return { reason: text.trim() }
}

// ============================================================
// Weekly Editorial (Step 2)
// ============================================================

export function buildEditorialPrompt(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  topItems: { title: string; summary: string; score: number }[],
  prompt: string
): string {
  const topicSection = topicSummaries
    .map((t) => `【${t.date} ${t.dayLabel}】${t.title}: ${t.summary}`)
    .join("\n\n")
  const itemSection = topItems
    .map((item) => `- [${item.score}分] ${item.title}: ${item.summary}`)
    .join("\n")

  return `${prompt}\n\n---\n\n本周话题摘要：\n\n${topicSection}\n\n本周高分文章：\n${itemSection}`
}

export function parseEditorialResult(text: string): EditorialResult {
  return { editorial: text.trim() }
}
