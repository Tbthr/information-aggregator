# 信息聚合器清理实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理废弃的 Next.js + Prisma + Supabase 架构，实现 YAML 配置 + CLI + GitHub Workflow 的轻量架构

**Architecture:**
- CLI 单一命令 `aggregator run` 聚合收集 + 日报生成
- JSON store 作为存档接口实现（适配器模式）
- 日报按 quadrant（尝试/深度/地图感）组织，AI 分类
- 全阶段结构化 JSON 日志便于诊断
- GitHub Actions: `run.yml` 收集+生成，`pages.yml` 部署 Pages

**Tech Stack:** TypeScript, Bun, js-yaml, @mozilla/readability, markdown-it

---

## File Structure

### 新建文件
- `src/archive/json-store.ts` — JSON 存档实现
- `src/config/resolve-env.ts` — YAML env var 替换
- `src/cli/run.ts` — CLI 入口
- `.github/workflows/run.yml` — 收集+日报 workflow
- `.github/workflows/pages.yml` — GitHub Pages workflow

### 修改文件
- `src/archive/index.ts` — 更新 Article 接口和 ArticleStore 方法签名
- `src/reports/daily.ts` — 移除 Prisma，改用 JSON store，按 quadrant 重组输出
- `src/ai/prompts-reports.ts` — 更新 topicSummaryPrompt（生成摘要+要点），添加 quadrantPrompt
- `package.json` — 移除 Next.js/Prisma/Radix，添加 js-yaml
- `.gitignore` — 确保 .env, .next, node_modules 排除

### 删除文件/目录
- `app/`, `components/`, `hooks/` — Next.js 前端
- `lib/prisma.ts`, `lib/api-client.ts`, `lib/api-response.ts` — Next.js 专用
- `prisma/` — Prisma schema + migrations
- `src/archive/upsert-content-prisma.ts` — Prisma 实现
- `src/config/load-pack-prisma.ts` + `.test.ts` — Prisma 加载器
- `src/pipeline/run-collect-job.ts` — Prisma 依赖
- `src/reports/weekly.ts` — 周报（已移除）
- `config/packs/` — Pack 数据（随 Prisma 废弃）
- `scripts/diagnostics.ts` — 逻辑内嵌到 run 命令
- `.env.example`
- `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vercel.json`, `eslint.config.js`
- `.next/`, `tsconfig.tsbuildinfo`

---

## Task 1: 创建 JSON Store

**Files:**
- Create: `src/archive/json-store.ts`
- Modify: `src/archive/index.ts` (更新 Article 接口和 ArticleStore 签名)

- [ ] **Step 1: 更新 Article 接口**

```typescript
// src/archive/index.ts
export interface Article {
  id: string
  sourceId: string
  sourceName: string
  title: string
  url: string
  author: string
  publishedAt: string
  kind: 'article' | 'tweet'
  content: string
}

export interface ArticleStore {
  save(date: string, items: Article[]): Promise<void>
  findByUrl(url: string): Promise<Article | null>
  findAllByDate(date: string): Promise<Article[]>
}
```

- [ ] **Step 2: 创建 JSON store 实现**

```typescript
// src/archive/json-store.ts
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join } from 'path'
import type { Article, ArticleStore } from './index'

interface DataFile {
  date: string
  collectedAt: string
  items: Article[]
  totalItems: number
}

export class JsonArticleStore implements ArticleStore {
  constructor(private dataDir: string = 'data') {}

  async save(date: string, items: Article[]): Promise<void> {
    const filePath = join(this.dataDir, `${date}.json`)
    const data: DataFile = {
      date,
      collectedAt: new Date().toISOString(),
      items,
      totalItems: items.length,
    }
    await mkdir(this.dataDir, { recursive: true })
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async findAllByDate(date: string): Promise<Article[]> {
    const filePath = join(this.dataDir, `${date}.json`)
    try {
      const content = await readFile(filePath, 'utf-8')
      const data: DataFile = JSON.parse(content)
      return data.items
    } catch {
      return []
    }
  }

  async findByUrl(url: string): Promise<Article | null> {
    const files = await readdir(this.dataDir)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const content = await readFile(join(this.dataDir, file), 'utf-8')
      const data: DataFile = JSON.parse(content)
      const found = data.items.find(item => item.url === url)
      if (found) return found
    }
    return null
  }
}
```

- [ ] **Step 3: 运行验证**

```bash
bun run src/cli/run.ts
```
Expected: CLI 入口存在，可 import json-store（尚未调用，日志显示阶段未开始）

- [ ] **Step 4: Commit**

```bash
git add src/archive/json-store.ts src/archive/index.ts
git commit -m "feat(archive): add JSON store implementation

- Add Article interface with sourceId/sourceName fields
- JsonArticleStore implements save/findByUrl/findAllByDate
- Uses data/YYYY-MM-DD.json format"
```

---

