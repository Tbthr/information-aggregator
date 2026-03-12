import type { QueryResult } from "../query/run-query";
import type { ViewModel, BuildViewDependencies } from "./registry";
import type { RawItemMetadata, RankedCandidate, RawItem } from "../types/index";
import type { AiClient, TopicSuggestion } from "../ai/client";
import { buildXPostSummaryPrompt, buildDigestNarrationPromptX, buildTopicSuggestionPrompt } from "../ai/prompts";
import {
  type DataStatistics,
  type TaggedViewItem,
  computeStatistics,
  generateMermaidPieChart,
  generateMermaidBarChart,
  generateTextCategoryStats,
  generateTextKeywordStats,
  generateTagCloudMarkdown,
} from "./statistics";

/**
 * X 数据分析视图项
 */
interface XAnalysisViewItem {
  id: string;
  title: string;
  url: string;
  author?: string;
  authorUrl?: string;
  snippet?: string;
  aiSummary?: string;
  aiScore?: number;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
  tags: string[];
  whyMatters?: string;
}

/**
 * 选题建议（扩展版，包含素材来源链接）
 */
export interface TopicSuggestionViewItem {
  title: string;
  description: string;
  sourceLinks: Array<{ title: string; url: string }>;
}

/**
 * X Analysis 视图模型
 */
export interface XAnalysisModel extends ViewModel {
  viewId: "x-analysis";
  date: string;
  stats: {
    scanned: number;
    filtered: number;
    selected: number;
  };
  narration?: string;
  bookmarkItems: XAnalysisViewItem[];
  statistics?: DataStatistics;
  topicSuggestions?: TopicSuggestionViewItem[];
}

/**
 * 从 metadataJson 中提取 engagement 数据
 */
function extractEngagement(metadata: RawItemMetadata | null): { likes: number; retweets: number; replies: number } | undefined {
  if (!metadata?.engagement) {
    return undefined;
  }
  const { score, comments, reactions } = metadata.engagement;
  if (score === undefined && comments === undefined && reactions === undefined) {
    return undefined;
  }
  return {
    likes: score ?? 0,
    retweets: reactions ?? 0,
    replies: comments ?? 0,
  };
}

/**
 * 从 RawItem.metadataJson 中提取完整的扩展数据
 */
function extractFullMetadata(rawItem: RawItem): {
  engagement?: { likes: number; retweets: number; replies: number };
  article?: { title: string; previewText?: string; url?: string };
  author?: string;
} {
  const result: {
    engagement?: { likes: number; retweets: number; replies: number };
    article?: { title: string; previewText?: string; url?: string };
    author?: string;
  } = {};

  if (!rawItem.metadataJson) {
    return result;
  }

  try {
    const full = JSON.parse(rawItem.metadataJson) as Record<string, unknown>;

    // 提取 engagement
    if (full.engagement && typeof full.engagement === "object") {
      const eng = full.engagement as Record<string, unknown>;
      result.engagement = {
        likes: (typeof eng.score === "number" ? eng.score : 0),
        retweets: (typeof eng.reactions === "number" ? eng.reactions : 0),
        replies: (typeof eng.comments === "number" ? eng.comments : 0),
      };
    }

    // 提取 article
    if (full.article && typeof full.article === "object") {
      const art = full.article as Record<string, unknown>;
      if (typeof art.title === "string") {
        result.article = {
          title: art.title,
          previewText: typeof art.previewText === "string" ? art.previewText : undefined,
          url: typeof art.url === "string" ? art.url : undefined,
        };
      }
    }

    // 提取 author（如果在顶层）
    if (typeof full.author === "string") {
      result.author = full.author;
    }
  } catch {
    // ignore parse errors
  }

  return result;
}

/**
 * 简单的标签提取（基于关键词匹配）
 */
