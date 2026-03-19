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