## Task 2: 创建 resolve-env 工具

**Files:**
- Create: `src/config/resolve-env.ts`

- [ ] **Step 1: 创建 resolve-env 函数**

```typescript
// src/config/resolve-env.ts
export function resolveEnvVars<T>(obj: T): T {
  const str = JSON.stringify(obj)
  const resolved = str.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? '')
  return JSON.parse(resolved)
}
```

- [ ] **Step 2: 测试 env 替换**

```typescript
// src/config/resolve-env.test.ts
import { describe, it, expect } from 'bun:test'
import { resolveEnvVars } from './resolve-env'

describe('resolveEnvVars', () => {
  it('replaces env var placeholders', () => {
    const input = { apiKey: '${TEST_API_KEY}' }
    process.env.TEST_API_KEY = 'secret123'
    const result = resolveEnvVars(input)
    expect(result).toEqual({ apiKey: 'secret123' })
  })

  it('returns empty string for missing env vars', () => {
    const input = { apiKey: '${MISSING_KEY}' }
    const result = resolveEnvVars(input)
    expect(result).toEqual({ apiKey: '' })
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
bun test src/config/resolve-env.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/config/resolve-env.ts src/config/resolve-env.test.ts
git commit -m "feat(config): add resolveEnvVars for YAML env substitution"
```

---

## Task 3: 更新 prompts-reports

**Files:**
- Modify: `src/ai/prompts-reports.ts`

- [ ] **Step 1: 添加 quadrantPrompt 和更新 topicSummaryPrompt**

```typescript
// src/ai/prompts-reports.ts

export const QUADRANT_PROMPT = `你是一位信息分类分析师。请将以下内容分配到对应的象限。

象限定义：
- 尝试：贴近工作、时效性强的内容（近+热点/趋势），适合快速尝试
- 深度：贴近工作、经典/系统性内容（近+经典），适合深入研究
- 地图感：与工作有距离但有参考价值（远+趋势/经典），扩展视野

分类标准：
- 生产力距离：内容与"你当前工作"的距离（近=直接相关，中=间接相关，远=噪音/八卦）
- 保鲜期：内容过时速度（热点=突发新闻，中=趋势变化，远=经典教程）
- 象限 = 生产力距离 × 保鲜期 组合

请以 JSON 格式输出：
{
  "quadrant": "尝试" | "深度" | "地图感",
  "reason": "分类理由"
}`

export const TOPIC_SUMMARY_PROMPT = `你是一位专业的信息分析师。请分析以下话题下的内容，生成一段话题摘要和核心要点。

要求：
1. 话题摘要：提炼该话题的核心信息和关键趋势，100-200字
2. 核心要点：列出该话题最重要的 2-5 个要点，每个要点用一句话概括
3. 不要简单罗列内容标题，要综合分析提炼
4. 用中文撰写

请以 JSON 格式输出：
{
  "summary": "话题摘要文本",
  "keyPoints": ["要点1", "要点2", "要点3"]
}

示例：
{
  "summary": "本周 AI 编程领域迎来多项重磅更新，Claude 4 在复杂推理任务上超越 GPT-4，GitHub Copilot 新增自然语言代码重构功能，各家 IDE 纷纷集成 AI 辅助开发能力。",
  "keyPoints": [
    "Claude 4 发布，多模态能力大幅提升",
    "GitHub Copilot Enterprise 支持自然语言代码重构",
    "Cursor 集成新 AI 模型，代码补全延迟降低 40%"
  ]
}`
```

- [ ] **Step 2: 添加解析函数**

```typescript
export function parseQuadrantResult(raw: string): { quadrant: '尝试' | '深度' | '地图感'; reason: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (['尝试', '深度', '地图感'].includes(parsed.quadrant)) {
      return parsed
    }
  } catch { /* ignore */ }
  return null
}

export function parseTopicSummaryResult(raw: string): { summary: string; keyPoints: string[] } | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.summary && Array.isArray(parsed.keyPoints)) {
      return parsed
    }
  } catch { /* ignore */ }
  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ai/prompts-reports.ts
git commit -m "feat(ai): add quadrantPrompt and update topicSummaryPrompt

- Add QUADRANT_PROMPT for AI quadrant classification
- Update TOPIC_SUMMARY_PROMPT with few-shot example
- Add parseQuadrantResult and parseTopicSummaryResult"
```

---

## Task 4: 创建 CLI 入口

**Files:**
- Create: `src/cli/run.ts`

- [ ] **Step 1: 创建 CLI 入口骨架**

```typescript
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
```

- [ ] **Step 2: 运行验证**

```bash
bun run src/cli/run.ts
```
Expected: 输出 JSON 日志，显示各阶段开始

- [ ] **Step 3: Commit**

```bash
git add src/cli/run.ts
git commit -m "feat(cli): add run.ts CLI entry point with structured logging"
```

---

## Task 5: 创建 GitHub Actions Workflows

