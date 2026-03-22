import type { Item, Tweet } from "@prisma/client"

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
// Default Prompts
// ============================================================

export const DEFAULT_TOPIC_PROMPT = `你是一位专业的信息分析师。请将以下内容列表按照话题进行聚类分组。

要求：
1. 分成 5-10 个话题
2. 每个话题内的内容应该高度相关
3. 每条内容只能属于一个话题
4. 不要遗漏重要内容
5. 话题标题简洁有力（中文，10字以内）

请以 JSON 格式输出：
{
  "topics": [
    {
      "title": "话题标题",
      "itemIndexes": [0, 1, 2],
      "tweetIndexes": []
    }
  ]
}`

export const DEFAULT_TOPIC_SUMMARY_PROMPT = `你是一位专业的信息分析师。请为以下话题下的内容生成一段综合总结。

要求：
1. 总结应该提炼核心信息和关键趋势
2. 200-400字
3. 用中文撰写
4. 不要简单罗列，要综合分析

请直接输出总结文本，不要包含 JSON 格式或额外标记。`

export const DEFAULT_PICK_REASON_PROMPT = `你是一位专业的内容策展人。请说明为什么这篇文章值得阅读。

要求：
1. 50-100字
2. 突出文章的独特价值或重要信息
3. 用中文撰写

请直接输出推荐理由，不要包含 JSON 格式。`

export const DEFAULT_FILTER_PROMPT = `你是一位信息过滤专家。请根据以下规则判断哪些内容值得保留。

请以 JSON 格式输出：
{
  "keep": [0, 2, 5],
  "discard": [1, 3, 4]
}

keep 和 discard 中的数字是原始内容列表的索引。`

export const DEFAULT_EDITORIAL_PROMPT = `你是一位资深的行业分析师。请基于本周各日的话题摘要和重点文章，撰写一篇有深度的周总结。

要求：
1. 500-1000字
2. 识别跨日趋势和关键转折点
3. 分析本周最重要的事件及其影响
4. 用中文撰写
5. 使用编辑语调，避免过于技术化

请直接输出周总结文本。`

export const DEFAULT_WEEKLY_PICK_REASON_PROMPT = `你是一位资深的内容策展人。请说明为什么这篇文章值得在本周深入阅读。

要求：
1. 80-150字
2. 说明文章的深度价值和对读者的意义
3. 用中文撰写

请直接输出推荐理由。`

export const DEFAULT_DAILY_PICK_REASON_PROMPT = DEFAULT_PICK_REASON_PROMPT

// ============================================================
// Topic Clustering (Step 3)
// ============================================================

export function buildTopicClusteringPrompt(
  items: TopicClusterItem[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_TOPIC_PROMPT
  const contentList = items
    .map((item, i) => `[${i}] [${item.type === "item" ? "文章" : "推文"}] ${item.title}\n    ${item.summary}`)
    .join("\n\n")

  return `${systemPrompt}\n\n---\n\n以下是需要分类的内容列表：\n\n${contentList}`
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
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_TOPIC_SUMMARY_PROMPT
  const contentList = contents
    .map((c) => `- [${c.type === "item" ? "文章" : "推文"}] ${c.title}: ${c.summary}`)
    .join("\n")

  return `${systemPrompt}\n\n---\n\n话题：${topicTitle}\n\n该话题下的内容：\n${contentList}`
}

export function parseTopicSummaryResult(text: string): TopicSummaryResult {
  return { summary: text.trim() }
}

// ============================================================
// Pick Reason (Step 4b)
// ============================================================

export function buildPickReasonPrompt(
  title: string,
  summary: string,
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_DAILY_PICK_REASON_PROMPT
  return `${systemPrompt}\n\n---\n\n文章标题：${title}\n文章摘要：${summary}`
}

export function parsePickReasonResult(text: string): PickReasonResult {
  return { reason: text.trim() }
}

// ============================================================
// AI Filter (Step 2, optional)
// ============================================================

export function buildFilterPrompt(
  items: TopicClusterItem[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_FILTER_PROMPT
  const contentList = items
    .map((item, i) => `[${i}] [${item.type === "item" ? "文章" : "推文"}] ${item.title}\n    ${item.summary}`)
    .join("\n\n")

  return `${systemPrompt}\n\n---\n\n以下是需要过滤的内容列表：\n\n${contentList}`
}

export function parseFilterResult(text: string): { keep: number[]; discard: number[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI response does not contain valid JSON for filtering")
  return JSON.parse(jsonMatch[0])
}

// ============================================================
// Weekly Editorial (Step 2)
// ============================================================

export function buildEditorialPrompt(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  topItems: { title: string; summary: string; score: number }[],
  customPrompt?: string | null
): string {
  const systemPrompt = customPrompt || DEFAULT_EDITORIAL_PROMPT
  const topicSection = topicSummaries
    .map((t) => `【${t.date} ${t.dayLabel}】${t.title}: ${t.summary}`)
    .join("\n\n")
  const itemSection = topItems
    .map((item) => `- [${item.score}分] ${item.title}: ${item.summary}`)
    .join("\n")

  return `${systemPrompt}\n\n---\n\n本周话题摘要：\n\n${topicSection}\n\n本周高分文章：\n${itemSection}`
}

export function parseEditorialResult(text: string): EditorialResult {
  return { editorial: text.trim() }
}
