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

export interface DailyConfig {
  digestPrompt: string
}

// ============================================================
// App Config Types
// ============================================================

export interface AppConfig {
  sources: Source[]
  tags: Tag[]
  enrichOptions: EnrichOptions
  dailyConfig: DailyConfig
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
    daily?: { digestPrompt?: string }
    enrich?: { enabled?: boolean; batchSize?: number; minContentLength?: number; fetchTimeout?: number }
  }

  const enrichOptions: EnrichOptions = {
    batchSize: raw.enrich?.batchSize ?? 10,
    minContentLength: raw.enrich?.minContentLength ?? 500,
    fetchTimeout: raw.enrich?.fetchTimeout ?? 20000,
  }

  const dailyConfig: DailyConfig = {
    digestPrompt: raw.daily?.digestPrompt ?? '',
  }

  return { enrichOptions, dailyConfig }
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

  return { sources, tags, enrichOptions, dailyConfig }
}