function extractTags(title: string, snippet?: string): string[] {
  const text = `${title} ${snippet ?? ""}`.toLowerCase();
  const tags: string[] = [];
  const seen = new Set<string>();

  const tagPatterns: Array<[RegExp, string]> = [
    [/\bai\b|\bartificial intelligence\b|人工智能|智能/g, "AI"],
    [/\bmachine learning\b|机器学习|深度学习/g, "ML"],
    [/\bllm\b|large language model|大模型|语言模型/g, "LLM"],
    [/\bgpt\b|chatgpt|gpt-4|gpt-4o/g, "GPT"],
    [/\bclaude\b|anthropic/g, "Claude"],
    [/\bopenai\b/g, "OpenAI"],
    [/\bcode\b|编程|代码|开发/g, "编程"],
    [/\bstartup\b|创业|初创/g, "创业"],
    [/\bproduct\b|产品/g, "产品"],
    [/\bdesign\b|设计/g, "设计"],
    [/\bcrypto\b|区块链|比特币|以太坊/g, "Crypto"],
    [/\bweb3\b/g, "Web3"],
    [/\bdefi\b|去中心化金融/g, "DeFi"],
    [/\bsecurity\b|安全|漏洞/g, "安全"],
    [/\bperformance\b|性能|优化/g, "性能"],
    [/\bapi\b/g, "API"],
    [/\bopen source\b|开源/g, "开源"],
    [/\btutorial\b|教程|指南|入门/g, "教程"],
    [/\bnews\b|新闻|发布|公告/g, "新闻"],
    [/\bdata\b|数据/g, "数据"],
    [/\brust\b/g, "Rust"],
    [/\btypescript\b|javascript/g, "TypeScript"],
    [/\bpython\b/g, "Python"],
    [/\bgolang\b|go语言/g, "Go"],
  ];

  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(text) && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= 3) break;
    }
  }

  return tags;
}

/**
 * 格式化数字（简化大数字）
 */
function formatNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return String(n);
}

/**
 * 构建 ID 到 RawItem 的映射
 */
