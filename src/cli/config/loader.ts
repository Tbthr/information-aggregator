import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { resolveEnvVars } from '../lib/yaml-env.js'
import type { AggregatorConfig } from './types.js'

const CONFIG_DIR = path.resolve(process.cwd(), 'config')

export function loadConfig(): AggregatorConfig {
  const sources = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'sources.yaml'), 'utf-8')
  ) as { sources: unknown[] }

  const topics = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'topics.yaml'), 'utf-8')
  ) as { topics: unknown[] }

  const reports = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'reports.yaml'), 'utf-8')
  ) as { daily: unknown; weekly: unknown }

  const ai = yaml.load(
    fs.readFileSync(path.join(CONFIG_DIR, 'ai.yaml'), 'utf-8')
  ) as unknown

  return resolveEnvVars({
    sources: sources.sources,
    topics: topics.topics,
    daily: reports.daily,
    weekly: reports.weekly,
    ai,
  }) as AggregatorConfig
}
