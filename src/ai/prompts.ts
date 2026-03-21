export function buildCandidateQualityPrompt(title: string, content = ""): string {
  return `Score the information value of this candidate.\nTitle: ${title}\nContent: ${content}`;
}

export function buildClusterSummaryPrompt(title: string, items: string[]): string {
  return `Summarize the cluster titled "${title}" using these items:\n- ${items.join("\n- ")}`;
}

export function buildDigestNarrationPrompt(highlights: string[]): string {
  return `Write a concise digest narration for:\n- ${highlights.join("\n- ")}`;
}

// X 专用 AI Prompts

interface XEngagement {
  score?: number; // 点赞数 (likeCount)
  comments?: number; // 回复数 (replyCount)
  reactions?: number; // 转发数 (retweetCount)
}

/**
 * 构建 X 帖子评分 prompt，用于评估帖子质量
 */
export function buildXPostScorePrompt(
  title: string,
  content: string,
  engagement?: XEngagement,
  author?: string,
): string {
  const engagementInfo = engagement
    ? `\n互动数据: 点赞 ${engagement.score ?? 0} / 回复 ${engagement.comments ?? 0} / 转发 ${engagement.reactions ?? 0}`
    : "";
  const authorInfo = author ? `\n作者: @${author}` : "";

  return `你是一个社交媒体内容质量评估专家。请对以下 X/Twitter 帖子进行质量评分。

标题: ${title}
内容: ${content.slice(0, 500)}${content.length > 500 ? "..." : ""}${authorInfo}${engagementInfo}

请从以下维度评估（各 1-10 分）：
1. 信息价值：内容是否提供有价值的信息、见解或新闻
2. 原创性：是否为原创观点而非简单转发或复制
3. 时效性：内容是否具有时效价值
4. 可读性：表达是否清晰、有逻辑

请仅返回一个 JSON 对象，格式如下：
{"score": <1-10的总分>, "reason": "<一句话评价>"}`;
}

/**
 * 构建 X 帖子摘要 prompt，生成 50 字内中文摘要
 */
export function buildXPostSummaryPrompt(title: string, content: string): string {
  return `请为以下 X/Twitter 帖子生成一个简洁的中文摘要。

标题: ${title}
内容: ${content.slice(0, 300)}${content.length > 300 ? "..." : ""}

要求：
1. 摘要控制在 50 字以内
2. 突出核心信息或观点
3. 使用简洁的书面语

请直接输出摘要文本，不要添加任何其他内容。`;
}

/**
 * 构建今日看点摘要 prompt（X 专用版本）
 */
export function buildDigestNarrationPromptX(items: string[]): string {
  return `你是科技资讯编辑，请为以下 X/Twitter 帖子撰写今日看点摘要。

帖子列表：
${items.map((item, i) => `${i + 1}. ${item}`).join("\n")}

要求：
1. 用流畅的中文撰写 2-3 段摘要
2. 提炼共性主题和亮点
3. 适合快速了解今日社交媒体热点
4. 总字数控制在 200 字以内

请直接输出摘要内容。`;
}

/**
 * 构建选题建议 prompt，基于 X 帖子生成内容选题建议
 */
export function buildTopicSuggestionPrompt(items: string[]): string {
  return `你是内容策划专家，请基于以下 X/Twitter 热门帖子生成选题建议。

热门帖子：
${items.map((item, i) => `[${i + 1}] ${item}`).join("\n")}

要求：
1. 分析帖子中的热点话题和趋势
2. 提出 3-5 个可以深入报道或创作的选题方向
3. 每个选题需要标注来源帖子的序号（sourceIndices 数组）
4. 用中文回答

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "suggestions": [
    {
      "title": "<吸引人的选题标题>",
      "description": "<选题角度说明，包含为什么这个选题值得做>",
      "sourceIndices": [<来源帖子序号，从1开始>]
    },
    {
      "title": "<第二个选题标题>",
      "description": "<角度说明>",
      "sourceIndices": [1, 3]
    }
  ]
}`;
}
