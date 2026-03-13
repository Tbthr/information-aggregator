import type { QueryResult } from "../query/run-query";
import type { ViewModel, ViewModelItem, BuildViewDependencies } from "./registry";
import type { AiClient, PostSummaryResult } from "../ai/client";
import type { RankedCandidate } from "../types/index";
import { extractArticleContent, isExtractionSuccess } from "../pipeline/extract-content";
import { createLogger } from "../utils/logger";

const logger = createLogger("views:x-analysis");

/**
 * X Analysis 帖子视图项
 */
export interface XAnalysisPost extends ViewModelItem {
  title: string;
  url: string;
  author?: string;
  authorUrl?: string;
  summary: string;  // AI 生成
  tags: string[];   // AI 生成
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

/**
 * X Analysis 视图模型
 */
export interface XAnalysisViewModel extends ViewModel {
  viewId: "x-analysis";
  title: string;
  posts: XAnalysisPost[];
  tagCloud: string[];  // 汇总所有帖子 tags
}

/**
 * 从 metadataJson 中提取 engagement 数据
 */
function extractEngagement(metadataJson: string | undefined): {
  likes: number;
  retweets: number;
  replies: number;
} | undefined {
  if (!metadataJson) return undefined;

  try {
    const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    if (!metadata?.engagement) return undefined;

    const eng = metadata.engagement as Record<string, unknown>;
    const score = typeof eng.score === "number" ? eng.score : 0;
    const reactions = typeof eng.reactions === "number" ? eng.reactions : 0;
    const comments = typeof eng.comments === "number" ? eng.comments : 0;

    if (score === 0 && reactions === 0 && comments === 0) return undefined;

    return {
      likes: score,
      retweets: reactions,
      replies: comments,
    };
  } catch {
    return undefined;
  }
}

/**
 * 从 RawItem 提取作者信息
 */
function extractAuthor(item: QueryResult["rankedItems"][number]): {
  author?: string;
  authorUrl?: string;
} {
  const author = item.author ?? item.sourceName;
  const authorUrl = author ? `https://x.com/${author}` : undefined;
  return { author, authorUrl };
}

/**
 * 判断是否为社交帖子类型（内容已在 normalizedText 中，无需 URL 提取）
 * 复用自 enrich.ts 的逻辑
 */
function isSocialPost(item: RankedCandidate): boolean {
  // 通过 contentType 或 sourceType 判断
  if (item.contentType === "social_post") {
    return true;
  }
  if (item.sourceType?.startsWith("x_")) {
    return true;
  }
  return false;
}

/**
 * 并发处理单篇帖子的 AI 摘要
 */
async function summarizePostWithContent(
  item: QueryResult["rankedItems"][number],
  aiClient: AiClient,
): Promise<PostSummaryResult | null> {
  const url = item.url ?? item.canonicalUrl;

  // 社交帖子类型：直接使用 normalizedText，无需 URL 提取
  if (isSocialPost(item)) {
    const content = item.normalizedText ?? "";
    logger.debug("Using normalizedText for social post", {
      itemId: item.id,
      source: "normalizedText",
      contentType: item.contentType,
      sourceType: item.sourceType,
      contentLength: content.length,
    });

    if (!content) return null;

    try {
      return await aiClient.summarizePost(
        item.title ?? item.normalizedTitle ?? "",
        content,
      );
    } catch (error) {
      logger.error("Failed to summarize social post", {
        itemId: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // 非社交帖子类型：从 URL 提取内容
  if (!url) return null;

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
    logger.error("Failed to extract content from URL", {
      url,
      itemId: item.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 如果没有提取到内容，使用 normalizedText 作为 fallback
  if (!content) {
    content = item.normalizedText ?? "";
    logger.debug("Falling back to normalizedText after URL extraction failed", {
      itemId: item.id,
      source: "url_extraction_fallback",
      contentLength: content.length,
    });
  } else {
    logger.debug("Content extracted from URL", {
      itemId: item.id,
      source: "url_extraction",
      contentLength: content.length,
    });
  }

  if (!content) return null;

  // 调用 AI 摘要
  try {
    return await aiClient.summarizePost(
      item.title ?? item.normalizedTitle ?? "",
      content,
    );
  } catch (error) {
    logger.error("Failed to summarize post", {
      itemId: item.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 构建 X Analysis 视图
 */
export async function buildXAnalysisView(
  result: QueryResult,
  dependencies?: BuildViewDependencies,
): Promise<XAnalysisViewModel> {
  const aiClient = dependencies?.aiClient;

  // 取全部 rankedItems
  const rankedItems = result.rankedItems;

  // 默认值（无 AI 时）
  let posts: XAnalysisPost[] = rankedItems.map((item) => ({
    title: item.title ?? item.normalizedTitle ?? item.id,
    url: item.url ?? item.canonicalUrl ?? "",
    ...extractAuthor(item),
    summary: "",
    tags: [],
    engagement: extractEngagement(item.metadataJson),
  }));

  let tagCloud: string[] = [];

  if (aiClient && rankedItems.length > 0) {
    // 并发请求：为每篇帖子生成 AI 摘要 + tags
    const summaryPromises = rankedItems.map((item) =>
      summarizePostWithContent(item, aiClient)
    );
    const summaryResults = await Promise.all(summaryPromises);

    // 构建帖子列表
    posts = rankedItems.map((item, index) => {
      const summaryResult = summaryResults[index];
      return {
        title: item.title ?? item.normalizedTitle ?? item.id,
        url: item.url ?? item.canonicalUrl ?? "",
        ...extractAuthor(item),
        summary: summaryResult?.summary ?? "",
        tags: summaryResult?.tags ?? [],
        engagement: extractEngagement(item.metadataJson),
      };
    });

    // 汇总所有 tags
    const allTags = posts.flatMap((p) => p.tags);
    tagCloud = [...new Set(allTags)];
  }

  return {
    viewId: "x-analysis",
    title: "X 数据分析",
    posts,
    tagCloud,
    sections: [
      {
        title: "Posts",
        items: posts,
      },
    ],
  };
}
