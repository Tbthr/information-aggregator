import type { QueryResult } from "../query/run-query";
import type { ViewModel, ViewModelItem } from "./registry";
import type { AiClient, ArticleEnrichResult, DailyBriefOverviewResult } from "../ai/client";
import { extractArticleContent, isExtractionSuccess } from "../pipeline/extract-content";

export interface DailyBriefViewOptions {
  aiClient?: AiClient | null;
}

export interface DailyBriefArticle extends ViewModelItem {
  title: string;
  url: string;
  description: string;  // AI 生成
  whyMatters: string;   // AI 生成
  tags: string[];       // AI 生成
}

export interface DailyBriefViewModel extends ViewModel {
  viewId: "daily-brief";
  title: string;
  summary: string;           // AI 整合生成
  highlights: string[];      // AI 整合生成
  articles: DailyBriefArticle[];
  tagCloud: string[];        // 汇总所有文章 tags
}

/**
 * 并发处理单篇文章的 AI 增强
 */
async function enrichArticleWithContent(
  item: QueryResult["rankedItems"][number],
  aiClient: AiClient,
): Promise<{
  title: string;
  url: string;
  enrichResult: ArticleEnrichResult | null;
}> {
  const url = item.url ?? item.canonicalUrl;
  if (!url) {
    return {
      title: item.title ?? item.normalizedTitle ?? item.id,
      url: "",
      enrichResult: null,
    };
  }

  // 提取全文
  let content = "";
  try {
    const extractionResult = await extractArticleContent(url, {
      timeout: 15000,
      maxLength: 8000,
    });
    if (isExtractionSuccess(extractionResult)) {
      content = extractionResult.textContent ?? extractionResult.content ?? "";
    }
  } catch (error) {
    console.error(`Failed to extract content for ${url}:`, error);
  }

  // 如果没有提取到内容，使用 snippet
  if (!content) {
    content = item.normalizedText ?? "";
  }

  // 调用 AI 增强
  let enrichResult: ArticleEnrichResult | null = null;
  if (content) {
    try {
      enrichResult = await aiClient.enrichArticle(
        item.title ?? item.normalizedTitle ?? "",
        content,
      );
    } catch (error) {
      console.error(`Failed to enrich article ${item.id}:`, error);
    }
  }

  return {
    title: item.title ?? item.normalizedTitle ?? item.id,
    url,
    enrichResult,
  };
}

/**
 * 构建 Daily Brief 视图
 */
export async function buildDailyBriefView(
  result: QueryResult,
  options?: DailyBriefViewOptions,
): Promise<DailyBriefViewModel> {
  const aiClient = options?.aiClient;

  // 取 Top 10 文章
  const topItems = result.rankedItems.slice(0, 10);

  // 默认值
  let articles: DailyBriefArticle[] = topItems.map((item) => ({
    title: item.title ?? item.normalizedTitle ?? item.id,
    url: item.url ?? item.canonicalUrl ?? "",
    description: "",
    whyMatters: "",
    tags: [],
  }));

  let summary = "";
  let highlights: string[] = [];
  let tagCloud: string[] = [];

  if (aiClient) {
    // 并发处理每篇文章
    const enrichPromises = topItems.map((item) =>
      enrichArticleWithContent(item, aiClient)
    );
    const enrichResults = await Promise.all(enrichPromises);

    // 构建文章列表
    articles = enrichResults.map((r, index) => ({
      title: r.title,
      url: r.url,
      description: r.enrichResult?.description ?? "",
      whyMatters: r.enrichResult?.whyMatters ?? "",
      tags: r.enrichResult?.tags ?? [],
    }));

    // 汇总所有 tags
    const allTags = articles.flatMap((a) => a.tags);
    tagCloud = [...new Set(allTags)];

    // 整合请求：生成 summary + highlights
    const descriptions = articles
      .filter((a) => a.description)
      .map((a) => a.description);

    if (descriptions.length >= 3) {
      try {
        const overviewResult = await aiClient.generateDailyBriefOverview(descriptions);
        if (overviewResult) {
          summary = overviewResult.summary;
          highlights = overviewResult.highlights;
        }
      } catch (error) {
        console.error("Failed to generate daily brief overview:", error);
      }
    }
  }

  return {
    viewId: "daily-brief",
    title: "Daily Brief",
    summary,
    highlights,
    articles,
    tagCloud,
    sections: [
      {
        title: "Articles",
        items: articles,
      },
    ],
  };
}

/**
 * 渲染 Daily Brief 视图为 Markdown
 */
export function renderDailyBriefView(model: ViewModel): string {
  const briefModel = model as DailyBriefViewModel;
  const lines: string[] = ["# Daily Digest", ""];

  // AI 整体摘要
  if (briefModel.summary) {
    lines.push("## 今日看点", "", briefModel.summary);
  }

  // AI 高亮
  if (briefModel.highlights && briefModel.highlights.length > 0) {
    lines.push("", "### 主要看点", "");
    for (const h of briefModel.highlights) {
      lines.push(`- ${h}`);
    }
  }

  // 文章列表
  if (briefModel.articles && briefModel.articles.length > 0) {
    lines.push("", "## 精选文章", "");
    for (const article of briefModel.articles) {
      const titleLink = article.url ? `[${article.title}](${article.url})` : article.title;
      lines.push("", `### ${titleLink}`);

      if (article.description) {
        lines.push("", `> ${article.description}`);
      }

      if (article.whyMatters) {
        lines.push("", `**为什么值得关注**: ${article.whyMatters}`);
      }

      if (article.tags && article.tags.length > 0) {
        lines.push("", `**标签**: ${article.tags.map((t) => `\`${t}\``).join(" ")}`);
      }
    }
  }

  // 标签云
  if (briefModel.tagCloud && briefModel.tagCloud.length > 0) {
    lines.push("", "## 标签云", "");
    lines.push(briefModel.tagCloud.map((t) => `\`${t}\``).join(" "));
  }

  // 页脚
  lines.push("", "---", `*生成时间: ${new Date().toLocaleString("zh-CN")}*`);

  return lines.join("\n");
}
