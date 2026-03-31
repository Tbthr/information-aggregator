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

// ============================================================
// Quadrant Classification (daily report)
// ============================================================

export const QUADRANT_PROMPT = `你是一位信息分类分析师。请将以下内容分配到对应的象限。

象限定义：
- 尝试：贴近工作、时效性强的内容（近+热点/趋势），适合快速尝试
- 深度：贴近工作、经典/系统性内容（近+经典），适合深入研究
- 地图感：与工作有距离但有参考价值（远+趋势/经典），扩展视野

分类标准：
- 生产力距离：内容与"你当前工作"的距离（近=直接相关，中=间接相关，远=噪音/八卦）
- 保鲜期：内容过时速度（热点=突发新闻，中=趋势变化，远=经典教程）
- 象限 = 生产力距离 × 保鲜期 组合

请以 JSON 格式输出：
{
  "quadrant": "尝试" | "深度" | "地图感",
  "reason": "分类理由"
}`

export function parseQuadrantResult(raw: string): { quadrant: '尝试' | '深度' | '地图感'; reason: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (['尝试', '深度', '地图感'].includes(parsed.quadrant)) {
      return parsed
    }
  } catch { /* ignore */ }
  return null
}

// ============================================================
// Topic Summary (with few-shot example)
// ============================================================

export const TOPIC_SUMMARY_PROMPT = `你是一位专业的信息分析师。请分析以下话题下的内容，生成一段话题摘要和核心要点。

要求：
1. 话题摘要：提炼该话题的核心信息和关键趋势，100-200字
2. 核心要点：列出该话题最重要的 2-5 个要点，每个要点用一句话概括
3. 不要简单罗列内容标题，要综合分析提炼
4. 用中文撰写

请以 JSON 格式输出：
{
  "summary": "话题摘要文本",
  "keyPoints": ["要点1", "要点2", "要点3"]
}

示例：
{
  "summary": "本周 AI 编程领域迎来多项重磅更新，Claude 4 在复杂推理任务上超越 GPT-4，GitHub Copilot 新增自然语言代码重构功能，各家 IDE 纷纷集成 AI 辅助开发能力。",
  "keyPoints": [
    "Claude 4 发布，多模态能力大幅提升",
    "GitHub Copilot Enterprise 支持自然语言代码重构",
    "Cursor 集成新 AI 模型，代码补全延迟降低 40%"
  ]
}`

export function parseTopicSummaryResult(raw: string): { summary: string; keyPoints: string[] } | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.summary && Array.isArray(parsed.keyPoints)) {
      return parsed
    }
  } catch { /* ignore */ }
  return null
}

// ============================================================
// Topic Clustering (daily report - group articles into topics)
// ============================================================

export interface TopicCluster {
  title: string
  summary: string
  keyPoints: string[]
  articleIndexes: number[]
}

export interface TopicClusterResult {
  topics: TopicCluster[]
}

export const TOPIC_CLUSTER_PROMPT = `你是一位专业的信息分析师。请将以下内容列表分成多个话题组。

要求：
1. 分成 2-5 个话题，每个话题内的内容应该高度相关
2. 每条内容只能属于一个话题
3. 不要遗漏重要内容
4. 话题标题简洁有力（中文，10字以内）
5. 每个话题需要生成：
   - 话题摘要：提炼该话题的核心信息和关键趋势，100-200字
   - 核心要点：列出该话题最重要的 2-5 个要点
6. 用中文撰写

请以 JSON 格式输出：
{
  "topics": [
    {
      "title": "话题标题",
      "summary": "话题摘要",
      "keyPoints": ["要点1", "要点2"],
      "articleIndexes": [0, 2, 5]
    }
  ]
}`

export function parseTopicClusterResult(raw: string): TopicClusterResult | null {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.topics)) {
      return parsed as TopicClusterResult
    }
  } catch { /* ignore */ }
  return null
}
