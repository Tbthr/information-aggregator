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
│   ├── ai.yaml              # AI provider/model/retry 配置
│   └── packs/               # Pack 数据
├── reports/daily/           # 生成的日报 Markdown
├── serve/index.html         # 静态导航页（GitHub Pages 托管）
├── src/
│   ├── cli/                  # CLI 入口点
│   ├── pipeline/             # 收集管道
│   ├── adapters/             # 数据源适配器（RSS, JSON Feed, X/Twitter）
│   ├── ai/                  # AI client + prompts
│   ├── reports/              # 日报生成
│   │   └── daily.ts         # 日报逻辑（改造后）
│   ├── archive/             # 存档接口 + JSON store
│   │   ├── index.ts         # 接口定义
│   │   └── json-store.ts    # JSON 实现（新增）
│   ├── config/              # YAML 配置加载
│   ├── types/               # 类型定义
│   └── utils/               # 工具函数
├── .github/workflows/        # GitHub Actions
├── package.json
├── tsconfig.json
├── .env                     # 本地 secrets（gitignore）
└── .gitignore
```

## Archive 适配器设计

```typescript
// src/archive/index.ts — 接口保持不变
export interface ArticleStore {
  save(articles: Article[]): Promise<void>
  findByUrl(url: string): Promise<Article | null>
}

// src/archive/json-store.ts — 新 JSON 实现
export class JsonArticleStore implements ArticleStore {
  constructor(private dataDir: string = 'data') {}
  // 读写 data/*.json 文件
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

      - name: Setup aggregator
        run: |
          curl -L https://github.com/user/aggregator/releases/latest/download/aggregator-linux-amd64 -o aggregator
          chmod +x aggregator

      - name: Run
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: ./aggregator run

      - name: Commit report
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "report: daily $(date +%Y-%m-%d)"
          file_pattern: "reports/daily/*.md"
```

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

### 其他
- `.env.example`
- `scripts/diagnostics.ts`（逻辑内嵌到 run 命令）

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
| `config/reports.yaml` | 报表配置 |
| `config/ai.yaml` | AI 配置 |
| `config/packs/` | Pack 数据 |
| `reports/daily/` | 日报输出 |
| `serve/index.html` | 导航页 |
| `src/pipeline/` | 收集管道（不含 Prisma 依赖部分） |
| `src/adapters/` | 数据源适配器 |
| `src/ai/` | AI client + prompts |
| `src/reports/daily.ts` | 改造后无 Prisma |
| `src/archive/json-store.ts` | JSON 存档实现 |
| `src/types/` | 类型定义 |
| `src/utils/` | 工具函数 |
| `.env` | 本地 secrets |

## 实现步骤

1. 创建 `src/archive/json-store.ts` 实现存档接口
2. 修改 `src/reports/daily.ts` 使用 JSON store
3. 删除 Prisma 相关文件
4. 删除 Next.js 前端代码
5. 创建 CLI 入口点 `src/cli/index.ts`
6. 配置 `.github/workflows/run.yml`
7. 更新 `package.json`（移除 Next.js/Prisma/Radix 依赖）
8. 更新 `.gitignore`
9. 删除废弃文件
