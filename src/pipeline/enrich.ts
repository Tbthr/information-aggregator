/**
 * 内容充实模块
 * 负责判断哪些文章需要从原 URL 提取完整正文，以及执行提取
 */

import { execSync } from "child_process";
import path from "path";
import { createLogger } from "../utils/logger";
import type { normalizedArticle } from "../types/index.js";

const agentFetchBin = path.join(process.cwd(), "node_modules/.bin/agent-fetch");
const logger = createLogger("pipeline:enrich");

// ============================================================
// Types
// ============================================================

export interface EnrichOptions {
  enabled: boolean;
  batchSize: number;
  minContentLength: number;
  fetchTimeout: number;
  truncationMarkers?: string[];
}

export interface ContentQualityResult {
  status: "pass" | "fail";
  reason?: string;
}

export interface NeedsEnrichmentResult {
  needed: boolean;
  reason: string;
}

export interface EnrichArticleResult {
  enriched: boolean;
  originalContent: string;
  newContent?: string;
  error?: string;
}

// ============================================================
// Content Quality Assessment
// ============================================================

/**
 * 判断内容质量是否达标
 * @param text 纯文本内容
 * @param minLength 最小长度要求（默认 500）
 * @param truncationMarkers 截断标记数组（默认硬编码值）
 * @returns 'pass' | 'fail'
 */
export function contentQuality(
  text: string,
  minLength = 500,
  truncationMarkers: string[] = ["[...]", "Read more", "click here", "read more at", "来源：", "Original:"]
): ContentQualityResult {
  // Strip HTML tags for quality assessment
  const plainText = text.replace(/<[^>]*>/g, "").trim();

  // Rule 1: Check minimum length
  if (plainText.length < minLength) {
    return {
      status: "fail",
      reason: `内容过短 (${plainText.length} < ${minLength} 字符)`,
    };
  }

  // Rule 2: Check for truncation markers
  const hasTruncationMarker = truncationMarkers.some((marker) =>
    plainText.toLowerCase().includes(marker.toLowerCase())
  );
  if (hasTruncationMarker) {
    return {
      status: "fail",
      reason: "内容包含截断标记 [...] 或 Read more",
    };
  }

  // Rule 3: Count sentences (ends with . ! 。 ？)
  const sentences = plainText.split(/[.!?。？]/).filter((s) => s.trim().length > 0);
  if (sentences.length < 3) {
    return {
      status: "fail",
      reason: `句子数不足 (${sentences.length} < 3)`,
    };
  }

  return { status: "pass" };
}

// ============================================================
// Needs Enrichment Check
// ============================================================

/**
 * 判断文章是否需要充实
 * @param normalizedContent 当前标准化内容
 * @param url 文章 URL
 * @param options 充实选项
 * @param truncationMarkers 截断标记数组
 * @returns {needed, reason}
 */
export function needsEnrichment(
  normalizedContent: string,
  url: string | undefined,
  options: EnrichOptions,
  truncationMarkers: string[] = ["[...]", "Read more", "click here", "read more at", "来源：", "Original:"]
): NeedsEnrichmentResult {
  const quality = contentQuality(normalizedContent, options.minContentLength, truncationMarkers);

  // Quality sufficient → not needed
  if (quality.status === "pass") {
    return { needed: false, reason: "内容质量达标" };
  }

  // Quality insufficient + URL → needed
  if (quality.status === "fail" && url) {
    return { needed: true, reason: quality.reason || "内容质量不达标且有 URL 可供提取" };
  }

  // Quality insufficient + no URL → not needed
  return { needed: false, reason: "内容质量不达标但无 URL 可供提取" };
}

// ============================================================
// Fetch Article Content via agent-fetch
// ============================================================

/**
 * 通过 agent-fetch 二进制获取文章正文
 * @param url 文章 URL
 * @param timeout 超时时间（毫秒）
 * @returns 提取的正文内容，失败返回 null
 */
export function fetchArticleContent(
  url: string,
  timeout: number = 20000
): string | null {
  try {
    const stdout = execSync(`node ${agentFetchBin} "${url}" --json`, {
      timeout,
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    const result = JSON.parse(stdout.toString());
    // agent-fetch 通过 JSON 中的 success 字段区分成功/失败，而非退出码
    if (result.success === false) {
      // 提取失败（如 body_too_small、页面不存在等），静默跳过
      return null;
    }
    if (result.content?.textContent) {
      return result.content.textContent;
    }
    if (result.textContent) {
      return result.textContent;
    }
    return null;
  } catch (error) {
    logger.warn('内容提取失败', {
      stage: 'enrich',
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================
// Enrich Single Article
// ============================================================

/**
 * 充实单篇文章
 * @param item 文章对象
 * @param options 充实选项
 * @returns 充实结果
 */
export function enrichArticleItem(
  item: normalizedArticle,
  options: EnrichOptions
): EnrichArticleResult {
  const truncationMarkers = options.truncationMarkers ?? ["[...]", "Read more", "click here", "read more at", "来源：", "Original:"];
  const { needed } = needsEnrichment(
    item.normalizedContent,
    item.normalizedUrl,
    options,
    truncationMarkers
  );

  if (!needed) {
    return {
      enriched: false,
      originalContent: item.normalizedContent,
    };
  }

  const newContent = fetchArticleContent(item.normalizedUrl, options.fetchTimeout);

  if (!newContent) {
    return {
      enriched: false,
      originalContent: item.normalizedContent,
      error: `无法从 ${item.normalizedUrl} 提取内容`,
    };
  }

  // In-place replacement of normalizedContent
  item.normalizedContent = newContent;

  return {
    enriched: true,
    originalContent: item.normalizedContent,
    newContent,
  };
}

// ============================================================
// Batch Enrich Articles
// ============================================================

/**
 * 批量充实文章
 * @param articles 文章数组
 * @param options 充实选项
 * @returns 充实后的文章数组（in-place）
 */
export async function enrichArticles(
  articles: normalizedArticle[],
  options: EnrichOptions
): Promise<normalizedArticle[]> {
  if (!options.enabled) {
    logger.info("enrich disabled, skipping", { stage: "enrich" });
    return articles;
  }
  // Process in batches with full concurrency
  const batches: normalizedArticle[][] = [];
  for (let i = 0; i < articles.length; i += options.batchSize) {
    batches.push(articles.slice(i, i + options.batchSize));
  }
  await Promise.all(
    batches.map(batch => Promise.all(batch.map(article => enrichArticleItem(article, options))))
  );

  return articles;
}
