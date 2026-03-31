# Information Aggregator 简化架构设计

## 概述

将现有 Information Aggregator 从 Supabase + Next.js 架构简化为 **YAML 配置 + CLI 驱动 + GitHub Workflow + JSON 归档 + Markdown 渲染**的轻量架构。

**目标：**
- 移除数据库依赖（Prisma + Supabase）
- 简化前端为纯静态渲染
- 配置即代码，易于复用到其他项目
- GitHub-native 部署体验

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions                          │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐ │
│  │ collect │──▶│  daily  │   │ weekly  │   │  build  │ │
│  │   @2h   │   │ 23:00UTC│   │ 00:00Mon │   │  zola   │ │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘ │
│       │             │             │              │       │
│       ▼             ▼             ▼              ▼       │
│  data/*.json   reports/daily/  reports/weekly/ output/ │
│                YYYY-MM-DD.md    YYYY-Www.md     static/  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  GitHub Pages   │
                    │  静态网站托管    │
                    └─────────────────┘
```

## 配置格式

### 1. config/sources.yaml — 数据源配置

```yaml
sources:
  - type: rss
    id: infoq-cn
    name: InfoQ 中文
    url: https://www.infoq.cn/feed
    enabled: true
    topics: [tech, ai]

  - type: json-feed
    id: buzzing
    name: Buzzing
    url: https://www.buzzing.cc/feed.json
    enabled: true
    topics: [news, tech]

  - type: twitter
    id: karpathy
    name: Andrej Karpathy
    handle: karpathy
    enabled: true
    topics: [ai, ml]
```

### 2. config/topics.yaml — Topic 配置

```yaml
topics:
  - id: ai
    name: AI 与大模型
    description: AI、机器学习、大模型相关
    includeRules:
      - AI
      - LLM
      - GPT
      - Claude
    excludeRules:
      - 广告
    maxItems: 10

  - id: tech
    name: 技术趋势
    description: 编程语言、框架、开源
    includeRules:
      - Rust
      - Go
      - Kubernetes
    maxItems: 10
```

### 3. config/reports.yaml — 日报/周报 prompt 配置

```yaml
daily:
  maxItems: 50
  minScore: 0
  topicPrompt: |
    将以下内容按主题分类，每个主题给出一句话摘要。

  topicSummaryPrompt: |
    为每个主题写一段 20 字以内的摘要。

weekly:
  days: 7
  pickCount: 6
  editorialPrompt: |
    写一段本周的社评，总结重点趋势。
  pickReasonPrompt: |
    为每条精选写一句话理由。
```

### 4. config/ai.yaml — AI 配置

```yaml
default: anthropic

providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514
    baseUrl: https://api.anthropic.com

  gemini:
    apiKey: ${GEMINI_API_KEY}
    model: gemini-2.5-flash
    baseUrl: https://generativelanguage.googleapis.com

  openai:
    apiKey: ${OPENAI_API_KEY}
    model: gpt-4o
    baseUrl: https://api.openai.com/v1

retry:
  maxRetries: 3
  initialDelayMs: 1000
  maxDelayMs: 30000
  backoffFactor: 2

batch:
  size: 5
  concurrency: 2
```

## CLI 命令

### aggregator collect

```bash
aggregator collect [options]

Options:
  --date YYYY-MM-DD    指定收集日期（默认今天）
  --config <path>      配置文件路径
  --output <path>       输出目录（默认 data/）

Example:
  aggregator collect --date 2026-03-31
  # 输出: data/2026-03-31.json
```

**功能：**
1. 读取 `config/sources.yaml` 中的数据源
2. 遍历所有 enabled 的 source，抓取内容
3. 内容标准化（标题、URL、作者、发布日期）
4. 输出到 `data/YYYY-MM-DD.json`

### aggregator daily

```bash
aggregator daily [options]

Options:
  --date YYYY-MM-DD    指定日期（默认今天）
  --input <path>       输入 JSON 路径
  --output <path>       输出 Markdown 路径

Example:
  aggregator daily --date 2026-03-31
  # 输入: data/2026-03-31.json
  # 输出: reports/daily/2026-03-31.md
```

**功能：**
1. 读取前一天的收集数据
2. 调用 AI 按 topic 分类
3. 每个 topic 生成摘要
4. 每 topic 选 5-10 条精选
5. 输出 Markdown 文件

### aggregator weekly

```bash
aggregator weekly [options]

Options:
  --week YYYY-Www       指定周（默认本周）
  --input <path>        输入 JSON 路径（可多日合并）
  --output <path>      输出 Markdown 路径

Example:
  aggregator weekly --week 2026-W13
  # 输入: data/2026-03-24.json ~ data/2026-03-30.json
  # 输出: reports/weekly/2026-W13.md
```

**功能：**
1. 读取本周所有日的 JSON
2. 合并去重
3. AI 选 6 条周精选
4. 生成社评
5. 输出 Markdown 文件

### aggregator serve

```bash
aggregator serve [options]

Options:
  --port 3000           端口（默认 3000）
  --reports <path>      reports 目录（默认 reports/）

Example:
  aggregator serve --port 3000
  # 启动静态 HTTP server
  # 读取 reports/daily/*.md 和 reports/weekly/*.md
  # 渲染 serve/index.html
```

**功能：**
1. 扫描 `reports/daily/` 和 `reports/weekly/`
2. 提供列表索引页
3. 渲染 Markdown 为 HTML
4. 提供日期/周导航

## GitHub Workflows

### .github/workflows/collect.yml

```yaml
name: Collect Data
on:
  schedule:
    - cron: "0 */2 * * *"  # 每2小时 UTC
  workflow_dispatch:

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup aggregator
        run: |
          # 下载 aggregator CLI
          curl -L https://github.com/user/aggregator/releases/latest/download/aggregator-linux-amd64 -o aggregator
          chmod +x aggregator

      - name: Collect
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          ./aggregator collect --date ${{ env.DATE }}

      - name: Commit data
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "data: collect $(date +%Y-%m-%d)"
          file_pattern: "data/*.json"
