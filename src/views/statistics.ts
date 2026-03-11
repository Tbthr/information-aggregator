/**
 * 数据统计和可视化模块
 * 提供分类分布统计、关键词提取、Mermaid 图表生成等功能
 */

/**
 * 分类统计项
 */
export interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
}

/**
 * 关键词统计项
 */
export interface KeywordStat {
  word: string;
  count: number;
}

/**
 * 数据统计
 */
export interface DataStatistics {
  categories: CategoryStat[];
  keywords: KeywordStat[];
  tagCloud: string[];
}

/**
 * 带标签的视图项（用于统计）
 */
export interface TaggedViewItem {
  title: string;
  tags: string[];
  snippet?: string;
}

/**
 * 中文停用词列表
 */
const STOP_WORDS = new Set([
  "的", "是", "在", "了", "和", "与", "或", "这", "那", "有", "也", "都",
  "就", "不", "被", "到", "从", "会", "能", "可以", "我", "你", "他", "她",
  "它", "们", "这个", "那个", "什么", "怎么", "如何", "为什么", "吗", "呢",
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "must", "shall", "can", "need", "dare", "ought", "used",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into",
  "through", "during", "before", "after", "above", "below", "between", "under",
  "and", "but", "or", "nor", "so", "yet", "both", "either", "neither",
  "not", "only", "own", "same", "than", "too", "very", "just", "also",
  "this", "that", "these", "those", "it", "its", "they", "them", "their",
  "he", "him", "his", "she", "her", "we", "us", "our", "you", "your",
  "i", "me", "my", "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
  "all", "each", "every", "any", "some", "no", "none", "more", "most", "other",
]);

/**
 * 从文本中提取关键词
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  // 使用正则分割，保留中文字符、英文单词
  const words = text.toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => {
      if (!w) return false;
      // 过滤停用词
      if (STOP_WORDS.has(w)) return false;
      // 过滤纯数字
      if (/^\d+$/.test(w)) return false;
      // 过滤单个字符（中文除外）
      if (w.length === 1 && !/[\u4e00-\u9fa5]/.test(w)) return false;
      return true;
    });

  return words;
}

/**
 * 计算分类分布统计
 */
export function computeCategoryStats(items: TaggedViewItem[]): CategoryStat[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const total = items.length || 1;
  const stats: CategoryStat[] = [];

  for (const [name, count] of counts) {
    stats.push({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    });
  }

  // 按数量降序排序
  return stats.sort((a, b) => b.count - a.count);
}

/**
 * 计算高频关键词统计
 */
export function computeKeywordStats(items: TaggedViewItem[], topN: number = 10): KeywordStat[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const titleWords = extractKeywords(item.title);
    const snippetWords = extractKeywords(item.snippet ?? "");

    for (const word of [...titleWords, ...snippetWords]) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  // 按频次降序排序，取前 N 个
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  return sorted.map(([word, count]) => ({ word, count }));
}

/**
 * 生成标签云（按权重排序）
 */
export function generateTagCloud(items: TaggedViewItem[]): string[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  // 按频次排序
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1]);

  // 生成标签云字符串，带权重指示
  return sorted.map(([tag, count]) => {
    if (count >= 5) return `**${tag}**`;
    if (count >= 3) return `*${tag}*`;
    return tag;
  });
}

/**
 * 生成 Mermaid 饼图（分类分布）
 */
export function generateMermaidPieChart(categories: CategoryStat[]): string {
  if (categories.length === 0) {
    return "```mermaid\npie showData\n    title 分类分布\n    \"无数据\" : 1\n```";
  }

  const lines: string[] = ["```mermaid", "pie showData", "    title 分类分布"];

  // 取前 8 个分类，避免图表过于复杂
  const topCategories = categories.slice(0, 8);
  for (const cat of topCategories) {
    lines.push(`    "${cat.name}" : ${cat.count}`);
  }

  // 如果有更多分类，归并为"其他"
  if (categories.length > 8) {
    const otherCount = categories.slice(8).reduce((sum, c) => sum + c.count, 0);
    if (otherCount > 0) {
      lines.push(`    "其他" : ${otherCount}`);
    }
  }

  lines.push("```");
  return lines.join("\n");
}

/**
 * 生成 Mermaid 条形图（关键词频次）
 */
export function generateMermaidBarChart(keywords: KeywordStat[]): string {
  if (keywords.length === 0) {
    return "```mermaid\nxychart-beta\n    title \"高频关键词\"\n    x-axis [无数据]\n    y-axis \"频次\" 0 --> 1\n    bar [1]\n```";
  }

  const lines: string[] = ["```mermaid", "xychart-beta", '    title "高频关键词 Top 10"'];

  // x 轴标签
  const labels = keywords.map((k) => `"${k.word}"`).join(", ");
  lines.push(`    x-axis [${labels}]`);

  // y 轴范围
  const maxCount = Math.max(...keywords.map((k) => k.count));
  lines.push(`    y-axis "频次" 0 --> ${maxCount + 1}`);

  // 数据条
  const values = keywords.map((k) => k.count).join(", ");
  lines.push(`    bar [${values}]`);

  lines.push("```");
  return lines.join("\n");
}

/**
 * 生成纯文本格式的分类统计
 */
export function generateTextCategoryStats(categories: CategoryStat[]): string {
  if (categories.length === 0) {
    return "暂无分类数据";
  }

  const lines: string[] = ["分类分布:", ""];
  const maxNameLen = Math.max(...categories.map((c) => c.name.length));

  for (const cat of categories) {
    const bar = "█".repeat(Math.min(cat.count, 20));
    const padding = " ".repeat(maxNameLen - cat.name.length + 2);
    lines.push(`  ${cat.name}${padding} ${bar} ${cat.count} (${cat.percentage}%)`);
  }

  return lines.join("\n");
}

/**
 * 生成纯文本格式的关键词统计
 */
export function generateTextKeywordStats(keywords: KeywordStat[]): string {
  if (keywords.length === 0) {
    return "暂无关键词数据";
  }

  const lines: string[] = ["高频关键词 Top 10:", ""];
  const maxWordLen = Math.max(...keywords.map((k) => k.word.length));

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    const bar = "▓".repeat(Math.min(kw.count, 15));
    const padding = " ".repeat(maxWordLen - kw.word.length + 2);
    const rank = String(i + 1).padStart(2, " ");
    lines.push(`  ${rank}. ${kw.word}${padding} ${bar} ${kw.count}`);
  }

  return lines.join("\n");
}

/**
 * 生成标签云 Markdown
 */
export function generateTagCloudMarkdown(tags: string[]): string {
  if (tags.length === 0) {
    return "暂无标签";
  }

  return tags.map((t) => {
    // 加粗或斜体的标签保持原样，普通标签加反引号
    if (t.startsWith("**") || t.startsWith("*")) {
      return t;
    }
    return `\`${t}\``;
  }).join(" ");
}

/**
 * 计算完整的数据统计
 */
export function computeStatistics(items: TaggedViewItem[]): DataStatistics {
  return {
    categories: computeCategoryStats(items),
    keywords: computeKeywordStats(items, 10),
    tagCloud: generateTagCloud(items),
  };
}
