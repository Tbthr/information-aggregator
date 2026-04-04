# 日报模块化重构设计 — AI快讯 + 文章列表双模块

## 概述

重构日报生成逻辑，移除象限分类，改为双模块结构：
- **AI快讯**：三个精选信息源的当日完整内容，各自独立子模块展示
- **文章列表**：复用现有 pipeline 结果

---

## 变更范围

| 操作 | 文件 |
|------|------|
| 删除 | `src/reports/filter-quadrant.ts` |
| 删除 | `src/ai/prompts-reports.ts` 中的 `parseQuadrantResult` |
| 新增 | `config/ai-flash-sources.yaml` |
| 新增 | `src/reports/ai-flash.ts` |
| 重写 | `src/reports/daily.ts` |
| 修改 | `config/reports.yaml`（删除 `quadrantPrompt`） |
| 修改 | `src/config/index.ts`（扩展 Config 类型） |
| 修改 | `src/cli/run.ts`（集成 AI快讯获取） |

---

## 日报输出结构

```markdown
# 4月4日 日报

## AI快讯

### ClawFeed

[当日 Markdown 内容]

### 何夕2077 AI资讯

[当日日报 Markdown 内容]

### 橘鸦AI早报

[当日 HTML 清理后的内容]

## 文章列表

- [文章标题](url) (来源)
- ...
```

---

## AI快讯配置 — `config/ai-flash-sources.yaml`

```yaml
# AI快讯数据源配置
# 三个来源均为 dedicated adapter，不走 pipeline 的 adapter 机制

sources:
  - id: hexi-daily
    adapter: hexi-daily
    enabled: true

  - id: juya-daily
    adapter: juya-daily
    enabled: true

  - id: clawfeed-daily
    adapter: clawfeed-daily
    enabled: true
```

**设计原则**：
- 与 `sources.yaml` 完全解耦
- 三个 dedicated adapter 各自独立获取当日内容，互不依赖
- `timeWindow` 在这三个 adapter 中均无意义（都是日度一期），接口签名保留但忽略

---

## Dedicated Adapters

三个 adapter 统一放在 `src/reports/ai-flash.ts` 中，作为内部实现细节，不暴露到 `src/adapters/`。

### 1. hexi-daily — 何夕日报

**URL 规律**：`https://ai.hubtoday.app/{YYYY-MM}/{YYYY-MM-DD}/`

**数据获取**：通过 jina.ai 提取页面正文
```
GET https://r.jina.ai/https://ai.hubtoday.app/2026-04/2026-04-04/
```

**返回格式**：jina.ai 返回 Markdown，直接截取正文区域即可。

**清理规则**：
- jina.ai 输出前约 700 行为侧边栏/目录，跳过
- 找到第一个 `# AI资讯日报` 标题，从下一行开始截取
- 截取到 `© 2026 何夕2077` 或文件末尾
- 过滤掉含 `优云智算` 的广告行（特征：含 `ucloud` 域名或 `6.9元购` 等营销文字）
- 图片链接保留（格式 `![alt](url)`），不处理

**处理后格式**：Markdown，包含完整当日日报结构。

### 2. juya-daily — 橘鸦AI早报

**RSS URL**：`https://imjuya.github.io/juya-ai-daily/rss.xml`

**数据获取**：抓取 RSS，过滤当天条目（按 `pubDate` 中的日期匹配北京时间当天）。

**清理规则**：
- 解析 `content:encoded` 字段
- strip HTML tags，保留 `<a>` 链接格式为 `文本(url)`
- 保留 `<strong>` 为 `**文本**`
- `<br>` 和块级标签后换行

**当日过滤逻辑**：
```typescript
const todayStr = formatBeijingDate(now) // "2026-04-04"
for (const item of rssItems) {
  const itemDate = parseBeijingDate(item.pubDate) // 从 pubDate 提取日期
  if (formatDate(itemDate) === todayStr) {
    // 保留
  }
}
```

### 3. clawfeed-daily — ClawFeed

**API URL**：`https://clawfeed.kevinhe.io/feed/kevin`

**数据获取**：抓取 JSON，按 `created_at` 过滤当天条目。

**清理规则**：
- 已是 Markdown 格式，最小处理
- 过滤掉空行过多的条目
- 按 `created_at` 过滤北京时间当天

**当日过滤逻辑**：
```typescript
const todayStr = formatBeijingDate(now) // "2026-04-04"
for (const digest of digests) {
  const digestDate = formatBeijingDate(new Date(digest.created_at))
  if (digestDate === todayStr) {
    // 保留
  }
}
```

