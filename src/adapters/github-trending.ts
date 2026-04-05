import type { RawItem, Source } from "../types/index";
import { createLogger, truncateWithLength } from "../utils/logger";
import { stripHtml } from "../../lib/utils.js";

const logger = createLogger("adapter:github-trending");

interface GitHubTrendingMeta {
  stars?: string;
  forks?: string;
  todayStars?: string;
  language?: string;
  author?: string;
  repo?: string;
}

/**
 * 提取星标数（格式：12k, 1,234 等）
 * 优先匹配更长的数字格式（包含小数点的 k）
 */
function extractStars(text: string): string | undefined {
  // 先尝试匹配带小数点的格式（如 1.2k）
  const decimalMatch = text.match(/([\d,]+\.\d+[kK]?)\s*stars?/i);
  if (decimalMatch?.[1]) {
    return decimalMatch[1].trim();
  }
  // 再匹配普通格式（如 12k, 1,234）
  const match = text.match(/([\d,]+[kK]?)\s*stars?/i);
  return match?.[1]?.trim() ?? undefined;
}

/**
 * 提取 fork 数
 */
function extractForks(text: string): string | undefined {
  // 先尝试匹配带小数点的格式（如 1.2k）
  const decimalMatch = text.match(/([\d,]+\.\d+[kK]?)\s*forks?/i);
  if (decimalMatch?.[1]) {
    return decimalMatch[1].trim();
  }
  // 再匹配普通格式（如 12k, 1,234）
  const match = text.match(/([\d,]+[kK]?)\s*forks?/i);
  return match?.[1]?.trim() ?? undefined;
}

/**
 * 提取今日新增星标
 */
function extractTodayStars(text: string): string | undefined {
  const patterns = [
    /([\d,]+[kK]?)\s+stars?\s+today/i,
    /today:\s*([\d,]+[kK]?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}


/**
 * 清理标题中的 SVG 和多余空白
 */
function cleanTitle(title: string): string {
  return title
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 解析 GitHub Trending HTML
 */
export function parseGitHubTrendingHtml(html: string, sourceId: string, sourceType: string, sourceContentType: string, sourceName: string): RawItem[] {
  // 查找所有 article 元素
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((match) => match[0]);

  const fetchedAt = new Date().toISOString();

  const items = articles
    .map((article, index): RawItem | null => {
      try {
        // 提取链接 - 优先匹配 trending 页面的链接
        const hrefMatch = article.match(/<a[^>]+href="\/trending\/([^"]+)"/i) || article.match(/<a[^>]+href="([^"]*\/[^"]*)"/i);
        const href = hrefMatch?.[1];
        if (!href) {
          return null;
        }

        const url = href.startsWith("/") || href.startsWith("./") ? new URL(href, "https://github.com").toString() : href;

        // 提取标题（作者 / 仓库名）
        const titleMatch = article.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
        const title = cleanTitle(titleMatch?.[1] ?? "") || `Repo ${index + 1}`;

        // 解析作者和仓库名
        const parts = title.split("/").map((p) => p.trim());
        const author = parts[0] ?? "";
        const repo = parts[1]?.replace(/\s+.*/, "") ?? "";

        // 提取描述
        const descMatch = article.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const description = descMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";

        // 提取编程语言
        const languageMatch = article.match(/itemprop="programmingLanguage">([\s\S]*?)<\/span>/i);
        const language = languageMatch?.[1]?.trim();

        // 提取元数据块（包含星标信息）
        // 匹配包含 float-sm 类的 div，这是 GitHub 存放 stars/forks 等元数据的地方
        const metaPattern = /<div[^>]*class="[^"]*\bfloat-sm\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
        const metaMatch = article.match(metaPattern);
        const metaText = metaMatch ? stripHtml(metaMatch[1], { removeSvg: true }) : "";

        const stars = extractStars(metaText);
        const forks = extractForks(metaText);
        const todayStars = extractTodayStars(metaText);

        // 构建元数据
        const meta: GitHubTrendingMeta = {
          stars,
          forks,
          todayStars,
          language,
          author,
          repo,
        };

        return {
          id: `${sourceId}-${index + 1}`,
          sourceId,
          sourceType,
          contentType: sourceContentType,
          sourceName,
          title,
          url,
          fetchedAt,
          publishedAt: fetchedAt, // GitHub trending doesn't provide per-item timestamps
          metadataJson: JSON.stringify(meta),
        };
      } catch (error) {
        // 单个条目解析失败不影响其他条目
        logger.warn('文章解析失败', {
          stage: 'collect',
          source: 'github-trending',
          articleIndex: index + 1,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

  return items.filter((item): item is RawItem => item !== null && item.url !== "https://github.com/");
}

/**
 * 收集 GitHub Trending 数据源
 */
export async function collectGitHubTrendingSource(
  source: Source,
  options: { timeWindow: number; fetchImpl?: typeof fetch } = { timeWindow: 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const { fetchImpl = fetch } = options;
  const url = source.url ?? "https://github.com/trending";
  const startTime = Date.now();

  logger.info("Fetching GitHub Trending", { url, sourceId: source.id });

  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(15000), // 15 秒超时
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      logger.error("GitHub Trending fetch failed", {
        url,
        status: response.status,
        elapsed,
      });
      throw new Error(`GitHub Trending returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      logger.error("GitHub Trending unexpected content type", {
        url,
        contentType,
        elapsed,
      });
      throw new Error(`GitHub Trending returned unexpected content type: ${contentType}`);
    }

    const html = await response.text();

    if (html.length === 0) {
      logger.error("GitHub Trending empty response", { url, elapsed });
      throw new Error("GitHub Trending returned empty response");
    }

    // 验证是否包含预期的 article 元素
    if (!html.includes("<article")) {
      logger.error("GitHub Trending HTML structure changed", { url, elapsed });
      throw new Error("GitHub Trending HTML structure changed: no <article> elements found");
    }

    logger.info("GitHub Trending fetch completed", {
      url,
      status: response.status,
      size: html.length,
      elapsed,
    });

    logger.debug("GitHub Trending response preview", {
      preview: truncateWithLength(html, 500),
    });

    return parseGitHubTrendingHtml(html, source.id, source.type, source.contentType, source.name);
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // 区分不同类型的错误
    if (error instanceof TypeError && error.message.includes("fetch")) {
      logger.error("GitHub Trending fetch network error", {
        url,
        error: error.message,
        elapsed,
      });
      throw new Error(`Failed to fetch GitHub Trending: ${error.message}`);
    }
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("GitHub Trending request timeout", { url, elapsed });
      throw new Error("GitHub Trending request timed out after 15 seconds");
    }

    logger.error("GitHub Trending fetch error", {
      url,
      error: error instanceof Error ? error.message : String(error),
      elapsed,
    });
    throw error;
  }
}