```

### .github/workflows/daily.yml

```yaml
name: Generate Daily Report
on:
  schedule:
    - cron: "0 23 * * *"  # 每天 23:00 UTC = 7:00 北京时间
  workflow_dispatch:

jobs:
  daily:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup aggregator
        run: |
          curl -L https://github.com/user/aggregator/releases/latest/download/aggregator-linux-amd64 -o aggregator
          chmod +x aggregator

      - name: Generate Daily
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          ./aggregator daily

      - name: Commit report
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "report: daily $(date +%Y-%m-%d)"
          file_pattern: "reports/daily/*.md"
```

### .github/workflows/weekly.yml

```yaml
name: Generate Weekly Report
on:
  schedule:
    - cron: "0 0 * * 1"  # 每周一 00:00 UTC = 8:00 北京时间
  workflow_dispatch:

jobs:
  weekly:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup aggregator
        run: |
          curl -L https://github.com/user/aggregator/releases/latest/download/aggregator-linux-amd64 -o aggregator
          chmod +x aggregator

      - name: Generate Weekly
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          ./aggregator weekly

      - name: Commit report
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "report: weekly $(date +%Y-W%V)"
          file_pattern: "reports/weekly/*.md"
```

### .github/workflows/pages.yml

```yaml
name: Build and Deploy to Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Zola
        uses: cmwylie19/zola-deploy@latest
        with:
          args: build --base-url ${{ vars.BASE_URL }}

      - name: Deploy to Pages
        uses: actions/deploy-pages@v4
```

## 数据文件格式

### data/YYYY-MM-DD.json

```json
{
  "date": "2026-03-31",
  "collectedAt": "2026-03-31T14:00:00Z",
  "sources": [
    {
      "id": "infoq-cn",
      "name": "InfoQ 中文",
      "items": [
        {
          "id": "infoq-xxx",
          "title": "文章标题",
          "url": "https://...",
          "author": "作者",
          "publishedAt": "2026-03-31T10:00:00Z",
          "kind": "article",
          "content": "..."
        }
      ]
    }
  ],
  "totalItems": 42
}
```

### reports/daily/YYYY-MM-DD.md

```markdown
# 2026年3月31日 今日简报

共 23 条精选

## # AI 与大模型

摘要：Claude 4 发布，GPT-5 进展，Gemini 2.0 更新

1. **Anthropic 发布 Claude 4 系列模型**
   "多模态能力大幅提升，在复杂推理任务上超越 GPT-4"
   [原文](https://...)

2. **Google 公布 Gemini 2.0 技术细节**
   "长上下文窗口达到 2M tokens，适合超长文档处理"
   [原文](https://...)

## # 技术趋势

...
```

### reports/weekly/YYYY-Www.md

```markdown
# 2026-W13 周报

03-24 ~ 03-30

## 社评

本周 AI 领域迎来重要更新，各家大模型厂商纷纷发布新一代产品...

## 本周精选

1. **Claude 4 系列发布**
   重新定义多模态 AI 标准
   [原文](https://...) | 03-25

2. **GitHub Copilot Enterprise 重大更新**
   支持自然语言重构代码
   [原文](https://...) | 03-26

...
```

## 前端渲染

### serve/index.html

纯静态 HTML + Vanilla JS + markdown-it：

- **字体**：Newsreader (标题 serif) + IBM Plex Sans (正文)
- **色调**：墨黑 `#1a1a1a` + 暖白 `#faf8f5` + 赤陶 `#c45d3a`
- **布局**：左侧导航 + 右侧内容
- **导航**：最近 7 天日报 + 最近 4 周周报
- **动效**：staggered 渐显动画

### Zola 配置（可选）

如需更强大的静态站点能力，可选 Zola：

```toml
# zola.toml
base_url = "https://user.github.io/repo"
theme = "hyde"
```

## 迁移路径

### Phase 1: 基础设施
- [ ] 创建 CLI 项目脚手架
- [ ] 迁移 config/sources.yaml
- [ ] 迁移 config/topics.yaml
- [ ] 迁移 config/reports.yaml
- [ ] 创建 config/ai.yaml

### Phase 2: 数据收集
- [ ] 实现 `aggregator collect`
- [ ] 实现 `aggregator daily`
- [ ] 实现 `aggregator weekly`
- [ ] 测试收集和生成流程

### Phase 3: 前端
- [ ] 完善 serve/index.html
- [ ] 实现 Markdown 渲染
- [ ] 实现列表导航

### Phase 4: CI/CD
- [ ] 配置 GitHub Workflows
- [ ] 配置 GitHub Pages
- [ ] 端到端测试

## 目录结构

```
information-aggregator/
├── config/
│   ├── sources.yaml
│   ├── topics.yaml
│   ├── reports.yaml
│   └── ai.yaml
├── data/                     # 收集的原始数据
│   └── 2026-03-31.json
├── reports/
│   ├── daily/
│   │   └── 2026-03-31.md
│   └── weekly/
│       └── 2026-W13.md
├── serve/
│   ├── index.html
│   └── zola.toml            # 可选
├── src/
│   └── cli/                 # CLI 实现
├── .github/
│   └── workflows/
│       ├── collect.yml
│       ├── daily.yml
│       ├── weekly.yml
│       └── pages.yml
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-31-simplified-arch-design.md
```
