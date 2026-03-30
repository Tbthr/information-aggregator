export type Source = {
  id: string
  name: string
  url: string | null
  kind: string
  enabled: boolean
  defaultTopicIds: string[]
  description?: string | null
}

export type TopicConfig = {
  id: string
  name: string
  description?: string | null
  includeRules: string[]
  excludeRules: string[]
  scoreBoost: number
  displayOrder: number
  maxItems: number
}
