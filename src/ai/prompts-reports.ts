// ============================================================
// Types
// ============================================================

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
// Pick Reason (weekly picks)
// ============================================================

export function buildPickReasonPrompt(
  title: string,
  summary: string,
  prompt: string
): string {
  const safePrompt = prompt ?? ""
  return `${safePrompt}\n\n---\n\n文章标题：${title}\n文章摘要：${summary}`
}

export function parsePickReasonResult(text: string): PickReasonResult {
  const reason = text.trim()
  return { reason: reason || "内容精选" }
}

// ============================================================
// Weekly Editorial (Step 2)
// ============================================================

export function buildEditorialPrompt(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  topItems: { title: string; summary: string }[],
  prompt: string
): string {
  const safePrompt = prompt ?? ""
  const topicSection = topicSummaries
    .map((t) => `【${t.date} ${t.dayLabel}】${t.title}: ${t.summary}`)
    .join("\n\n")
  const itemSection = topItems
    .map((item) => `- ${item.title}: ${item.summary}`)
    .join("\n")

  return `${safePrompt}\n\n---\n\n本周话题摘要：\n\n${topicSection}\n\n近期重要文章：\n${itemSection}`
}

export function parseEditorialResult(text: string): EditorialResult {
  return { editorial: text.trim() }
}
