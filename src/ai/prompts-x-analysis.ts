/**
 * X Analysis 视图相关的 AI Prompts
 */

// 输入限制常量
const MAX_CONTENT_LENGTH = 8000;

/**
 * 构建 X Analysis 单篇帖子摘要 prompt
 * 基于帖子标题 + 全文内容生成摘要和标签
 */
export function buildPostSummaryPrompt(title: string, content: string): string {
  // 截断过长的内容
  const safeContent = content.length > MAX_CONTENT_LENGTH
    ? content.slice(0, MAX_CONTENT_LENGTH) + "..."
    : content;

  return `你是社交媒体分析师。请分析以下 X/Twitter 帖子，生成摘要和标签。

帖子标题：${title}

帖子内容：
${safeContent}

请提供：
1. 摘要（50字以内，概括帖子核心观点）
2. 3-5个标签（与帖子主题相关的关键词）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "summary": "<摘要>",
  "tags": ["<标签1>", "<标签2>", "<标签3>"]
}`;
}

/**
 * 解析帖子摘要结果
 */
export function parsePostSummaryResult(text: string): {
  summary: string;
  tags: string[];
} | null {
  try {
    // 尝试提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.tags)
    ) {
      return null;
    }

    return {
      summary: parsed.summary,
      tags: (parsed.tags as string[]).filter((t): t is string => typeof t === "string"),
    };
  } catch {
    return null;
  }
}
