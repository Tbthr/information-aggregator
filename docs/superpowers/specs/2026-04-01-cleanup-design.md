# 信息聚合器清理设计方案

## 概述

清理废弃的 Next.js + Prisma + Supabase 架构，简化为 YAML 配置 + CLI + GitHub Workflow + Markdown 输出的轻量架构。

## 架构决策

| 决策 | 方案 |
|------|------|
| 前端 | 静态导航页（`serve/index.html`），GitHub Pages 直接托管 |
| CLI | 单一命令 `aggregator run` |
| 诊断 | 内嵌于 `run` 的详细日志输出 |
| 存储层 | Archive 接口 + JSON store 实现（适配器模式） |
| AI 配置 | `config/ai.yaml`（结构化）+ `.env`（secrets）配合 |

## CLI 命令

```bash
aggregator run   # 收集数据 + 生成日报，运行时输出详细日志
```

## 目录结构（清理后）

```
information-aggregator/
├── config/                    # YAML 配置
│   ├── sources.yaml          # 数据源配置
│   ├── topics.yaml           # Topic 配置
│   ├── reports.yaml          # 报表配置
│   └── ai.yaml              # AI provider/model/retry 配置
├── data/                    # 收集的 JSON 数据（用于历史去重）
│   └── YYYY-MM-DD.json
├── reports/daily/           # 生成的日报 Markdown
├── serve/index.html         # 静态导航页（GitHub Pages 托管）
├── src/
│   ├── cli/                  # CLI 入口点
│   │   └── run.ts           # aggregator run 入口
│   ├── pipeline/             # 收集管道
│   ├── adapters/             # 数据源适配器（RSS, JSON Feed, X/Twitter）
│   ├── ai/                  # AI client + prompts
│   ├── reports/              # 日报生成
│   │   └── daily.ts         # 日报逻辑（改造后）
│   ├── archive/             # 存档接口 + JSON store
│   │   ├── index.ts         # 接口定义
│   │   └── json-store.ts    # JSON 实现（新增）
│   ├── config/              # YAML 配置加载
│   │   └── resolve-env.ts   # env var 替换
│   ├── types/               # 类型定义
│   └── utils/               # 工具函数
├── .github/workflows/        # GitHub Actions
│   ├── run.yml             # 收集 + 生成日报
│   └── pages.yml           # GitHub Pages 部署
├── package.json
├── tsconfig.json
├── .env                     # 本地 secrets（gitignore）
└── .gitignore
```

## Archive 适配器设计

```typescript
// src/archive/index.ts — 接口（日报场景所需方法）
export interface ArticleStore {
  save(articles: Article[]): Promise<void>
  findByUrl(url: string): Promise<Article | null>
  findAllByDate(date: string): Promise<Article[]>
}

// src/archive/json-store.ts — 新 JSON 实现
export class JsonArticleStore implements ArticleStore {
  constructor(private dataDir: string = 'data') {}

  async save(articles: Article[]): Promise<void> {
    // 追加写入 data/YYYY-MM-DD.json
  }

  async findByUrl(url: string): Promise<Article | null> {
    // 扫描 data/*.json 查找
  }

  async findAllByDate(date: string): Promise<Article[]> {
    // 读取指定日期的 data/YYYY-MM-DD.json
  }
}
```

## AI 配置方案

`config/ai.yaml` + `.env` 分工：

```yaml
# config/ai.yaml — 结构化配置
default: anthropic
providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}   # env var 引用
    model: claude-sonnet-4-20250514
    baseUrl: https://api.anthropic.com
retry:
  maxRetries: 3
  initialDelayMs: 1000
  backoffFactor: 2
batch:
  size: 5
```

```bash
# .env — 仅 secrets（gitignore）
ANTHROPIC_API_KEY=sk-xxx
```

CLI 启动时解析 `${VAR}` 从 `process.env` 注入。

## GitHub Actions Workflow

使用 `bun` 直接运行 TypeScript，无需预编译二进制：

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

**注**：`src/cli/run.ts` 为 CLI 入口点，聚合收集 + 日报生成 + 详细日志输出。

## 删除清单

