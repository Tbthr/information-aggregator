/**
 * Centralized configuration loader.
 * All config is loaded once and provided to modules on demand.
 *
 * Configuration sources:
 * - sources.yaml  → loadSources()  (unchanged structure)
 * - tags.yaml     → loadTags()     (unchanged structure)
 * - config.yaml   → loadConfigYaml() (new Zod-validated loader)
 * - env vars      → loadAuthConfigsFromEnv()
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { Source, SourceType, ContentType } from '../types/index.js'
import type { EnrichOptions } from '../pipeline/enrich.js'
import {
  AppConfigSchema,
  type AppConfig,
  type AiFlashSource,
  type RankingConfig,
  type DedupeConfig,
  type ContentConfig,
} from '../types/config.js'
import { loadAuthConfigsFromEnv } from './load-auth.js'
import { resolveEnvVars } from './resolve-env.js'

// ============================================================
// Daily Config (from config.yaml)
// ============================================================

export interface DailyConfig {
  aiFlashCategorization: {
    enabled: boolean
    maxCategories: number
    prompt: string
  }
}

// ============================================================
// Config returned by loadConfig (extends YAML-validated config)
// ============================================================

export interface LoadedAppConfig {
  sources: Source[]
  tags: import('../types/config.js').Tag[]
  enrichOptions: EnrichOptions
  dailyConfig: DailyConfig
  aiFlashSources: AiFlashSource[]
  rankingConfig: RankingConfig
  dedupeConfig: DedupeConfig
  contentConfig: ContentConfig
  authConfigs: Record<string, Record<string, unknown>>
}

// ============================================================
// Internal Helpers
// ============================================================

function loadSources(): Source[] {
  const sourcesPath = path.join(process.cwd(), 'config', 'sources.yaml')
  const sourcesContent = fs.readFileSync(sourcesPath, 'utf-8')
  const raw = yaml.load(sourcesContent) as { sources: Array<{
    type: string
    id: string
    name?: string
    url?: string
    enabled?: boolean
    tagIds?: string[]
    handle?: string
    weightScore?: number
    contentType?: string
    auth?: { authToken?: string; ct0?: string }
  }> }

  return raw.sources
    .filter(s => s.enabled !== false)
    .map(s => {
      if (!s.contentType) {
        throw new Error(`Source ${s.id} is missing required contentType field`)
      }

      return {
        type: s.type as SourceType,
        id: s.id,
        name: s.name ?? s.id,
        description: undefined,
        url: s.url ?? '',
        enabled: true,
        tagIds: s.tagIds ?? [],
        weightScore: null,
        contentType: s.contentType as ContentType,
        authConfigJson: s.auth ? JSON.stringify(resolveEnvVars(s.auth)) : null,
        sourceWeightScore: s.weightScore ?? 1,
      }
    })
}

function loadTags(): import('../types/config.js').Tag[] {
  // Tags are now embedded in config.yaml (previously in config/tags.yaml)
  const configPath = path.join(process.cwd(), 'config', 'config.yaml')
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(configContent) as { tags?: Array<{
    id: string
    name?: string
    description?: string
    enabled?: boolean
    includeRules?: string[]
    excludeRules?: string[]
    scoreBoost?: number
  }> }

  if (!raw.tags) return []

  return raw.tags
    .filter(t => t.enabled !== false)
    .map(t => ({
      id: t.id,
      name: t.name ?? t.id,
      description: t.description,
      enabled: t.enabled ?? true,
      includeRules: t.includeRules ?? [],
      excludeRules: t.excludeRules ?? [],
      scoreBoost: t.scoreBoost ?? 1.0,
    }))
}

/**
 * Load and validate config.yaml with Zod.
 * Handles missing config.yaml gracefully with defaults.
 */
