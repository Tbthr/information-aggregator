import type { RawItem, Source } from "../types/index";

export function parseGitHubTrendingHtml(html: string, sourceId: string): RawItem[] {
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((match) => match[0]);

  return articles.map((article, index) => {
    const href = article.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? "";
    const title = article.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? `Repo ${index + 1}`;
    const description = article.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const language = article.match(/itemprop="programmingLanguage">([\s\S]*?)<\/span>/i)?.[1]?.trim();

    return {
      id: `${sourceId}-${index + 1}`,
      sourceId,
      title,
      url: new URL(href, "https://github.com").toString(),
      snippet: [description, language].filter(Boolean).join(" | "),
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "github_trending",
        sourceType: "github_trending",
        contentType: "repository",
      }),
    };
  }).filter((item) => item.url !== "https://github.com/");
}

export async function collectGitHubTrendingSource(source: Source, fetchImpl: typeof fetch = fetch): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "https://github.com/trending");
  return parseGitHubTrendingHtml(await response.text(), source.id);
}