**Files:**
- Create: `.github/workflows/run.yml`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: 创建 run.yml**

```yaml
# .github/workflows/run.yml
name: Run Aggregator
on:
  schedule:
    - cron: "0 23 * * *"  # 每天 23:00 UTC = 7:00 北京时间
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Run
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: bun run src/cli/run.ts

      - name: Commit report
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "report: daily $(date +%Y-%m-%d)"
          file_pattern: "reports/daily/*.md"
```

- [ ] **Step 2: 创建 pages.yml**

```yaml
# .github/workflows/pages.yml
name: Deploy to Pages
on:
  push:
    branches: [main]
    paths:
      - 'serve/**'
      - 'reports/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload serve artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'serve/'

      - name: Upload reports artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'reports/'
          destination: 'reports/'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/run.yml .github/workflows/pages.yml
git commit -m "feat(ci): add GitHub Actions workflows

- run.yml: collect + daily report generation
- pages.yml: deploy serve/ and reports/ to GitHub Pages"
```

---

## Task 6: 更新 package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 检查当前 dependencies 和 devDependencies**

```bash
cat package.json | jq '.dependencies, .devDependencies'
```

- [ ] **Step 2: 移除需要删除的包**
- 移除: `next`, `react`, `react-dom`, `@prisma/client`, `prisma`, `@radix-ui/*`, `tailwindcss`, 等等

- [ ] **Step 3: 添加 CLI 必要依赖**
- 添加: `js-yaml`

```bash
bun remove next react react-dom @prisma/client prisma @radix-ui/themes @radix-ui/colors @radix-ui/icons @radix-ui/primitives tailwindcss
bun add js-yaml
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): remove Next.js/Prisma/Radix, add js-yaml"
```

---

## Task 7: 更新 .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 确保以下条目存在**

```
# Dependencies
node_modules/

# Build
.next/
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# TypeScript
tsconfig.tsbuildinfo

# Test
test-results/
coverage/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for new architecture"
```

---

## Task 8: 删除废弃文件

**Files:**
- Delete: 见下方详细列表

- [ ] **Step 1: 删除 Next.js 前端**

```bash
rm -rf app/ components/ hooks/
```

- [ ] **Step 2: 删除 Next.js 配置**

```bash
rm -f next.config.mjs vercel.json eslint.config.js
rm -rf .next/ tsconfig.tsbuildinfo
```

- [ ] **Step 3: 删除 Prisma**

```bash
rm -rf prisma/
```

- [ ] **Step 4: 删除 Prisma 依赖文件**

```bash
rm -f lib/prisma.ts lib/api-client.ts lib/api-response.ts
rm -f src/archive/upsert-content-prisma.ts
rm -f src/config/load-pack-prisma.ts src/config/load-pack-prisma.test.ts
rm -f src/pipeline/run-collect-job.ts
rm -f src/reports/weekly.ts
```

- [ ] **Step 5: 删除其他**

```bash
rm -rf config/packs/
rm -f scripts/diagnostics.ts
rm -f .env.example
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete Next.js/Prisma/Supabase code"
```

---

## Task 9: 改造日报逻辑 (daily.ts)

**Files:**
- Modify: `src/reports/daily.ts`

这是最复杂的任务，需要：
1. 移除 Prisma 依赖
2. 使用 JsonArticleStore 读写数据
3. 按 quadrant 分组
4. 实现 minScore 过滤
5. 生成新的日报格式

- [ ] **Step 1: 备份并重写 daily.ts**

见 spec 中的日报结构和 prompts 设计

- [ ] **Step 2: 运行验证**

```bash
bun run src/cli/run.ts
```
Expected: 日报生成完成，日志显示各阶段指标

- [ ] **Step 3: Commit**

```bash
git add src/reports/daily.ts
git commit -m "feat(reports): refactor daily.ts for new architecture

- Remove Prisma dependency, use JsonArticleStore
- Group by quadrant (尝试/深度/地图感)
- Implement minScore filtering
- Update prompt structure for summary + keyPoints"
```

---

## 执行验证

所有任务完成后：

1. **类型检查**
```bash
bun run src/cli/run.ts  # 应无 TypeScript 错误
```

2. **构建验证**
```bash
bun build src/cli/run.ts --outdir=dist
```

3. **端到端运行**
```bash
ANTHROPIC_API_KEY=sk-xxx bun run src/cli/run.ts
# 应输出完整 JSON 日志
# reports/daily/YYYY-MM-DD.md 应生成
```

---

## 依赖顺序

1. Task 1 (JSON store) → Task 9 (daily.ts)
2. Task 2 (resolve-env) → Task 3 (prompts) → Task 4 (CLI)
3. Task 5 (CI) 可独立
4. Task 6 (deps) → Task 7 (.gitignore) → Task 8 (delete)
5. Task 9 (daily.ts) 需 Task 1, 2, 3 完成
