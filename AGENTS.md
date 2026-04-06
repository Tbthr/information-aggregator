# AI Agent Guide — Information Aggregator

## Project Overview

Information Aggregator 是一个轻量级信息聚合平台，通过 YAML 配置 + CLI + GitHub Workflow 运行，生成日报并部署到 GitHub Pages。

### Tech Stack

- **Runtime**: Bun (TypeScript 直接运行，无需预编译)
- **配置**: YAML 配置文件
- **存储**: JSON 文件（`data/YYYY-MM-DD.json`）
- **AI**: Anthropic Claude
- **部署**: GitHub Actions + GitHub Pages

### Directory Structure

```
information-aggregator/
├── config/                    # YAML 配置
│   ├── sources.yaml        # 数据源配置
│   └── config.yaml         # 统一配置（tags、enrich、ranking、dedupe、content、AI快讯）
├── data/                    # 收集的 JSON 数据（用于历史去重）
│   └── YYYY-MM-DD.json
├── reports/daily/           # 生成的日报 Markdown
├── serve/index.html         # 静态导航页（GitHub Pages 托管）
├── src/
│   ├── cli/                # CLI 入口
│   │   └── run.ts         # aggregator run 命令
│   ├── pipeline/           # 收集管道
│   │   ├── collect.ts     # 数据收集
│   │   ├── enrich.ts      # 内容充实（正文提取）
│   │   ├── normalize.ts   # 内容标准化
│   │   └── dedupe-exact.ts # 精确去重
│   ├── adapters/          # 数据源适配器（RSS, JSON Feed, X/Twitter）
│   ├── ai/                # AI client + prompts
│   │   ├── client.ts      # AI 客户端
│   │   └── prompts-reports.ts # 报表生成 prompts
│   ├── reports/           # 日报生成
│   │   ├── daily.ts       # 日报逻辑
│   │   └── ai-flash.ts    # AI快讯专用 adapters
│   └── archive/           # 存档接口 + JSON store
│       ├── index.ts       # Article/ArticleStore 接口
│       └── json-store.ts  # JSON 实现
├── .github/workflows/      # GitHub Actions
│   ├── run.yml           # 收集 + 生成日报
│   └── pages.yml         # GitHub Pages 部署
└── lib/                    # 工具函数
    ├── date-utils.ts      # 日期工具（UTC/北京时间转换）
    └── utils.ts           # 通用工具
```

## CLI Commands

| Command | Purpose |
|---------|---------|
| `bun install` | 安装依赖 |
| `bun test` | 运行所有单元测试 |
| `bun run typecheck` | TypeScript 类型检查 |
| `bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts'` | 运行完整流程（默认 24h，需 AI 配置）|
| `bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts -t 1h'` | 本地快速测试，缩短运行时间 |

## Development Workflow

### Common Commands

运行任何 `src/cli/run.ts` 命令前，需先加载 `.env.local` 中的环境变量：

```bash
# 使用 .env.local 中的变量运行（仅影响本次进程，且优先级高于当前 shell）
bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts'
```

### Pre-commit Checklist

1. `bun run typecheck` - 确保无 TypeScript 错误
2. `bun test` - 确保所有测试通过
3. `bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts -t 1h'` - 确保 CLI 能正常运行

## Environment

### .env.local 配置

```bash
# 默认 Provider
AI_DEFAULT_PROVIDER=anthropic      # anthropic | gemini | openai

# Anthropic
ANTHROPIC_API_KEYS=sk-ant-...     # API keys (多个用逗号分隔)
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_BASE_URLS=https://open.bigmodel.cn/api/anthropic/v1

# Gemini
GEMINI_API_KEYS=...
GEMINI_MODEL=gemini-2.0-flash

# OpenAI
OPENAI_API_KEYS=...
OPENAI_MODEL=gpt-4o

# 重试配置
AI_MAX_RETRIES=4
AI_INITIAL_DELAY_MS=1000
AI_MAX_DELAY_MS=30000
AI_BACKOFF_FACTOR=2

# 日志
LOG_LEVEL=info                      # debug | info | warn | error
LOG_FORMAT=text                     # text | json
```

## Architecture

### Pipeline Flow

```
1. 收集 (collect)     → 并发收集（adapter × source 两级）
2. 标准化 (normalize) → 格式转换 + engagementScore 计算
3. tag 过滤          → include/exclude 初筛
4. 评分 (rank)        → sourceWeightScore×0.4 + engagementScore×0.15
5. 去重 (dedupe)      → URL 精确 + 语义 LCS
6. 内容充实 (enrich)  → 提取正文 + AI 摘要/关键点
7. 输出 (output)      → 生成 Markdown（AI快讯 + 文章列表）
```

### Data Format

```json
// data/YYYY-MM-DD.json
{
  "date": "2026-04-01",
  "collectedAt": "2026-04-01T14:00:00Z",
  "items": [
    {
      "id": "infoq-xxx",
      "sourceId": "infoq-cn",
      "sourceName": "InfoQ 中文",
      "title": "文章标题",
      "url": "https://...",
      "author": "作者",
      "publishedAt": "2026-04-01T10:00:00Z",
      "kind": "article",
      "content": "..."
    }
  ]
}
```

