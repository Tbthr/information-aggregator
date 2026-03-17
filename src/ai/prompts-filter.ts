/**
 * AI 过滤判断相关的 Prompts
 * 用于判断条目是否值得保留在 Pack 中
 */

/**
 * 待过滤条目信息
 */
export interface FilterItem {
  /** 条目索引（用于定位） */
  index: number;
  /** 标题 */
  title: string;
  /** 摘要/片段 */
  snippet: string;
  /** 原始链接 */
  url: string;
}

/**
 * Pack 上下文信息
 */
export interface PackContext {
  /** Pack 名称 */
  name: string;
  /** Pack 关键词/主题 */
  keywords: string[];
  /** Pack 描述（可选） */
  description?: string;
}

// 输入限制常量
const MAX_ITEMS_COUNT = 20;
const MAX_SNIPPET_LENGTH = 300;

/**
 * 构建过滤判断 prompt
 * 让 AI 判断每个条目是否值得保留
 */
export function buildFilterPrompt(items: FilterItem[], packContext: PackContext): string {
  // 输入验证和截断
  const safeItems = items
    .slice(0, MAX_ITEMS_COUNT)
    .map(item => ({
      ...item,
      snippet: item.snippet.length > MAX_SNIPPET_LENGTH
        ? item.snippet.slice(0, MAX_SNIPPET_LENGTH) + "..."
        : item.snippet,
    }));

  const itemsText = safeItems
    .map((item, i) => `[${i}] 标题: ${item.title}\n    摘要: ${item.snippet}\n    链接: ${item.url}`)
    .join("\n\n");

  const keywordsText = packContext.keywords.join("、");
  const descText = packContext.description ? `\n描述: ${packContext.description}` : "";

  return `你是信息筛选专家，需要判断以下条目是否值得保留在 "${packContext.name}" Pack 中。

Pack 信息:
- 名称: ${packContext.name}
- 关注关键词: ${keywordsText}${descText}

待判断条目列表:
${itemsText}

请对每个条目进行判断:
1. keep: 是否保留该条目（true/false）
2. reason: 保留/丢弃的简短理由（20字以内）
3. benefit: 如果保留，说明对读者的价值（30字以内，可选）
4. hint: 如果保留，提供阅读提示帮助理解（20字以内，可选）

判断标准:
- 与 Pack 主题高度相关的条目应保留
- 信息价值高、有独特见解的条目应保留
- 重复、低质量、过时或主题无关的条目应丢弃

请严格按以下 JSON 格式返回（不要添加其他文字）:
{
  "judgments": [
    {
      "index": 0,
      "keep": true,
      "reason": "<保留/丢弃理由>",
      "benefit": "<读者价值，可选>",
      "hint": "<阅读提示，可选>"
    },
    {
      "index": 1,
      "keep": false,
      "reason": "<保留/丢弃理由>"
    }
  ]
}`;
}
