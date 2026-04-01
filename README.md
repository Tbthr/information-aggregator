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
| `config/topics.yaml` | Topic 配置 |
| `config/reports.yaml` | 日报参数（maxItems、minScore、prompts） |
| `config/ai.yaml` | AI provider/model/retry 配置 |

## 架构

```
数据源 → 收集 → 正文提取 → 去重 → 评分 → 象限分类 → 话题生成 → Markdown
```

### 数据流

1. **收集** - 从配置的数据源获取内容
2. **充实** - 提取文章正文
3. **去重** - 基于 URL 和内容去重
4. **评分** - 基于质量和热度评分
5. **象限分类** - AI 将内容分配到尝试/深度/地图感
6. **话题生成** - AI 聚类相关内容，生成摘要和要点
7. **输出** - 生成 Markdown 日报

## License

MIT
