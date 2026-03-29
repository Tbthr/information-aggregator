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
  content: string
  isBookmarked?: boolean
}

export type CustomView = {
  id: string
  name: string
  icon: string
  description: string
  articles: Article[]
}

export type DigestTopic = {
  id: string
  order: number
  title: string
  summary: string
  itemIds: string[]    // LEGACY: kept for migration
  tweetIds: string[]   // LEGACY: kept for migration
  contentIds: string[] // NEW: unified content references
  topicScoresJson?: string
}

export type DailyReportData = {
  date: string
  dayLabel: string
  topicCount: number
  errorMessage?: string | null
  errorSteps?: string[] | null
  topics: DigestTopic[]
  contents: Content[]
}

export type WeeklyPick = {
  id: string
  order: number
  contentId: string
  reason: string
}

// Unified content reference type (matches Prisma Content model)
export type Content = {
  id: string
  kind: string
  sourceId: string
  title?: string | null
  body?: string | null
  url: string
  authorLabel?: string | null
  publishedAt?: string | null
  fetchedAt: string
  engagementScore?: number | null
  qualityScore?: number | null
  topicIds: string[]
  topicScoresJson?: string | null
  metadataJson?: string | null
  summary?: string | null
}

export type WeeklyReportData = {
  weekNumber: string | null
  editorial: string | null
  errorMessage?: string | null
  errorSteps?: string[] | null
  picks: WeeklyPick[]
  contents: Content[]
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
  listsJson?: string
  filterPrompt?: string
  enrichEnabled: boolean
  enrichScoring: boolean
  enrichKeyPoints: boolean
  enrichTagging: boolean
  timeWindow: string
  sortOrder: string
}
