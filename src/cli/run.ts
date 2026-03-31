// src/cli/run.ts
import { createLogger } from '../utils/logger'
import { JsonArticleStore } from '../archive/json-store'
import { resolveEnvVars } from '../config/resolve-env'
import * as yaml from 'js-yaml'
import { readFile } from 'fs/promises'
import { join } from 'path'

const logger = createLogger('cli:run')

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  ts: string
  stage: 'collect' | 'enrich' | 'dedupe' | 'score' | 'quadrant' | 'topic' | 'output'
  msg: string
  data?: Record<string, unknown>
}

function log(entry: LogEntry): void {
  console.log(JSON.stringify(entry))
}

async function loadConfig(path: string): Promise<unknown> {
  const content = await readFile(path, 'utf-8')
  const raw = yaml.load(content)
  return resolveEnvVars(raw)
}

async function main() {
  const startTime = Date.now()

  // 1. 收集阶段
  log({ level: 'info', ts: new Date().toISOString(), stage: 'collect', msg: '开始收集', data: { date: new Date().toISOString().split('T')[0] } })

  // TODO: 实现收集逻辑

  log({ level: 'info', ts: new Date().toISOString(), stage: 'output', msg: '日报生成完成', data: { durationMs: Date.now() - startTime } })
}

main().catch(err => {
  log({ level: 'error', ts: new Date().toISOString(), stage: 'output', msg: '执行失败', data: { error: String(err) } })
  process.exit(1)
})
