/**
 * AI 摘要处理逻辑
 */

import type { AiClient, PostSummaryResult } from "../../ai/client";
import type { RankedCandidate } from "../../types/index";
import { isSocialPost } from "../../utils/social-post";
import { extractArticleContent, isExtractionSuccess } from "../../pipeline/extract-content";
import { createLogger } from "../../utils/logger";
import { saveContentDebug } from "./debug";

const logger = createLogger("views:x-analysis:summarize");

/**
 * 并发处理单篇帖子的 AI 摘要
 */
export async function summarizePostWithContent(
  item: RankedCandidate,
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
