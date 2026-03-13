import type { QueryResult } from "../query/run-query";
import type { ViewModel, ViewModelItem, BuildViewDependencies } from "./registry";
import type { AiClient, PostSummaryResult } from "../ai/client";
import type { RankedCandidate } from "../types/index";
import { extractArticleContent, isExtractionSuccess } from "../pipeline/extract-content";
import { processWithConcurrency } from "../ai/concurrency";
import { loadAiSettings } from "../ai/config/load";
import { createLogger } from "../utils/logger";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("views:x-analysis");

const DEBUG_X_CONTENT = process.env.DEBUG_X_CONTENT === "true";
const DEBUG_CONTENT_DIR = "out/bird-content";

/**
 * 保存内容提取调试输出
 */
function saveContentDebug(
  postId: string,
  url: string,
  title: string,
  source: string,
  content: string,
): void {
  if (!DEBUG_X_CONTENT) {
    return;
  }

  try {
    mkdirSync(DEBUG_CONTENT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${postId}_${timestamp}.txt`;
    const filepath = join(DEBUG_CONTENT_DIR, filename);

    const debugContent = [
      `=== 帖子内容提取调试 ===`,
      `URL: ${url}`,
      `标题: ${title}`,
      `内容来源: ${source}`,
      `内容长度: ${content.length}`,
      ``,
      `=== 内容 ===`,
      content,
    ].join("\n");

    writeFileSync(filepath, debugContent, "utf-8");
    logger.info("Saved content debug output", { filepath, postId, source, contentLength: content.length });
  } catch (err) {
    logger.warn("Failed to save content debug output", { error: String(err), postId });
  }
}

/**
 * 媒体项（图片/视频）
 */
export interface XAnalysisMedia {
  type: "photo" | "video" | "animated_gif";
  url: string;
  previewUrl?: string;
}

/**
 * 外链文章
 */
export interface XAnalysisArticle {
  title: string;
  url: string;
  previewText?: string;
}

/**
 * 引用帖子
 */
export interface XAnalysisQuote {
  id?: string;
  text?: string;
  author?: string;
  url?: string;
}

/**
 * Thread 项
 */
export interface XAnalysisThreadItem {
  id?: string;
  text?: string;
  author?: string;
}

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
  // 引用内容字段
  fullText?: string;  // 原始帖子全文
  media?: XAnalysisMedia[];  // 图片/视频数组
  article?: XAnalysisArticle;  // 外链文章
  quote?: XAnalysisQuote;  // 引用帖子
  thread?: XAnalysisThreadItem[];  // thread 数组
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
 * 从 metadataJson 中提取 media 数据
 */
function extractMedia(metadataJson: string | undefined): XAnalysisMedia[] | undefined {
  if (!metadataJson) return undefined;

  try {
    const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    const media = metadata.media as Array<Record<string, unknown>> | undefined;
    if (!media || !Array.isArray(media) || media.length === 0) return undefined;

    return media
      .filter((m) => typeof m.url === "string")
      .map((m) => ({
        type: (m.type as "photo" | "video" | "animated_gif") ?? "photo",
        url: m.url as string,
        previewUrl: typeof m.previewUrl === "string" ? m.previewUrl : undefined,
      }));
  } catch {
    return undefined;
  }
}

/**
 * 从 metadataJson 中提取 article 数据
 */
function extractArticle(metadataJson: string | undefined): XAnalysisArticle | undefined {
  if (!metadataJson) return undefined;

  try {
    const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    const article = metadata.article as Record<string, unknown> | undefined;
    if (!article || typeof article.title !== "string" || typeof article.url !== "string") return undefined;

    return {
      title: article.title,
      url: article.url,
      previewText: typeof article.previewText === "string" ? article.previewText : undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * 从 metadataJson 中提取 quote 数据
 */
function extractQuote(metadataJson: string | undefined): XAnalysisQuote | undefined {
  if (!metadataJson) return undefined;

  try {
    const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    const quote = metadata.quote as Record<string, unknown> | undefined;
    if (!quote) return undefined;

    return {
      id: typeof quote.id === "string" ? quote.id : undefined,
      text: typeof quote.text === "string" ? quote.text : undefined,
      author: typeof quote.author === "string" ? quote.author : undefined,
      url: typeof quote.url === "string" ? quote.url : undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * 从 metadataJson 中提取 thread 数据
 */
function extractThread(metadataJson: string | undefined): XAnalysisThreadItem[] | undefined {
  if (!metadataJson) return undefined;

  try {
    const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    const thread = metadata.thread as Array<Record<string, unknown>> | undefined;
    if (!thread || !Array.isArray(thread) || thread.length === 0) return undefined;

    return thread.map((t) => ({
      id: typeof t.id === "string" ? t.id : undefined,
      text: typeof t.text === "string" ? t.text : undefined,
      author: typeof t.author === "string" ? t.author : undefined,
    }));
  } catch {
    return undefined;
  }
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
    const title = item.title ?? item.normalizedTitle ?? "";
    logger.debug("Using normalizedText for social post", {
      itemId: item.id,
      source: "normalizedText",
      contentType: item.contentType,
      sourceType: item.sourceType,
      contentLength: content.length,
    });

    // 保存调试输出
    saveContentDebug(item.id, url ?? "", title, "normalizedText", content);

    if (!content) return null;

    try {
      return await aiClient.summarizePost(title, content);
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
  let contentSource = "url_extraction";
  if (!content) {
    content = item.normalizedText ?? "";
    contentSource = "url_extraction_fallback";
    logger.debug("Falling back to normalizedText after URL extraction failed", {
      itemId: item.id,
      source: contentSource,
      contentLength: content.length,
    });
  } else {
    logger.debug("Content extracted from URL", {
      itemId: item.id,
      source: contentSource,
      contentLength: content.length,
    });
  }

  // 保存调试输出
  const title = item.title ?? item.normalizedTitle ?? "";
  saveContentDebug(item.id, url, title, contentSource, content);

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
    // 引用内容字段
    fullText: item.normalizedText,
    media: extractMedia(item.metadataJson),
    article: extractArticle(item.metadataJson),
    quote: extractQuote(item.metadataJson),
    thread: extractThread(item.metadataJson),
  }));

  let tagCloud: string[] = [];

  if (aiClient && rankedItems.length > 0) {
    // 从配置加载并发数，默认 2
    const settings = await loadAiSettings();
    const concurrency = settings?.xAnalysisConcurrency ?? 2;

    logger.debug("Processing posts with concurrency control", {
      totalPosts: rankedItems.length,
      concurrency,
    });

    // 使用并发控制处理帖子摘要
    const summaryResults = await processWithConcurrency(
      rankedItems,
      { concurrency, batchSize: rankedItems.length }, // 不分批，仅控制并发
      (item) => summarizePostWithContent(item, aiClient)
    );

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
        // 引用内容字段
        fullText: item.normalizedText,
        media: extractMedia(item.metadataJson),
        article: extractArticle(item.metadataJson),
        quote: extractQuote(item.metadataJson),
        thread: extractThread(item.metadataJson),
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
