export function toArticle(item: {
  id: string
  title: string
  sourceName: string
  url: string
  publishedAt: Date | null
  summary: string | null
  content: string | null
}) {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName,
    sourceUrl: item.url,
    publishedAt: item.publishedAt?.toISOString() ?? "",
    summary: item.summary ?? "",
    content: item.content ?? "",
  }
}
