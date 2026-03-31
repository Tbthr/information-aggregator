export interface Source {
  type: 'rss' | 'json-feed' | 'twitter'
  id: string
  name: string
  url?: string
  handle?: string
  enabled: boolean
  topics: string[]
  auth?: {
    authToken: string
    ct0?: string
  }
  config?: Record<string, unknown>
}

export interface Topic {
  id: string
  name: string
  description?: string
  includeRules: string[]
  excludeRules: string[]
  maxItems: number
  scoreBoost?: number
  displayOrder?: number
}

export interface DailyConfig {
  maxItems: number
  minScore: number
  topicPrompt: string
  topicSummaryPrompt: string
}

export interface WeeklyConfig {
  days: number
  pickCount: number
  editorialPrompt?: string
  pickReasonPrompt?: string
}

export interface AIProvider {
  apiKey: string
  model: string
  baseUrl: string
}

export interface AIConfig {
  default: string
  providers: Record<string, AIProvider>
  retry?: {
    maxRetries: number
    initialDelayMs: number
    maxDelayMs: number
    backoffFactor: number
  }
  batch?: {
    size: number
    concurrency: number
  }
}

export interface AggregatorConfig {
  sources: Source[]
  topics: Topic[]
  daily: DailyConfig
  weekly: WeeklyConfig
  ai: AIConfig
}