function buildRawItemMap(items: RawItem[]): Map<string, RawItem> {
  const map = new Map<string, RawItem>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

/**
 * 将 RankedCandidate 转换为 XAnalysisViewItem
 */
function toItem(candidate: RankedCandidate, rawItemMap: Map<string, RawItem>): XAnalysisViewItem {
  const rawItem = rawItemMap.get(candidate.id);
  const fullMeta = rawItem ? extractFullMetadata(rawItem) : {};

  const tags = extractTags(
    candidate.title ?? candidate.normalizedTitle ?? "",
    candidate.normalizedText ?? rawItem?.snippet
  );

  // 构建作者 URL
  const author = rawItem?.author ?? fullMeta.author ?? candidate.sourceName;
  const authorUrl = author ? `https://x.com/${author}` : undefined;

  // 摘要由 AI 在 aggregator.ts 中生成，此处仅保存原始内容
  const snippet = candidate.normalizedText ?? rawItem?.snippet;

  return {
    id: candidate.id,
    title: candidate.title ?? candidate.normalizedTitle ?? candidate.id,
    url: candidate.url ?? candidate.canonicalUrl ?? "",
    author,
    authorUrl,
    snippet,
    aiSummary: undefined, // 由 AI 在 aggregator.ts 中填充
    aiScore: candidate.finalScore,
    engagement: fullMeta.engagement,
    tags,
    whyMatters: candidate.rationale,
  };
}

/**
 * 将 XAnalysisViewItem 转换为 TaggedViewItem（用于统计）
 */
function toTaggedItem(item: XAnalysisViewItem): TaggedViewItem {
  return {
    title: item.title,
    tags: item.tags,
    snippet: item.snippet,
  };
}

/**
 * 将 AI 返回的选题建议转换为视图项
 * @param suggestions AI 返回的原始选题建议
 * @param items 用于解析来源链接的视图项列表
 */
export function resolveTopicSuggestions(
  suggestions: TopicSuggestion[],
  items: XAnalysisViewItem[],
): TopicSuggestionViewItem[] {
  return suggestions.map((s) => ({
    title: s.title,
    description: s.description,
    sourceLinks: s.sourceLinks
      .map((idxStr) => {
        const idx = parseInt(idxStr, 10) - 1; // 转为 0-based index
        const item = items[idx];
        if (!item) return null;
        return { title: item.title, url: item.url };
      })
      .filter((link): link is { title: string; url: string } => link !== null),
  }));
}

/**
 * 构建 X Analysis 视图
 */
export async function buildXAnalysisView(
  result: QueryResult,
  dependencies?: BuildViewDependencies,
): Promise<XAnalysisModel> {
  const { aiClient } = dependencies ?? {};

  const rawItemMap = buildRawItemMap(result.items);
  const bookmarkItems = result.rankedItems
    .slice(0, 10)
    .map((candidate) => toItem(candidate, rawItemMap));

  const date = new Date().toISOString().split("T")[0];

  // 计算统计数据
  const taggedItems = bookmarkItems.map(toTaggedItem);
  const statistics = computeStatistics(taggedItems);

  const highlights = bookmarkItems.slice(0, 3).map((item) => item.title);

  // AI 增强（如果有 AI client）
  let narration: string | undefined;
  let topicSuggestions: TopicSuggestionViewItem[] | undefined;

  if (aiClient && bookmarkItems.length > 0) {
    try {
      // 1. 为每条内容生成 AI 摘要
      for (const item of bookmarkItems) {
        if (item.snippet && !item.aiSummary) {
          item.aiSummary = await aiClient.summarizeItem(item.title, item.snippet);
        }
      }

      // 2. 生成今日看点摘要
      if (highlights.length > 0) {
        const narrationPrompt = buildDigestNarrationPromptX(highlights);
        narration = await aiClient.narrateDigest(narrationPrompt);
      }

      // 3. 生成选题建议
      const itemTexts = bookmarkItems
        .slice(0, 10)
        .map((item) => `${item.title}: ${item.snippet ?? ""}`);
      const topicPrompt = buildTopicSuggestionPrompt(itemTexts);
      const suggestions = await aiClient.suggestTopics(topicPrompt);
      topicSuggestions = resolveTopicSuggestions(suggestions, bookmarkItems);
    } catch (error) {
      // AI 调用失败时不影响主流程
      console.error("Failed to generate AI enhancements:", error);
    }
  }

  return {
    viewId: "x-analysis",
    title: `📰 X 数据分析 — ${date}`,
    date,
    stats: {
      scanned: result.items.length,
      filtered: result.normalizedItems.length,
      selected: result.rankedItems.length,
    },
    highlights,
    bookmarkItems,
    statistics,
    narration,
    topicSuggestions,
    sections: [
      {
        title: "精选内容",
        items: bookmarkItems.map((item) => ({
          title: item.title,
          url: item.url,
          summary: item.aiSummary,
          score: item.aiScore,
        })),
      },
    ],
  };
}

/**
 * 渲染 X Analysis 视图为 Markdown
 */
export function renderXAnalysisView(model: ViewModel): string {
  const lines: string[] = [];
  const analysisModel = model as XAnalysisModel;

  // 标题
  lines.push(`# ${model.title}`);

  // 今日看点（AI 摘要，如果有）
  if (analysisModel.narration) {
    lines.push("", "## 📌 今日看点", "", analysisModel.narration);
  }

  // 数据概览表格
  if (analysisModel.stats) {
    lines.push("", "## 📊 数据概览", "");
    lines.push("| 指标 | 数量 |");
    lines.push("|------|------|");
    lines.push(`| 扫描条目 | ${analysisModel.stats.scanned} |`);
    lines.push(`| 筛选后 | ${analysisModel.stats.filtered} |`);
    lines.push(`| 精选推荐 | ${analysisModel.stats.selected} |`);
  }

  // 高亮内容
  if (model.highlights && model.highlights.length > 0) {
    lines.push("", "## ✨ 今日热点", "");
    for (const highlight of model.highlights) {
      lines.push(`- ${highlight}`);
    }
  }

  // 精选内容详情
  if (analysisModel.bookmarkItems && analysisModel.bookmarkItems.length > 0) {
    lines.push("", "## 📝 精选内容", "");

    for (const item of analysisModel.bookmarkItems) {
      // 标题和链接
      const titleLink = item.url ? `[${item.title}](${item.url})` : item.title;
      lines.push("", `### ${titleLink}`);

      // 元数据行：作者、AI评分、互动数据
      const metaParts: string[] = [];

      // 作者链接
      if (item.author) {
        if (item.authorUrl) {
          metaParts.push(`[@${item.author}](${item.authorUrl})`);
        } else {
          metaParts.push(`@${item.author}`);
        }
      }

      // AI 评分
      if (item.aiScore !== undefined) {
        metaParts.push(`⭐ ${item.aiScore.toFixed(1)}`);
      }

      // 互动数据
      if (item.engagement) {
        if (item.engagement.likes > 0) {
          metaParts.push(`❤️ ${formatNumber(item.engagement.likes)}`);
        }
        if (item.engagement.retweets > 0) {
          metaParts.push(`🔄 ${formatNumber(item.engagement.retweets)}`);
        }
        if (item.engagement.replies > 0) {
          metaParts.push(`💬 ${formatNumber(item.engagement.replies)}`);
        }
      }

      if (metaParts.length > 0) {
        lines.push("", metaParts.join(" | "));
      }

      // AI 生成的 50 字摘要
      if (item.aiSummary) {
        lines.push("", `> **摘要**: ${item.aiSummary}`);
      }

      // 为什么值得关注
      if (item.whyMatters) {
        lines.push("", `**为什么值得关注**: ${item.whyMatters}`);
      }

      // 标签
      if (item.tags.length > 0) {
        lines.push("", `**标签**: ${item.tags.map((t) => `\`${t}\``).join(" ")}`);
      }
    }
  }

  // 数据统计与可视化
  if (analysisModel.statistics) {
    const stats = analysisModel.statistics;

    // 标签云
    if (stats.tagCloud.length > 0) {
      lines.push("", "## 🏷️ 话题标签云", "");
      lines.push(generateTagCloudMarkdown(stats.tagCloud));
    }

    // Mermaid 可视化
    lines.push("", "## 📈 数据可视化", "");

    // 分类分布饼图
    if (stats.categories.length > 0) {
      lines.push("", "### 分类分布", "");
      lines.push(generateMermaidPieChart(stats.categories));
    }

    // 关键词频次条形图
    if (stats.keywords.length > 0) {
      lines.push("", "### 高频关键词", "");
      lines.push(generateMermaidBarChart(stats.keywords));
    }

    // 纯文本备用格式（终端友好）
    lines.push("", "## 📋 文本统计（终端友好）", "");
    lines.push("", "```");
    lines.push(generateTextCategoryStats(stats.categories));
    lines.push("");
    lines.push(generateTextKeywordStats(stats.keywords));
    lines.push("```");
  }

  // 选题思路
  if (analysisModel.topicSuggestions && analysisModel.topicSuggestions.length > 0) {
    lines.push("", "## 💡 选题思路", "");
    lines.push("基于今日精选内容，AI 推荐以下创作选题：");

    for (let i = 0; i < analysisModel.topicSuggestions.length; i++) {
      const suggestion = analysisModel.topicSuggestions[i];
      lines.push("", `### ${i + 1}. ${suggestion.title}`);
      lines.push("", `**角度说明**: ${suggestion.description}`);

      if (suggestion.sourceLinks.length > 0) {
        lines.push("", "**素材来源**:");
        for (const link of suggestion.sourceLinks) {
          lines.push(`- [${link.title}](${link.url})`);
        }
      }
    }
  }

  // 页脚
  lines.push("", "---", `*生成时间: ${new Date().toLocaleString("zh-CN")}*`);

  return lines.join("\n");
}
