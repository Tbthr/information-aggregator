/**
 * 趋势洞察相关的 AI Prompts
 * 用于生成每日看点、趋势分析等
 */

// 输入限制常量
const MAX_TITLES_COUNT = 20;
const MAX_TITLE_LENGTH = 500;

/**
 * 构建趋势洞察 prompt
 * 基于 top N 文章标题生成 3-5 句话的趋势总结
 */
export function buildHighlightsPrompt(titles: string[]): string {
  // 输入验证和截断
  const safeTitles = titles
    .slice(0, MAX_TITLES_COUNT)
    .map(t => t.length > MAX_TITLE_LENGTH ? t.slice(0, MAX_TITLE_LENGTH) + "..." : t);

  const titlesText = safeTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return `你是 AI/技术领域的资深分析师。请分析以下今日热门文章，提炼出今日看点。

热门文章列表：
${titlesText}

请提供：
1. 今日趋势总结（3-5 句话，概括今天的重要动态和趋势）
2. 主要趋势（2-3 个关键词或短语）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "summary": "<3-5句话的趋势总结>",
  "trends": ["<趋势1>", "<趋势2>", "<趋势3>"]
}`;
}

/**
 * 构建周报趋势洞察 prompt
 * 基于一周的 top 文章生成周趋势分析
 */
export function buildWeeklyHighlightsPrompt(titles: string[], dateRange: string): string {
  // 输入验证和截断
  const safeTitles = titles
    .slice(0, MAX_TITLES_COUNT)
    .map(t => t.length > MAX_TITLE_LENGTH ? t.slice(0, MAX_TITLE_LENGTH) + "..." : t);

  const titlesText = safeTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return `你是 AI/技术领域的资深分析师。请分析以下本周热门文章，提炼出周报看点。

时间范围：${dateRange}

热门文章列表：
${titlesText}

请提供：
1. 本周趋势总结（5-7 句话，概括本周的重要动态和趋势）
2. 主要趋势（3-5 个关键词或短语）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "summary": "<5-7句话的趋势总结>",
  "trends": ["<趋势1>", "<趋势2>", "<趋势3>", "<趋势4>", "<趋势5>"]
}`;
}
