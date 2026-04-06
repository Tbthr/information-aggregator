/**
 * 统一网页内容抓取抽象
 * 优先 defuddle，fallback jina，永远不抛异常。
 */

export interface FetchWithFallbackOptions {
  timeout?: number;
  fetchImpl?: typeof fetch;
}

/**
 * 优先 defuddle，fallback jina，返回纯净文本。
 * 永远不抛异常；所有失败均返回 null。
 */
export async function fetchWithFallback(
  url: string,
  timeout: number = 20000,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  // Step 1: defuddle
  const defuddleResult = await tryFetch(`https://defuddle.md/${url}`, timeout, fetchImpl);
  if (defuddleResult !== null) return defuddleResult;

  // Step 2: jina fallback
  const jinaResult = await tryFetch(`https://r.jina.ai/${url}`, timeout, fetchImpl);
  return jinaResult;
}

async function tryFetch(
  url: string,
  timeout: number,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetchImpl(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const text = await resp.text();
    // r.jina.ai 返回 200 但内容是错误页
    if (/<title>Error<\/title>/i.test(text)) return null;
    if (text.includes("Warning:") && text.includes("error")) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * 归一化 ai-flash markdown 标记，使 defuddle 和 jina 输出共用同一套解析逻辑。
 *
 * jina 输出:    ## **今日摘要**[]()   /  ## **AI资讯日报多渠道**[]()
 * defuddle 输出: ## 今日摘要          /  ## AI资讯日报多渠道
 *
 * 归一化后统一为: ## 今日摘要 / ## AI资讯日报多渠道
 */
export function normalizeAiFlashMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (/^## /.test(line)) {
        // jina format: ## **Title**[]() or ## **Title**
        return line
          .replace(/\*\*([^*]+)\*\*\[\]\(\)/, "$1") // ## **Title**[]() -> ## Title
          .replace(/\*\*([^*]+)\*\*/g, "$1"); // ## **Title** -> ## Title
      }
      return line;
    })
    .join("\n");
}
