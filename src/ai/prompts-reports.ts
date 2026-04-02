import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

// ============================================================
// Config Loading
// ============================================================

interface ReportsConfig {
  daily: {
    quadrantPrompt: string
  }
}

function loadReportsConfig(): ReportsConfig {
  const configPath = path.join(process.cwd(), 'config', 'reports.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  return yaml.load(content) as ReportsConfig
}

// ============================================================
// Quadrant Classification
// ============================================================

export function getQuadrantPrompt(): string {
  return loadReportsConfig().daily.quadrantPrompt
}

export function parseQuadrantResult(raw: string): { quadrant: '尝试' | '深度' | '地图感'; reason: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (['尝试', '深度', '地图感'].includes(parsed.quadrant)) {
      return parsed
    }
  } catch { /* ignore */ }
  return null
}