### Next.js 前端（全部删除）
- `app/` — pages + API routes
- `components/` — 所有 UI 组件
- `hooks/` — Next.js hooks
- `lib/prisma.ts` — Prisma client
- `lib/api-client.ts` — Next.js API client
- `lib/api-response.ts` — Next.js API helpers
- `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- `vercel.json`, `eslint.config.js`
- `.next/`, `tsconfig.tsbuildinfo`

### Prisma/Supabase（全部删除）
- `prisma/` — schema + migrations
- `src/archive/upsert-content-prisma.ts`
- `src/config/load-pack-prisma.ts` + `.test.ts`
- `src/pipeline/run-collect-job.ts`

### 报表（周报已移除）
- `src/reports/weekly.ts` — 周报逻辑（随 Prisma 依赖移除）

### Pack 配置（已废弃）
- `config/packs/` — Pack YAML 数据（由 `src/config/load-pack-prisma.ts` 加载，随 Prisma 移除）

### 其他
- `.env.example`
- `scripts/diagnostics.ts`（逻辑内嵌到 run 命令，详细日志即诊断）

### 保留的工具函数
- `lib/utils.ts` — 通用工具（无 Next.js 依赖）
- `lib/format-date.ts` — 日期格式化
- `lib/tweet-utils.ts` — Tweet 工具
- `lib/date-utils.ts` — 日期工具

## 保留文件说明

| 文件/目录 | 说明 |
|-----------|------|
| `config/sources.yaml` | 数据源配置 |
| `config/topics.yaml` | Topic 配置 |
| `config/reports.yaml` | 报表配置（仅含日报，无周报） |
| `config/ai.yaml` | AI 配置 |
| `data/` | 收集的 JSON 数据（用于历史去重，rank 阶段需要） |
| `reports/daily/` | 日报 Markdown 输出 |
| `serve/index.html` | 静态导航页 |
| `src/pipeline/collect.ts` | 数据收集 |
| `src/pipeline/enrich.ts` | 内容充实 |
| `src/pipeline/rank.ts` | 候选排序 |
| `src/pipeline/normalize.ts` | 内容标准化 |
| `src/pipeline/normalize-url.ts` | URL 标准化 |
| `src/pipeline/dedupe-exact.ts` | 精确去重 |
| `src/pipeline/extract-content.ts` | 内容提取 |
| `src/adapters/` | 数据源适配器（RSS, JSON Feed, X/Twitter） |
| `src/ai/` | AI client + prompts |
| `src/reports/daily.ts` | 改造后无 Prisma |
| `src/archive/json-store.ts` | JSON 存档实现 |
| `src/config/resolve-env.ts` | YAML 中 `${VAR}` 语法解析 |
| `src/types/` | 类型定义 |
| `src/utils/` | 工具函数 |
| `lib/utils.ts` | 通用工具（无 Next.js 依赖） |
| `lib/format-date.ts` | 日期格式化 |
| `lib/tweet-utils.ts` | Tweet 工具 |
| `lib/date-utils.ts` | 日期工具 |
| `.env` | 本地 secrets |

## AI 配置解析

`config/ai.yaml` 使用 `${VAR_NAME}` 语法引用环境变量。使用 `js-yaml` 加载后，通过自定义函数替换：

```typescript
// src/config/resolve-env.ts
export function resolveEnvVars<T>(obj: T): T {
  const str = JSON.stringify(obj)
  const resolved = str.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? '')
  return JSON.parse(resolved)
}
```

## 实现步骤

1. **创建 JSON store** — `src/archive/json-store.ts` 实现存档接口
2. **改造日报逻辑** — 修改 `src/reports/daily.ts`，移除 Prisma 依赖，改用 JSON store 读写数据
3. **创建 CLI 入口** — `src/cli/run.ts`，聚合收集 + 日报生成 + 详细日志输出
4. **配置 GitHub Actions** — `.github/workflows/run.yml`
5. **更新依赖** — `package.json` 移除 Next.js/Prisma/Radix，添加 CLI 必要依赖（`js-yaml` 等）
6. **更新 .gitignore** — 确保 `.next/`, `node_modules/`, `.env` 等正确排除
7. **删除废弃文件** — 清理 Next.js/Prisma/Supabase 相关代码

**数据迁移**：现有 Supabase 数据库中的数据无需迁移，日报生成改用 JSON 文件输入。

## CLI 错误处理

`aggregator run` 退出码：
- `0` — 成功
- `1` — 收集失败（网络错误、数据源不可用）
- `2` — 日报生成失败（AI 调用失败、写入错误）

日志输出到 stdout/stderr，失败时输出完整错误信息便于调试。

## GitHub Pages Workflow

`serve/index.html` 直接托管于 GitHub Pages，与 `run.yml` 分离：

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

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'serve/'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**注**：`serve/index.html` 为纯静态页面，直接作为 Pages 根目录部署；`reports/daily/` 下的 Markdown 文件通过相对路径引用。
