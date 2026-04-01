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
