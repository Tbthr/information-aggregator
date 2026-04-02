/**
 * 内容充实模块
 * 负责判断哪些文章需要从原 URL 提取完整正文，以及执行提取
 */

import { execFile } from "child_process";
import { promisify } from "util";
import type { normalizedArticle } from "../types/index.js";

const execFileAsync = promisify(execFile);

// ============================================================
// Types
// ============================================================

export interface EnrichOptions {
  batchSize: number;
  minContentLength: number;
  fetchTimeout: number;
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
 * @returns 'pass' | 'fail'
 */
export function contentQuality(text: string, minLength = 500): ContentQualityResult {
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
  const truncationMarkers = ["[...]", "[...].", "Read more", "read more", "Read more...", "read more..."];
  const hasTruncationMarker = truncationMarkers.some((marker) =>
    plainText.toLowerCase().includes(marker.toLowerCase())
  );
  if (hasTruncationMarker) {
    return {
      status: "fail",
      reason: "内容包含截断标记 [...] 或 Read more",
    };
  }

  // Rule 3: Count sentences (ends with . ! ？)
  const sentences = plainText.split(/[.!?？]/).filter((s) => s.trim().length > 0);
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
 * @returns {needed, reason}
 */
export function needsEnrichment(
  normalizedContent: string,
  url: string | undefined,
  options: EnrichOptions
): NeedsEnrichmentResult {
  const quality = contentQuality(normalizedContent, options.minContentLength);

  // Quality sufficient → not needed
  if (quality.status === "pass") {
    return { needed: false, reason: "内容质量达标" };
  }

  // Quality insufficient + URL → needed
  if (quality.status === "fail" && url) {
    return { needed: true, reason: quality.reason || "内容质量不达标且有 URL 可供提取" };
  }

  // Quality insufficient + no URL → not needed
  return { needed: false, reason: "内容质量不达标但无 URL可供提取" };
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
export async function fetchArticleContent(
  url: string,
  timeout: number
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "node",
      ["./node_modules/.bin/agent-fetch", url],
      { timeout, cwd: process.cwd() }
    );

    const result = JSON.parse(stdout);
    if (result.content && result.content.textContent) {
      return result.content.textContent;
    }
    if (result.textContent) {
      return result.textContent;
    }
    return null;
  } catch (error) {
    console.error(`agent-fetch failed for ${url}:`, error);
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
export async function enrichArticleItem(
  item: normalizedArticle,
  options: EnrichOptions
): Promise<EnrichArticleResult> {
  const { needed, reason } = needsEnrichment(
    item.normalizedContent,
    item.normalizedUrl,
    options
  );

  if (!needed) {
    return {
      enriched: false,
      originalContent: item.normalizedContent,
    };
  }

  const newContent = await fetchArticleContent(item.normalizedUrl, options.fetchTimeout);

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
  // Process in batches
  for (let i = 0; i < articles.length; i += options.batchSize) {
    const batch = articles.slice(i, i + options.batchSize);
    await Promise.all(batch.map((article) => enrichArticleItem(article, options)));
  }

  return articles;
}
