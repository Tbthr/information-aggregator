import type { RawItem, Source } from "../types/index";

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
 * 从 HTML 文本中移除标签并清理空白
 */
function stripHtml(text: string): string {
  return text
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "") // 移除 SVG 元素
    .replace(/<[^>]+>/g, " ") // 移除其他 HTML 标签
    .replace(/\s+/g, " ")
    .trim();
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
export function parseGitHubTrendingHtml(html: string, sourceId: string): RawItem[] {
  // 查找所有 article 元素
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((match) => match[0]);

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
        const metaText = metaMatch ? stripHtml(metaMatch[1]) : "";

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

        const snippet = [description, language, todayStars ? `+${todayStars} stars today` : ""]
          .filter(Boolean)
          .join(" | ");

        return {
          id: `${sourceId}-${index + 1}`,
          sourceId,
          title,
          url,
          snippet: snippet || undefined,
          fetchedAt: new Date().toISOString(),
          metadataJson: JSON.stringify({
            provider: "github_trending",
            sourceType: "github_trending",
            contentType: "repository",
            ...meta,
          }),
        };
      } catch (error) {
        // 单个条目解析失败不影响其他条目
        console.warn(`[github-trending] Failed to parse article ${index + 1}:`, error);
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
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const url = source.url ?? "https://github.com/trending";

  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(15000), // 15 秒超时
    });

    if (!response.ok) {
      throw new Error(`GitHub Trending returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`GitHub Trending returned unexpected content type: ${contentType}`);
    }

    const html = await response.text();

    if (html.length === 0) {
      throw new Error("GitHub Trending returned empty response");
    }

    // 验证是否包含预期的 article 元素
    if (!html.includes("<article")) {
      throw new Error("GitHub Trending HTML structure changed: no <article> elements found");
    }

    return parseGitHubTrendingHtml(html, source.id);
  } catch (error) {
    // 区分不同类型的错误
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Failed to fetch GitHub Trending: ${error.message}`);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("GitHub Trending request timed out after 15 seconds");
    }
    throw error;
  }
}