function loadConfigYaml(): {
  enrichOptions: EnrichOptions
  dailyConfig: DailyConfig
  aiFlashSources: AiFlashSource[]
  rankingConfig: RankingConfig
  dedupeConfig: DedupeConfig
  contentConfig: ContentConfig
} {
  const configPath = path.join(process.cwd(), 'config', 'config.yaml')

  // If config.yaml doesn't exist yet, return defaults
  if (!fs.existsSync(configPath)) {
    return {
      enrichOptions: {
        enabled: true,
        batchSize: 10,
        minContentLength: 500,
        fetchTimeout: 20000,
      },
      dailyConfig: {
        aiFlashCategorization: {
          enabled: true,
          maxCategories: 6,
          prompt: '',
        },
      },
      aiFlashSources: [],
      rankingConfig: {
        sourceWeight: 0.4,
        engagement: 0.15,
      },
      dedupeConfig: {
        nearThreshold: 0.75,
      },
      contentConfig: {
        truncationMarkers: ['[...]', 'Read more', 'click here', 'read more at', '来源：', 'Original:'],
      },
    }
  }

  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as {
    enrich?: {
      enabled?: boolean
      batchSize?: number
      minContentLength?: number
      fetchTimeout?: number
    }
    aiFlashCategorization?: {
      enabled?: boolean
      prompt?: string
    }
    ranking?: {
      sourceWeight?: number
      engagement?: number
    }
    dedupe?: {
      nearThreshold?: number
    }
    content?: {
      truncationMarkers?: string[]
    }
    aiFlashSources?: Array<{
      id: string
      adapter: string
      url?: string
      enabled?: boolean
    }>
  }

  // Parse with Zod for validation (tags are loaded separately from tags.yaml)
  const parsed = AppConfigSchema.safeParse({
    tags: [],
    enrich: raw.enrich ?? {},
    aiFlashCategorization: raw.aiFlashCategorization ?? {},
    ranking: raw.ranking ?? {},
    dedupe: raw.dedupe ?? {},
    content: raw.content ?? {},
    aiFlashSources: raw.aiFlashSources ?? [],
  })

  if (!parsed.success) {
    throw new Error(`config.yaml validation failed: ${parsed.error.message}`)
  }

  const cfg = parsed.data

  // Build enrichOptions (EnrichOptions type from pipeline/enrich.ts)
  const enrichOptions: EnrichOptions = {
    enabled: cfg.enrich.enabled,
    batchSize: cfg.enrich.batchSize,
    minContentLength: cfg.enrich.minContentLength,
    fetchTimeout: cfg.enrich.fetchTimeout,
    // truncationMarkers lives in contentConfig, not enrichOptions
  }

  // Build dailyConfig
  const dailyConfig: DailyConfig = {
    aiFlashCategorization: {
      enabled: cfg.aiFlashCategorization.enabled,
      maxCategories: cfg.aiFlashCategorization.maxCategories,
      prompt: cfg.aiFlashCategorization.prompt,
    },
  }

  // aiFlashSources - map to include url (required by AiFlashSourceSchema)
  const aiFlashSources: AiFlashSource[] = cfg.aiFlashSources.map(s => ({
    id: s.id,
    adapter: s.adapter,
    url: s.url,
    enabled: s.enabled ?? true,
  }))

  return {
    enrichOptions,
    dailyConfig,
    aiFlashSources,
    rankingConfig: cfg.ranking,
    dedupeConfig: cfg.dedupe,
    contentConfig: cfg.content,
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Load all application configuration once.
 * Returns sources (sources.yaml), tags (tags.yaml), enrich/daily/ranking/dedupe/content/aiFlashSources (config.yaml),
 * and auth configs from environment variables.
 */
export async function loadConfig(): Promise<LoadedAppConfig> {
  const [sources, tags, yamlConfig, authConfigs] = await Promise.all([
    loadSources(),
    loadTags(),
    loadConfigYaml(),
    loadAuthConfigsFromEnv(),
  ])

  return {
    sources,
    tags,
    enrichOptions: yamlConfig.enrichOptions,
    dailyConfig: yamlConfig.dailyConfig,
    aiFlashSources: yamlConfig.aiFlashSources,
    rankingConfig: yamlConfig.rankingConfig,
    dedupeConfig: yamlConfig.dedupeConfig,
    contentConfig: yamlConfig.contentConfig,
    authConfigs,
  }
}
