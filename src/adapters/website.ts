import type { RawItem, Source } from "../types/index";

export function discoverFeedUrl(baseUrl: string, html: string): string | null {
  const match = html.match(/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i);
  if (!match) {
    return null;
  }

  return new URL(match[1], baseUrl).toString();
}

export function extractPageTitle(html: string): string {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "Untitled page";
}

export async function collectWebsiteSource(source: Source, fetchImpl: typeof fetch = fetch): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  const html = await response.text();
  const feedUrl = discoverFeedUrl(source.url ?? "", html);

  // Website mode is an MVP fallback so a single-page record is better than dropping the source entirely.
  if (!feedUrl) {
    return [
      {
        id: `${source.id}-page`,
        sourceId: source.id,
        title: extractPageTitle(html),
        url: source.url ?? "",
        fetchedAt: new Date().toISOString(),
        metadataJson: "{}",
      },
    ];
  }

  return [
    {
      id: `${source.id}-feed`,
      sourceId: source.id,
      title: extractPageTitle(html),
      url: feedUrl,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({ discoveredFrom: source.url }),
    },
  ];
}
