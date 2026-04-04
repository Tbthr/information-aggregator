# 日报模块化重构设计 — AI快讯 + 文章列表双模块

## 概述

重构日报生成逻辑，移除象限分类，改为双模块结构：
- **AI快讯**：三个精选信息源的完整内容拼接，各自独立子模块展示
- **文章列表**：复用现有 pipeline 结果

## 变更范围

### 删除
- `src/reports/filter-quadrant.ts` —象限分类逻辑删除
- `config/reports.yaml` 中的 `quadrantPrompt` 配置
- `src/ai/prompts-reports.ts` 中的 `parseQuadrantResult` 函数

### 新增
- `config/ai-flash-sources.yaml` — AI快讯数据源配置
- `src/reports/ai-flash.ts` — AI快讯获取 + HTML清理

### 重写
- `src/reports/daily.ts` — 移除象限逻辑，改为双模块输出

### 配置变更
- `config/reports.yaml` — 删除 `quadrantPrompt` 段落

---

## 日报输出结构

```markdown
# 4月4日 日报

## AI快讯

### ClawFeed

[完整 Markdown 内容，原样输出]

### 何夕2077 AI资讯

[HTML 清理后的纯文本内容]

### 橘鸦AI早报

[HTML 清理后的纯文本内容]

## 文章列表

- [文章标题](url) (来源)
- ...
```

---

## 详细设计

### 1. AI快讯配置 — `config/ai-flash-sources.yaml`

```yaml
# AI快讯数据源配置
# 这些来源的内容被认为是完全可信的，不需要 tag 过滤、enrichment、评分排序

sources:
  - id: clawfeed-kevinhe-io-feed-kevin
    adapter: clawfeed
    enabled: true

  - id: ai-hubtoday-blog
    name: 何夕2077 AI资讯
    adapter: rss
    enabled: true

  - id: juya-ai-daily
    name: 橘鸦AI早报
    adapter: rss
    enabled: true
```

**设计原则**：
- 与 `sources.yaml` 完全解耦，不共享配置
- 每个 source 只声明 `id`、`adapter`、`enabled`，不需要 `tagIds`、`contentType` 等 pipeline 专用字段
- `id` 与 `sources.yaml` 中的 `id` 保持一致，便于后续扩展（比如复用同一套 adapter）

### 2. AI快讯获取 — `src/reports/ai-flash.ts`

**职责**：
1. 根据配置加载 AI快讯数据源
2. 通过对应 adapter 获取原始内容
3. 对 HTML 内容进行基本清理（strip tags，保留链接和加粗）
4. 返回结构化数据给日报生成器

**三个来源的内容形态**：

| 来源 | 获取字段 | 内容形态 | 清理方式 |
|------|----------|----------|----------|
| ClawFeed | JSON `content` | Markdown，带 emoji 前缀分类 | 最小处理，原样输出 |
| 何夕 | RSS `description` | 完整 HTML 周报 | strip HTML，保留 `<a>` 链接和 `<strong>` |
| 橘鸦 | RSS `content:encoded` | 完整 HTML 日报 | 同上 |

**HTML 清理规则**：
```typescript
// 输入: "<p>阿里发布<strong>Wan2.7</strong>，见<a href="...">链接</a></p>"
// 输出: "阿里发布**Wan2.7**，见 链接(https://...)\n\n"
```

- 移除所有 HTML 标签
- 保留 `<a>` 标签的文本和 href，格式为 `文本(url)`
- 保留 `<strong>` 和 `<b>` 为 `**文本**`
- `<br>` 和块级标签后换行
- 连续空白压缩为单个空格

**接口设计**：
```typescript
export interface AiFlashSource {
  id: string
  name: string
  adapter: string
  enabled: boolean
}

export interface AiFlashContent {
  sourceId: string
  sourceName: string
  publishedAt: string
  content: string  // 清理后的纯文本或 Markdown
}

export async function fetchAiFlashSources(
  sources: AiFlashSource[],
  options: { timeWindow: number; fetchImpl?: typeof fetch }
): Promise<AiFlashContent[]>
```

### 3. 日报生成器重写 — `src/reports/daily.ts`

**移除**：
- `classifyArticlesQuadrantBatch` — 象限分类
- `QuadrantData`、`Quadrant` 类型
- 所有 quadrantPrompt 参数

**新增**：
```typescript
export interface DailyReportData {
  date: string
  dateLabel: string
  aiFlash: AiFlashContent[]   // AI快讯列表
  articles: ArticleForReport[] // 文章列表
}

export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],  // 来自 pipeline
  aiFlashSources: AiFlashSource[] // 来自 ai-flash-sources.yaml
): Promise<DailyGenerateResult>
```

**输出格式**：
```typescript
export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []
  lines.push(`# ${report.dateLabel}`)
  lines.push('')

  // AI快讯模块
  lines.push('## AI快讯')
  lines.push('')
  for (const flash of report.aiFlash) {
    lines.push(`### ${flash.sourceName}`)
    lines.push('')
    lines.push(flash.content)
    lines.push('')
  }

  // 文章列表模块
  lines.push('## 文章列表')
  lines.push('')
  for (const article of report.articles) {
    lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
  }

  return lines.join('\n')
}
```

### 4. CLI 集成 — `src/cli/run.ts`

变化点在日报生成调用处：

```typescript
// before
const quadrantPrompt = reportsConfig.daily.quadrantPrompt
const result = await generateDailyReport(now, aiClient, rankedArticles, quadrantPrompt)

// after
const aiFlashSources = loadAiFlashSources()  // from ai-flash-sources.yaml
const aiFlashContent = await fetchAiFlashSources(aiFlashSources, { timeWindow })
const result = await generateDailyReport(now, aiClient, rankedArticles, aiFlashContent)
```

---

## 配置加载

### `src/config/index.ts`

扩展 `loadConfig` 返回值：

```typescript
interface Config {
  // ... existing fields
  aiFlashSources: AiFlashSource[]
}
```

新增 `loadAiFlashSources()` 辅助函数。

---

## 数据流对比

```
before:
  pipeline → normalizedArticle[] → quadrant分类 → 分组 → markdown

after:
  pipeline → normalizedArticle[] ──────────────────→ 文章列表
                                └──→ aiFlash → AiFlashContent[] → AI快讯
```

两个模块完全并行，无依赖关系。

---

## 后续优化（不在本期范围内）

1. **去重**：三个 AI快讯来源之间可能有内容重叠（比如都报道了同一事件），需要 URL 或语义去重
2. **条目级提取**：将周报/日报拆解为独立条目，而非整篇拼接
3. **来源重要性权重**：某些来源优先级更高时可做排序

---

## 测试策略

1. `bun test src/reports` — 单元测试覆盖 HTML 清理逻辑
2. `bun run src/cli/run.ts -t 1h` — 端到端验证，生成日报检查输出格式
3. 手动检查生成的日报，确认 AI快讯三个子模块都正确渲染

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 删除 | `src/reports/filter-quadrant.ts` |
| 删除 | `src/ai/prompts-reports.ts` 中的 `parseQuadrantResult` |
| 新增 | `config/ai-flash-sources.yaml` |
| 新增 | `src/reports/ai-flash.ts` |
| 重写 | `src/reports/daily.ts` |
| 修改 | `config/reports.yaml`（删除 quadrantPrompt） |
| 修改 | `src/config/index.ts`（扩展 Config 类型） |
| 修改 | `src/cli/run.ts`（集成 AI快讯获取） |
