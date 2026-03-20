export interface DailyReportConfig {
  packs: "all" | string[]
  maxItems: number
  sort: "ranked" | "recent"
  enableOverview: boolean
  newsFlashes: {
    enabled: boolean
    maxCount: number
  }
}

export interface WeeklyReportConfig {
  days: number
  maxTimelineEvents: number
  maxDeepDives: number
  enableEditorial: boolean
}

export interface SchedulerConfig {
  jobs: {
    [key: string]: {
      cron: string
      description: string
      enabled: boolean
    }
  }
}
