/**
 * 日报和周报相关的 AI Prompts
 */

// ============ 日报 Prompts ============

/**
 * 构建日报概览 prompt
 */
export function buildDailyOverviewPrompt(items: Array<{ title: string; summary?: string | null }>): string {
  const itemList = items
    .map((item, i) => `${i + 1}. ${item.title}${item.summary ? `: ${item.summary.slice(0, 100)}` : ""}`)
    .join("\n");

  return `你是技术新闻编辑。请基于以下今日热门文章，生成日报概览。

今日文章列表：
${itemList}

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
 * 解析日报概览结果
 */
export function parseDailyOverviewResult(text: string): {
  summary: string;
  highlights: string[];
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.highlights)) {
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

// ============ 周报 Prompts ============

/**
 * 构建周报编辑评述 prompt
 */
export function buildWeeklyEditorialPrompt(
  timelineEvents: Array<{ date: string; dayLabel: string; title: string }>,
): string {
  const eventList = timelineEvents
    .map((e) => `- ${e.dayLabel} (${e.date}): ${e.title}`)
    .join("\n");

  return `你是技术新闻主编。请基于本周技术动态，撰写周报编辑评述。

本周技术动态：
${eventList}

请提供：
1. 周标题（一句话概括本周核心主题，不超过20字）
2. 周副标题（补充说明，不超过50字）
3. 编辑评述（200字以内，分析本周技术趋势和重要事件）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "headline": "<周标题>",
  "subheadline": "<周副标题>",
  "editorial": "<编辑评述>"
}`;
}

/**
 * 解析周报编辑评述结果
 */
export function parseWeeklyEditorialResult(text: string): {
  headline: string;
  subheadline: string;
  editorial: string;
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.subheadline !== "string" ||
      typeof parsed.editorial !== "string"
    ) {
      return null;
    }

    return {
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      editorial: parsed.editorial,
    };
  } catch {
    return null;
  }
}

/**
 * 构建时间线事件标题 prompt
 */
export function buildTimelineEventPrompt(
  items: Array<{ title: string; summary?: string | null }>,
  dayLabel: string,
): string {
  const itemList = items
    .map((item, i) => `${i + 1}. ${item.title}`)
    .join("\n");

  return `你是技术新闻编辑。请为以下今日技术动态生成一个简洁的标题和摘要。

日期：${dayLabel}

今日动态：
${itemList}

请提供：
1. 今日标题（一句话概括今日核心主题，不超过15字）
2. 今日摘要（100字以内）

请严格按以下 JSON 格式返回（不要添加其他文字）：
{
  "title": "<今日标题>",
  "summary": "<今日摘要>"
}`;
}

/**
 * 解析时间线事件结果
 */
export function parseTimelineEventResult(text: string): {
  title: string;
  summary: string;
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (typeof parsed.title !== "string" || typeof parsed.summary !== "string") {
      return null;
    }

    return {
      title: parsed.title,
      summary: parsed.summary,
    };
  } catch {
    return null;
  }
}
