/**
 * Centralized configuration loader.
 * All config is loaded once and provided to modules on demand.
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { Source, Tag } from '../types/index.js'
import type { EnrichOptions } from '../pipeline/enrich.js'

// ============================================================
// Reports Daily Config
// ============================================================

export interface AiFlashSource {
  id: string
  adapter: string
  enabled: boolean
}

export interface DailyConfig {
  quadrantPrompt: string
}

// ============================================================
// App Config Types
// ============================================================

export interface AppConfig {
  sources: Source[]
  tags: Tag[]
  enrichOptions: EnrichOptions
  dailyConfig: DailyConfig
  aiFlashSources: AiFlashSource[]
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
        type: s.type,
        id: s.id,
        name: s.name ?? s.id,
        description: undefined,
        url: s.url ?? '',
        enabled: true,
        tagIds: s.tagIds ?? [],
        weightScore: null,
        contentType: s.contentType,
        authConfigJson: s.auth ? JSON.stringify(s.auth) : null,
        sourceWeightScore: s.weightScore ?? 1,
      }
    })
}

function loadTags(): Tag[] {
  const tagsPath = path.join(process.cwd(), 'config', 'tags.yaml')
  const tagsContent = fs.readFileSync(tagsPath, 'utf-8')
  const raw = yaml.load(tagsContent) as { tags: Array<{
    id: string
    name?: string
    description?: string
    enabled?: boolean
    includeRules?: string[]
    excludeRules?: string[]
    scoreBoost?: number
  }> }

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

function loadReportsConfig(): { enrichOptions: EnrichOptions; dailyConfig: DailyConfig } {
  const configPath = path.join(process.cwd(), 'config', 'reports.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as {
    daily?: { quadrantPrompt?: string }
    enrich?: { enabled?: boolean; batchSize?: number; minContentLength?: number; fetchTimeout?: number }
  }

  const enrichOptions: EnrichOptions = {
    batchSize: raw.enrich?.batchSize ?? 10,
    minContentLength: raw.enrich?.minContentLength ?? 500,
    fetchTimeout: raw.enrich?.fetchTimeout ?? 20000,
  }

  const dailyConfig: DailyConfig = {
    quadrantPrompt: raw.daily?.quadrantPrompt ?? '',
  }

  return { enrichOptions, dailyConfig }
}

function loadAiFlashSources(): AiFlashSource[] {
  const configPath = path.join(process.cwd(), 'config', 'ai-flash-sources.yaml')
  if (!fs.existsSync(configPath)) {
    return []
  }
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as { sources?: Array<{
    id: string
    adapter: string
    enabled?: boolean
  }> }

  if (!raw.sources) {
    return []
  }

  return raw.sources.map(s => {
    if (!s.id || !s.adapter) {
      throw new Error(`AI flash source missing required id or adapter field`)
    }
    return {
      id: s.id,
      adapter: s.adapter,
      enabled: s.enabled ?? true,
    }
  })
}

// ============================================================
// Public API
// ============================================================

/**
 * Load all application configuration once.
 * Returns sources, tags, enrich options, and daily report config.
 */
export function loadConfig(): AppConfig {
  const sources = loadSources()
  const tags = loadTags()
  const { enrichOptions, dailyConfig } = loadReportsConfig()
  const aiFlashSources = loadAiFlashSources()

  return { sources, tags, enrichOptions, dailyConfig, aiFlashSources }
}
