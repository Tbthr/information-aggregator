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
  /** 摘要 */
  summary: string;
  /** 原始链接 */
  url: string;
}

/**
 * Pack 上下文信息
 */
export interface PackContext {
  /** Pack 名称 */
  name: string;
  /**
   * Pack 主题概述
   * 用于指导 AI 理解 Pack 的关注范围和筛选标准
   * 示例："关注 AI 前沿技术和产品动态，优先深度分析文章"
   */
  description?: string;
}

// 输入限制常量
const MAX_ITEMS_COUNT = 20;
const MAX_SUMMARY_LENGTH = 300;

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
      summary: item.summary.length > MAX_SUMMARY_LENGTH
        ? item.summary.slice(0, MAX_SUMMARY_LENGTH) + "..."
        : item.summary,
    }));

  const itemsText = safeItems
    .map((item, i) => `[${i}] 标题: ${item.title}\n    摘要: ${item.summary}\n    链接: ${item.url}`)
    .join("\n\n");

  // 主题说明部分
  const topicOverviewSection = packContext.description
    ? `- 主题说明: ${packContext.description}`
    : "";

  return `你是信息筛选专家，需要判断以下条目是否值得保留在 "${packContext.name}" Pack 中。

## Pack 主题概述
- 名称: ${packContext.name}
${topicOverviewSection}

## 判断标准

**应该保留**:
- 与 Pack 主题说明高度相关
- 提供有价值的见解、新闻或技术信息
- 内容原创且有深度

**应该过滤**:
- 与 Pack 主题明显无关
- 内容空洞、标题党或低质量
- 重复或信息过时

## 待判断条目列表
${itemsText}

请严格按以下 JSON 格式返回判断结果（不要添加其他文字）:
{
  "judgments": [
    {
      "index": 0,
      "keep": true,
      "reason": "<保留/丢弃理由，20字以内>",
      "benefit": "<读者价值，30字以内，可选>",
      "hint": "<阅读提示，20字以内，可选>"
    },
    {
      "index": 1,
      "keep": false,
      "reason": "<保留/丢弃理由>"
    }
  ]
}`;
}