### Daily Report Structure

```markdown
# 4月5日 日报

## AI快讯

### 产品更新
- [**Kimi Code** 抢先体验计划开放申请](https://...) — Kimi 现已推出...
- ...

### 前沿研究
- ...

（其他分类同理）

## 推特精选

☀️ ClawFeed | 2026-04-05 00:41 SGT

🔥 重要
• ...

## 文章列表

- [文章标题](url) (来源)
- ...
```

## Code Standards

1. **Type Safety**: 所有代码必须通过 TypeScript 检查
2. **JSON Logging**: CLI 使用结构化 JSON 日志输出到 stdout
3. **Error Handling**: 失败时输出错误信息并以非零退出码退出

### ⚠️ Git 安全规则

- **禁止**执行 `git reset --hard`，除非用户明确要求且已确认分支状态
- `git status` 显示 clean 不代表与 remote 同步，需检查 `git log --oneline origin/main..HEAD`

### TypeScript 验证

- VS Code 诊断面板可能显示过时错误（stale diagnostics）
- 始终用 `bun run typecheck` 验证真实状态，而非依赖 UI 诊断

### Logging Format

```json
{
  "level": "info|warn|error",
  "ts": "2026-04-01T14:00:00.000Z",
  "stage": "collect|enrich|dedupe|score|quadrant|topic|output",
  "msg": "描述信息",
  "data": { ... }
}
```

### Time & Timezone

- **数据收集**: 以北京时间（UTC+8）界定"某一天"
- **JSON 存储**: 使用 UTC ISO 8601 格式
- **日报日期**: 使用北京时间日期
- 工具函数见 `lib/date-utils.ts`

### ⛔ 时间处理铁律

**获取当前北京时间日期字符串（YYYY-MM-DD）**：必须用 `formatBeijingDate(new Date())`，不能直接用 `new Date().toISOString().split('T')[0]`。

**错误做法**：
```typescript
// ❌ 错：toISOString() 返回 UTC 日期，比北京时间早 0~8 小时
const todayStr = new Date().toISOString().split('T')[0]
// 北京 00:30 时，toISOString() 返回前一天日期
```

**正确做法**：

```typescript
// ✅ 用 formatBeijingDate 工具函数
import { formatBeijingDate } from './lib/date-utils.js'
const todayStr = formatBeijingDate(new Date())
```

**为什么**：北京时间 = UTC + 8 小时。"先用 `toISOString()` 取 UTC 日期，再传给 `beijingDayRange()`"的组合会导致北京时间 00:00–07:59 时取到前一天的日期，每次运行抓取错误日期的内容。

**`beijingDayRange(dateStr)` 的输入必须是北京时间日期字符串**，`dateStr` 不是当前时间，而是"哪一天的北京时间"。

## Testing

### Unit Tests

```bash
bun test              # 运行所有测试
bun test src/utils    # 运行指定目录测试
bun test --reporter   # 详细输出
```

**注意**: 测试使用 `bun:test` 框架，文件命名必须为 `*.test.ts`

### CLI Verification

```bash
# 验证 CLI 运行
bun run src/cli/run.ts

# 验证输出（应有 JSON 日志）
# reports/daily/YYYY-MM-DD.md 应生成
```

### 快速测试规范

本地开发调试时，应使用最小数据源集 + 短时间窗口：

1. **时间窗口**: 必须指定 `--time-window 1h`，限制数据范围
2. **数据源简化**:
   - `mv config/sources.yaml config/sources.yaml.bak`
   - 创建只含单数据源的 `config/sources.yaml`:
     ```yaml
     sources:
       - type: rss
         id: infoq-cn-test
         name: InfoQ 中文（测试）
         url: https://www.infoq.cn/feed
         enabled: true
         tagIds: [ai]
     ```
3. **运行测试**: `bun run src/cli/run.ts --time-window 1h`
4. **恢复现场**: `mv config/sources.yaml.bak config/sources.yaml`

> 注意: `--time-window` 参数格式为数字+单位，`h`=小时，`d`=天（如 `1h`、`24h`、`7d`）。

## 配置说明

### config/config.yaml

```yaml
enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000

ranking:
  sourceWeight: 0.4
  engagement: 0.15

dedupe:
  nearThreshold: 0.75

content:
  truncationMarkers:
    - "[...]"
    - "Read more"
    - "click here"
    - "read more at"
    - "来源："
    - "Original:"

aiFlashSources:
  - id: hexi-daily
    adapter: hexi-daily
    url: https://r.jina.ai/https://ai.hubtoday.app/{month}/{date}/
    enabled: true
  - id: juya-daily
    adapter: juya-daily
    url: https://imjuya.github.io/juya-ai-daily/rss.xml
    enabled: true
  - id: clawfeed-daily
    adapter: clawfeed-daily
    url: https://clawfeed.kevinhe.io/feed/kevin
    enabled: true
```

## GitHub Actions

- **run.yml**: 每天 23:00 UTC (7:00 北京时间) 自动运行 `bun run src/cli/run.ts`，生成的日报自动提交
- **pages.yml**: 推送 `serve/` 或 `reports/` 时自动部署到 GitHub Pages
