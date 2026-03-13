/**
 * X Analysis 视图构建器
 */

import type { AiClient } from "../../ai/client";
import { processWithConcurrency } from "../../ai/concurrency";
import { loadAiSettings } from "../../ai/config/load";
import { createLogger } from "../../utils/logger";
import type { BuildViewDependencies } from "../registry";
import type { QueryResult } from "../../query/run-query";
import type { XAnalysisPost, XAnalysisViewModel } from "./types";
import type { SourcePack, RankedCandidate } from "../../types/index";
import {
  extractEngagement, extractMedia, extractArticle, extractQuote, extractThread, extractAuthor,
  extractTweetId, extractAuthorId, extractAuthorName, extractExpandedUrl, extractPublishedAt,
  extractParent, extractConversationId
} from "./extract-metadata";
import { summarizePostWithContent } from "./summarize";
import { loadTemplate, templateExists, render } from "../../templates";

const logger = createLogger("views:x-analysis");

/**
 * 构建 AI prompt
 * 如果 pack 定义了 promptTemplate，使用自定义模板
 */
export async function buildAIPrompt(
  items: RankedCandidate[],
  pack?: SourcePack
): Promise<string> {
  const templateName = pack?.promptTemplate;

  if (templateName && await templateExists('prompt', templateName)) {
    const template = await loadTemplate('prompt', templateName);
    const data = {
      items: items.map(i => i.normalizedText || i.normalizedTitle).join('\n\n'),
      date: new Date().toLocaleDateString('zh-CN'),
      sourceCount: pack?.sources?.length ?? 1,
      itemCount: items.length,
    };
    return render(template, data);
  }

  // 默认 prompt
  return `分析以下内容并生成摘要和标签：

${items.map(i => `- ${i.normalizedText || i.normalizedTitle}`).join('\n')}`;
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
    // 新增字段
    authorName: extractAuthorName(item.metadataJson),
    authorId: extractAuthorId(item.metadataJson),
    publishedAt: extractPublishedAt(item.processedAt),
    expandedUrl: extractExpandedUrl(item.metadataJson),
    parent: extractParent(item.metadataJson),
    tweetId: extractTweetId(item.metadataJson),
    conversationId: extractConversationId(item.metadataJson),
  }));

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
      (item) => summarizePostWithContent(item, aiClient as AiClient)
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
        // 新增字段
        authorName: extractAuthorName(item.metadataJson),
        authorId: extractAuthorId(item.metadataJson),
        publishedAt: extractPublishedAt(item.processedAt),
        expandedUrl: extractExpandedUrl(item.metadataJson),
        parent: extractParent(item.metadataJson),
        tweetId: extractTweetId(item.metadataJson),
        conversationId: extractConversationId(item.metadataJson),
      };
    });

  }

  return {
    viewId: "x-analysis",
    title: "X 数据分析",
    posts,
    sections: [
      {
        title: "Posts",
        items: posts,
      },
    ],
  };
}
