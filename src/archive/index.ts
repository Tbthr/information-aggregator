export interface Article {
  id: string
  sourceId: string
  sourceName: string
  title: string
  url: string
  author: string
  publishedAt: string
  kind: 'article' | 'tweet'
  content: string
}

export interface ArticleStore {
  save(date: string, items: Article[]): Promise<void>
  findByUrl(url: string): Promise<Article | null>
  findAllByDate(date: string): Promise<Article[]>
}

