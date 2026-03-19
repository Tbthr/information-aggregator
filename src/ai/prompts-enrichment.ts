/**
 * 深度 Enrichment 相关的 AI Prompts
 * 用于基于完整正文内容的质量评分、关键点提取、标签生成等
 */

/**
 * 基于完整正文的质量评分 prompt
 * 用于评估文章/页面的信息价值和质量
 */
export function buildDeepQualityPrompt(title: string, content: string, url?: string): string {
  const urlInfo = url ? `\n链接: ${url}` : "";
  // 限制内容长度以控制 token 使用
  const truncatedContent = content.length > 4000
    ? content.slice(0, 4000) + "..."
    : content;

  return `你是一个内容质量评估专家。请对以下文章进行质量评分。

标题: ${title}${urlInfo}

正文内容:
${truncatedContent}

请从以下维度评估（各 1-10 分）：
1. 信息价值：内容是否提供有价值的信息、见解或知识
2. 原创性：是否为原创内容或独特视角
3. 完整性：内容是否完整、深入
4. 准确性：内容是否准确、可信
5. 可读性：表达是否清晰、有逻辑

请仅返回一个 JSON 对象，格式如下：
{"score": <1-10的总分,保留一位小数>, "reason": "<一句话评价，不超过50字>"}`;
}

/**
 * 关键点提取 prompt
 * 从文章中提取 3-5 个关键要点
 */
export function buildKeyPointsPrompt(title: string, content: string, maxPoints = 5): string {
  const truncatedContent = content.length > 3000
    ? content.slice(0, 3000) + "..."
    : content;

  return `你是内容分析专家。请从以下文章中提取 ${maxPoints} 个关键要点。

标题: ${title}

正文内容:
${truncatedContent}

要求：
1. 提取文章的核心观点和关键信息
2. 每个要点用一句话概括，控制在 30 字以内
3. 按重要性排序
4. 使用中文

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "keyPoints": [
    "<第一个关键要点>",
    "<第二个关键要点>",
    "<第三个关键要点>"
  ]
}`;
}

/**
 * 标签生成 prompt
 * 基于文章内容自动生成标签
 */
export function buildTaggingPrompt(title: string, content: string, maxTags = 5): string {
  const truncatedContent = content.length > 2000
    ? content.slice(0, 2000) + "..."
    : content;

  return `你是内容分类专家。请为以下文章生成 ${maxTags} 个标签。

标题: ${title}

正文内容:
${truncatedContent}

要求：
1. 标签应该反映文章的主题、领域、技术栈或关键概念
2. 优先使用技术术语、行业术语
3. 每个标签 2-6 个字
4. 标签之间应该有区分度
5. 使用中文

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "tags": [
    "<标签1>",
    "<标签2>",
    "<标签3>"
  ]
}`;
}

/**
 * 内容摘要 prompt
 * 基于完整正文生成摘要
 */
export function buildSummaryPrompt(title: string, content: string, maxLength = 150): string {
  const truncatedContent = content.length > 3000
    ? content.slice(0, 3000) + "..."
    : content;

  return `你是内容摘要专家。请为以下文章生成摘要。

标题: ${title}

正文内容:
${truncatedContent}

要求：
1. 摘要应该概括文章的核心内容和观点
2. 控制在 ${maxLength} 字以内
3. 使用简洁的书面语
4. 使用中文

请直接输出摘要内容，不要添加任何其他内容。`;
}

/**
 * 多维评分 prompt
 * 从相关性、质量、时效性三个维度评估内容
 */
export function buildMultiDimensionalScorePrompt(title: string, content: string, url?: string): string {
  const urlInfo = url ? `\n链接: ${url}` : "";
  const truncatedContent = content.length > 4000
    ? content.slice(0, 4000) + "..."
    : content;

  return `你是一个内容质量评估专家。请从三个维度对以下文章进行评分。

标题: ${title}${urlInfo}

正文内容:
${truncatedContent}

评分维度说明：
1. 相关性（relevance）：内容与 AI/技术领域相关的程度
   - 1-3: 不太相关
   - 4-6: 一般相关
   - 7-10: 高度相关

2. 质量（quality）：内容的信息价值、原创性、深度
   - 1-3: 低质量，信息量少
   - 4-6: 中等质量，有一定价值
   - 7-10: 高质量，有深度见解

3. 时效性（timeliness）：内容的时效价值和长期价值
   - 1-3: 过时或短期价值
   - 4-6: 有一定时效价值
   - 7-10: 长期有价值或当前热点

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "relevance": <1-10>,
  "quality": <1-10>,
  "timeliness": <1-10>,
  "total": <加权总分，计算公式: relevance*0.3 + quality*0.5 + timeliness*0.2，保留一位小数>,
  "reason": "<一句话评价，不超过50字>"
}`;
}

/**
 * 统一 AI 增强 prompt
 * 生成摘要、核心要点和分类标签
 */
export function buildComprehensiveEnrichmentPrompt(
  title: string,
  content: string,
): string {
  const truncatedContent = content.length > 4000
    ? content.slice(0, 4000) + "..."
    : content;

  return `请分析以下文章，生成结构化的增强数据。

## 输入
标题：${title}
正文：${truncatedContent}

## 输出要求
请以 JSON 格式输出，包含以下字段：

1. **summary** (string): 100-150字概述，提炼核心观点
2. **bullets** (string[]): 3-5个核心要点，每个不超过50字
3. **categories** (string[]): 1-3个最合适的分类标签，自行判断

## 输出格式
\`\`\`json
{
  "summary": "...",
  "bullets": ["...", "...", "..."],
  "categories": ["...", "..."]
}
\`\`\`

只输出 JSON，不要其他内容。`;
}
