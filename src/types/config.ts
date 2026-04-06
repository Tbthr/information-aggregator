import { z } from 'zod'

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  includeRules: z.array(z.string()).optional().default([]),
  excludeRules: z.array(z.string()).optional().default([]),
  scoreBoost: z.number().optional().default(1.0),
})

export const EnrichSchema = z.object({
  enabled: z.boolean().optional().default(true),
  batchSize: z.number().optional().default(10),
  minContentLength: z.number().optional().default(500),
  fetchTimeout: z.number().optional().default(20000),
})

export const AiFlashCategorizationSchema = z.object({
  enabled: z.boolean().optional().default(true),
  maxCategories: z.number().optional().default(6),
  prompt: z.string().optional().default(''),
})

export const RankingSchema = z.object({
  sourceWeight: z.number().optional().default(0.4),
  engagement: z.number().optional().default(0.15),
})

export const DedupeSchema = z.object({
  nearThreshold: z.number().optional().default(0.75),
})

export const ContentSchema = z.object({
  truncationMarkers: z.array(z.string()).optional().default([
    '[...]', 'Read more', 'click here', 'read more at', '来源：', 'Original:',
  ]),
})

export const AiFlashSourceSchema = z.object({
  id: z.string(),
  adapter: z.enum(['hexi-daily', 'juya-daily', 'clawfeed-daily']),
  url: z.string(),
  enabled: z.boolean().optional().default(true),
})

export const AppConfigSchema = z.object({
  tags: z.array(TagSchema),
  enrich: EnrichSchema,
  aiFlashCategorization: AiFlashCategorizationSchema,
  ranking: RankingSchema,
  dedupe: DedupeSchema,
  content: ContentSchema,
  aiFlashSources: z.array(AiFlashSourceSchema),
})

// 从 Schema 推导 Type
export type AppConfig = z.infer<typeof AppConfigSchema>
export type Tag = z.infer<typeof TagSchema>
export type AiFlashSource = z.infer<typeof AiFlashSourceSchema>
export type EnrichOptions = z.infer<typeof EnrichSchema>
export type RankingConfig = z.infer<typeof RankingSchema>
export type DedupeConfig = z.infer<typeof DedupeSchema>
export type ContentConfig = z.infer<typeof ContentSchema>
