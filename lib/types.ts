// Tweet type kept as requested (still used in project)
export type Tweet = {
  id: string
  tweetId: string
  tab: string
  text: string
  url: string
  expandedUrl?: string
  publishedAt?: string
  fetchedAt: string
  authorHandle: string
  authorName?: string
  likeCount: number
  replyCount: number
  retweetCount: number
  summary?: string
  bullets: string[]
  categories: string[]
  score?: number
  articleImageUrl?: string
  media?: Array<{
    type: "photo" | "video" | "animated_gif"
    url: string
    width?: number
    height?: number
    previewUrl?: string
  }>
  quotedTweet?: {
    id: string
    text: string
    authorHandle: string
    authorName?: string
    likeCount: number
    replyCount: number
    retweetCount: number
    article?: { title: string; url?: string; previewText?: string }
    createdAt?: string
    media?: Array<{
      type: "photo" | "video" | "animated_gif"
      url: string
      width?: number
      height?: number
      previewUrl?: string
    }>
  }
  thread?: Array<{ id?: string; text?: string; author?: string }>
  parent?: { id?: string; text?: string; author?: string }
  article?: { title: string; url?: string; previewText?: string }
}
