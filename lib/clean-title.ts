/**
 * 共用标题清洗工具函数
 */

/**
 * 清除 Markdown 格式中的标题无关字符
 * 用于：hexi、clawfeed 等 Markdown 来源
 * - 移除空链接 [](url)
 * - 移除 [text](url) 链接格式，保留文字
 * - 移除 **bold** 标记，保留内容
 * - 移除 emoji prefix（☀️🔥📰 等）
 * - 折叠多余空白
 */
export function cleanMarkdownTitle(raw: string): string {
  return raw
    .replace(/\[\]\([^)]+\)/g, '')       // 空链接 [](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\*\*/g, '')                // **bold** → bold
    .replace(/^[☀️🔥📰\s]+/, '')          // 移除 emoji prefix
    .replace(/\s+/g, ' ')                // 折叠空白
    .trim();
}

/**
 * 清除 HTML/SVG 标签
 * 用于：GitHub Trending 等 HTML 来源
 */
export function cleanHtmlTitle(raw: string): string {
  return raw
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
