/**
 * Daily Brief 视图相关的 AI Prompts
 */

// 输入限制常量
const MAX_CONTENT_LENGTH = 8000;
const MAX_DESCRIPTIONS_COUNT = 10;

/**
 * 构建 Daily Brief 单篇文章增强 prompt
 * 基于文章标题 + 全文内容生成描述、推荐理由和标签
 */
export function buildArticleEnrichPrompt(title: string, content: string): string {
  // 截断过长的内容
  const safeContent = content.length > MAX_CONTENT_LENGTH
    ? content.slice(0, MAX_CONTENT_LENGTH) + "..."
    : content;

  return `你是技术新闻编辑。请分析以下文章，生成简要描述、推荐理由和标签。

文章标题：${title}

文章内容：
${safeContent}

请提供：
1. 一句话描述（50字以内，概括文章核心内容）
2. 为什么值得关注（100字以内，说明这篇文章的价值）
3. 3-5个标签（与文章主题相关的关键词）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "description": "<一句话描述>",
  "whyMatters": "<为什么值得关注>",
  "tags": ["<标签1>", "<标签2>", "<标签3>"]
}`;
}

/**
 * 构建 Daily Brief 整体概览 prompt
 * 基于所有文章的一句话描述生成整体摘要和看点
 */
export function buildDailyBriefOverviewPrompt(descriptions: string[]): string {
  // 输入验证和截断
  const safeDescriptions = descriptions
    .slice(0, MAX_DESCRIPTIONS_COUNT)
    .map((d, i) => `${i + 1}. ${d}`);

  const descriptionsText = safeDescriptions.join("\n");

  return `你是技术新闻编辑。请基于以下今日热门文章的描述，生成整体概览。

文章描述列表：
${descriptionsText}

请提供：
1. 整体摘要（2-3句话，概括今日技术社区的主要动态）
2. 今日看点（3-5个看点，每个看点一句话）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "summary": "<整体摘要>",
  "highlights": ["<看点1>", "<看点2>", "<看点3>"]
}`;
}

/**
 * 解析文章增强结果
 */
export function parseArticleEnrichResult(text: string): {
  description: string;
  whyMatters: string;
  tags: string[];
} | null {
  try {
    // 尝试提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed.description !== "string" ||
      typeof parsed.whyMatters !== "string" ||
      !Array.isArray(parsed.tags)
    ) {
      return null;
    }

    return {
      description: parsed.description,
      whyMatters: parsed.whyMatters,
      tags: (parsed.tags as string[]).filter((t): t is string => typeof t === "string"),
    };
  } catch {
    return null;
  }
}

/**
 * 解析整体概览结果
 */
export function parseDailyBriefOverviewResult(text: string): {
  summary: string;
  highlights: string[];
} | null {
  try {
    // 尝试提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.highlights)
    ) {
      return null;
    }

    return {
      summary: parsed.summary,
      highlights: (parsed.highlights as string[]).filter((h): h is string => typeof h === "string"),
    };
  } catch {
    return null;
  }
}
