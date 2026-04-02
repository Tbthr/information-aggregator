# Information Aggregator

一个轻量级信息聚合平台，通过 AI 自动收集、整理、分类每日信息，生成结构化日报。

## 功能特性

- **AI 分类** - 内容自动分配到尝试/深度/地图感 三个象限
- **话题聚类** - AI 将相关内容聚合成话题，生成摘要和核心要点
- **历史去重** - 基于 URL 和内容的精确去重
- **GitHub Pages 部署** - 静态网站，自动更新

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) 1.0+

### 安装

```bash
bun install
cp .env.example .env
# 编辑 .env 填入 ANTHROPIC_API_KEY
```

### 运行

```bash
bun run src/cli/run.ts
```

生成的日报输出到 `reports/daily/YYYY-MM-DD.md`

## 技术栈

- [Bun](https://bun.sh/) - TypeScript 运行时
- [Anthropic Claude](https://anthropic.com/) - AI 分类和摘要生成
- [GitHub Actions](https://github.com/features/actions) - 自动化运行
- [GitHub Pages](https://pages.github.com/) - 静态部署

## 配置

| 文件 | 说明 |
|------|------|
| `config/sources.yaml` | 数据源配置（RSS、JSON Feed、X/Twitter） |
| `config/topics.yaml` | Topic 配置（include/exclude 规则、scoreBoost） |
| `config/reports.yaml` | 日报参数（maxItems、minScore、quadrantPrompts） |

## 架构

```
数据源 → 并发收集 → 标准化 → Topic 过滤 → 评分排序 → 去重 → 象限分类 → 话题生成 → Markdown
```

### CLI 参数

```bash
bun run src/cli/run.ts <timeWindow> [options]
bun run src/cli/run.ts 24h              # 收集最近 24 小时内容
bun run src/cli/run.ts 7d -t 7d         # 收集最近 7 天内容
bun run src/cli/run.ts 24h --adapter-concurrency 4 --source-concurrency 4
```

| 参数 | 说明 |
|------|------|
| `timeWindow` | 时间窗口，如 `24h`、`7d`、`30d`（必填） |
| `-t, --time-window` | 同上 |
| `--adapter-concurrency` | Adapter 并发数（默认 4） |
| `--source-concurrency` | Source 并发数（默认 4） |

### 数据流

1. **收集 (collect)** - 并发收集（adapter × source 两级并发）
2. **标准化 (normalize)** - 格式转换 + engagementScore 计算
3. **Topic 过滤** - include/exclude 规则初筛
4. **评分排序 (rank)** - sourceWeightScore×0.4 + engagementScore×0.15
5. **去重 (dedupe)** - URL 精确去重 + 语义 LCS 去重
6. **象限分类 (quadrant)** - AI 将内容分配到尝试/深度/地图感
7. **话题生成 (topic)** - AI 聚类相关内容，生成摘要和要点（各象限独立 prompt）
8. **输出 (output)** - 生成 Markdown 日报

## License

MIT