---

## 接口设计 — `src/reports/ai-flash.ts`

```typescript
export interface AiFlashSource {
  id: string
  adapter: string  // "hexi-daily" | "juya-daily" | "clawfeed-daily"
  enabled: boolean
}

export interface AiFlashContent {
  sourceId: string
  sourceName: string
  publishedAt: string  // UTC ISO 8601 格式
  content: string      // 清理后的 Markdown
}

export async function fetchAiFlashSources(
  sources: AiFlashSource[],
  options: { fetchImpl?: typeof fetch }
): Promise<AiFlashContent[]>
```

**错误处理**：fail-silent，单个 source 获取失败时跳过，不阻塞其他 source。

---

## 日报生成器重写 — `src/reports/daily.ts`

**移除**：
- `classifyArticlesQuadrantBatch`
- `QuadrantData`、`Quadrant` 类型
- `quadrantPrompt` 参数

**新增**：
```typescript
export interface DailyReportData {
  date: string
  dateLabel: string
  aiFlash: AiFlashContent[]
  articles: ArticleForReport[]
}

export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],
  aiFlashSources: AiFlashSource[]
): Promise<DailyGenerateResult>
```

**Markdown 输出**：
```typescript
export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []
  lines.push(`# ${report.dateLabel}`)
  lines.push('')

  lines.push('## AI快讯')
  lines.push('')
  for (const flash of report.aiFlash) {
    lines.push(`### ${flash.sourceName}`)
    lines.push('')
    lines.push(flash.content)
    lines.push('')
  }

  lines.push('## 文章列表')
  lines.push('')
  for (const article of report.articles) {
    lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
  }

  return lines.join('\n')
}
```

---

## CLI 集成 — `src/cli/run.ts`

```typescript
const aiFlashSources = loadAiFlashSources()  // from ai-flash-sources.yaml
const aiFlashContent = await fetchAiFlashSources(aiFlashSources, { fetchImpl })
const result = await generateDailyReport(now, aiClient, rankedArticles, aiFlashContent)
```

---

## 配置加载 — `src/config/index.ts`

```typescript
interface Config {
  // ... existing fields
  aiFlashSources: AiFlashSource[]
}

export function loadAiFlashSources(): AiFlashSource[] { ... }
```

---

## 数据流对比

```
before:
  pipeline → normalizedArticle[] → quadrant分类 → 分组 → markdown

after:
  pipeline → normalizedArticle[] ──────────────────→ 文章列表
                                └──→ fetchAiFlashSources → AI快讯
```

两个模块完全并行，无依赖关系。

---

## sources.yaml 中原配置的处置

`config/sources.yaml` 中以下条目在切换到 dedicated adapter 后应设为 `enabled: false` 或注释掉：

- `ai-hubtoday-blog`（原 RSS 只返回周报，新逻辑走 dedicated hexi-daily）
- `juya-ai-daily`（原 RSS 不做日度过滤，新逻辑走 dedicated juya-daily）
- `clawfeed-kevinhe-io-feed-kevin`（原 adapter 返回全量历史，新逻辑走 dedicated clawfeed-daily）

---

## 后续优化（不在本期范围内）

1. **去重**：三个 AI快讯来源之间可能有内容重叠
2. **来源重要性权重**：某些来源优先级更高时可做排序
3. **hexi-daily 广告过滤**：目前用字符串特征过滤，可考虑更健壮的方式

---

## 测试策略

1. `bun test src/reports` — 单元测试覆盖清理逻辑
2. `bun run src/cli/run.ts -t 1h` — 端到端验证，检查输出格式
3. 手动检查生成的日报，确认三个子模块都正确渲染

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 删除 | `src/reports/filter-quadrant.ts` |
| 删除 | `src/ai/prompts-reports.ts` 中的 `parseQuadrantResult` |
| 新增 | `config/ai-flash-sources.yaml` |
| 新增 | `src/reports/ai-flash.ts` |
| 重写 | `src/reports/daily.ts` |
| 修改 | `config/reports.yaml`（删除 `quadrantPrompt`） |
| 修改 | `src/config/index.ts`（扩展 Config 类型，添加 `loadAiFlashSources`） |
| 修改 | `src/cli/run.ts`（集成 AI快讯获取） |
| 修改 | `config/sources.yaml`（将三个原 AI快讯 source 设为 `enabled: false` 或注释） |
