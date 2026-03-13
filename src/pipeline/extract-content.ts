/**
 * 正文提取模块
 * 使用 @mozilla/readability 从 HTML 页面提取正文内容
 */

import { Readability } from "@mozilla/readability";
import { DOMParser as LinkedomDOMParser } from "linkedom";
import { createLogger, truncateWithLength } from "../utils/logger";

const logger = createLogger("pipeline:extract-content");

// 创建全局 DOMParser polyfill（如果不存在）
if (typeof globalThis.DOMParser === "undefined") {
  // @ts-ignore - linkedom 的 DOMParser 接口与标准略有不同
  globalThis.DOMParser = LinkedomDOMParser;
}

/**
 * 提取的正文内容
 */
export interface ExtractedContent {
  url: string;
  title?: string;
  content?: string;        // HTML 清理后的正文（HTML 格式）
  textContent?: string;    // 纯文本正文
  excerpt?: string;        // 摘要段落
  length?: number;         // 正文长度（字符数）
  extractedAt: string;
  error?: string;
}

/**
 * 正文提取选项
 */
export interface ContentExtractionOptions {
  timeout?: number;        // 超时时间（毫秒），默认 15000
  fetchImpl?: typeof fetch;
  maxLength?: number;      // 最大内容长度（字符数），超过则截断，默认不限制
}

/**
 * 从 URL 提取正文内容
 * @param url 要提取的页面 URL
 * @param options 提取选项
 * @returns 提取的内容，失败时返回包含 error 字段的对象
 */
export async function extractArticleContent(
  url: string,
  options: ContentExtractionOptions = {},
): Promise<ExtractedContent> {
  const {
    timeout = 15000,
    fetchImpl = fetch,
    maxLength,
  } = options;

  const extractedAt = new Date().toISOString();
  const startTime = Date.now();

  logger.info("Extracting content", { url, timeout });

  try {
    // 使用 AbortController 实现超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("Content extraction HTTP error", {
        url,
        status: response.status,
        elapsed,
      });
      return {
        url,
        extractedAt,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // 使用 DOMParser 解析 HTML（Bun 内置）
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // 使用 Readability 提取正文
    const reader = new Readability(doc, {
      charThreshold: 100,  // 最小字符数
    });

    const article = reader.parse();

    if (!article) {
      logger.warn("Content extraction parse failed", { url, elapsed });
      return {
        url,
        extractedAt,
        error: "Readability failed to parse article",
      };
    }

    // 处理内容长度限制
    let textContent = article.textContent ?? "";
    if (maxLength && textContent.length > maxLength) {
      textContent = textContent.slice(0, maxLength) + "...";
    }

    logger.info("Content extraction completed", {
      url,
      success: true,
      contentLength: textContent.length,
      elapsed,
    });

    logger.debug("Extracted content preview", {
      preview: truncateWithLength(textContent, 200),
    });

    return {
      url,
      title: article.title || undefined,
      content: article.content || undefined,
      textContent,
      excerpt: article.excerpt || undefined,
      length: textContent.length,
      extractedAt,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Content extraction failed", {
      url,
      error: errorMessage,
      elapsed,
    });

    return {
      url,
      extractedAt,
      error: errorMessage,
    };
  }
}

/**
 * 批量提取正文内容
 * @param urls 要提取的 URL 列表
 * @param options 提取选项
 * @returns 提取结果数组，与输入 URL 顺序一致
 */
export async function extractArticleContentBatch(
  urls: string[],
  options: ContentExtractionOptions = {},
): Promise<ExtractedContent[]> {
  // 使用 Promise.allSettled 确保单个失败不影响其他
  const results = await Promise.allSettled(
    urls.map((url) => extractArticleContent(url, options))
  );

  return results.map((result) =>
    result.status === "fulfilled" ? result.value : {
      url: "",
      extractedAt: new Date().toISOString(),
      error: result.reason?.message ?? "Unknown error",
    }
  );
}

/**
 * 判断提取结果是否成功
 */
export function isExtractionSuccess(content: ExtractedContent): boolean {
  return !content.error && !!content.textContent;
}

/**
 * 获取提取内容的摘要（前 N 个字符）
 */
export function getContentPreview(content: ExtractedContent, maxLength = 200): string {
  if (!content.textContent) {
    return content.error ?? "No content available";
  }
  return content.textContent.length > maxLength
    ? content.textContent.slice(0, maxLength) + "..."
    : content.textContent;
}
