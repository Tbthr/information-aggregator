// ── API Response ──

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
  meta?: {
    timing?: {
      generatedAt: string
      latencyMs: number
    }
    pagination?: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    query?: Record<string, unknown>
  }
}

// ── Domain Types ──

export type Article = {
  id: string
  title: string
  source: string
  sourceUrl: string
  publishedAt: string
  summary: string
  bullets: string[]
  content: string
  imageUrl?: string
  category?: string
  aiScore?: number
  isBookmarked?: boolean
}

export type NewsFlash = {
  id: string
  time: string
  text: string
}

export type TimelineEvent = {
  id: string
  date: string
  dayLabel: string
  title: string
  summary: string
}

export type CustomView = {
  id: string
  name: string
  icon: string
  description: string
  articles: Article[]
}

export type DailyOverview = {
  date: string
  summary: string
}

export type WeeklyReport = {
  weekNumber: string
  headline: string
  subheadline: string
  editorial: string
}

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
  isBookmarked?: boolean
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

export type XTab = "bookmarks" | "likes" | "home" | "lists"

export type XPageConfigData = {
  tab: string
  enabled: boolean
  birdMode: string
  count: number
  fetchAll: boolean
  maxPages?: number
  authTokenEnv?: string
  ct0Env?: string
  listsJson?: string
  filterPrompt?: string
  enrichEnabled: boolean
  enrichScoring: boolean
  enrichKeyPoints: boolean
  enrichTagging: boolean
  timeWindow: string
  sortOrder: string
}
