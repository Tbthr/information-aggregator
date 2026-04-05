# AI快讯模块重构设计方案

## 背景

当前日报 `reports/daily/YYYY-MM-DD.md` 存在以下问题：

1. **何夕2077 提取失效**：`fetchHexiDaily` 的边界匹配 `#\s+AI资讯日报` 在 r.jina.ai 渲染后无法匹配，导致整页目录导航被截入报告
2. **橘鸦AI早报内容重复**：每条 item 的 `<blockquote>` + `<p>` 两段内容都被保留，造成重复
3. **模块结构不合理**：三个 AI 快讯来源（何夕、橘鸦、ClawFeed）平铺展示，没有分类组织；ClawFeed 来自 Twitter 高质量内容，与其他两者性质不同，应该独立模块
4. **配置分散**：`config/sources.yaml` 中仍有 `clawfeed-kevinhe-io-feed-kevin`、`ai-hubtoday-blog`、`juya-ai-daily` 三个 pipeline source 定义，但实际内容已切换至 dedicated adapter，造成配置冗余

## 目标

1. 修复何夕2077 和橘鸦的内容提取问题
2. 将何夕 + 橘鸦合并为一个结构化的 "AI快讯" 模块，通过 AI 分类组织
3. 将 ClawFeed 独立为 "推特精选" 模块
4. 文章列表模块保持不变

---

## 一、提取层修复

### 1.1 何夕2077 — 提取边界修复

**问题**：`r.jina.ai` 渲染的页面中，标题是 `## **今日摘要**`，而非 `# AI资讯日报`，导致原正则匹配失败，整站导航被截入。

> ✅ 已验证：curl `r.jina.ai/https://ai.hubtoday.app/2026-04/2026-04-05/` 确认第 726 行为 `## **今日摘要**`（双 `#`），正则 `/^## \*\*今日摘要\*\*$/` 可正确匹配。

**修复方案**：

| 边界 | 当前 | 修复后 |
|---|---|---|
| 起始 | `#\s+AI资讯日报`（匹配不到） | `## **今日摘要**` |
| 结束 | `© 2026 何夕2077`（不稳定） | `## **AI资讯日报多渠道** |

**实现**（`src/reports/ai-flash.ts` → `fetchHexiDaily`）：

```typescript
// 日期计算：统一使用 beijingDayRange（与 fetchJuyaDaily / fetchClawfeedDaily 一致）
const todayStr = new Date().toISOString().split('T')[0]
const { start } = beijingDayRange(todayStr)
const yyyy = start.getUTCFullYear()
const mm = String(start.getUTCMonth() + 1).padStart(2, '0')
const dd = String(start.getUTCDate()).padStart(2, '0')
const dateStr = `${yyyy}-${mm}-${dd}`
const monthStr = `${yyyy}-${mm}`

const url = `https://r.jina.ai/https://ai.hubtoday.app/${monthStr}/${dateStr}/`
const resp = await fetcher(url)
if (!resp.ok) return null
const text = await resp.text()

// 边界提取逻辑
const lines = text.split('\n')
let startIdx = -1
let endIdx = lines.length

for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^## \*\*今日摘要\*\*$/)) {
    startIdx = i + 1
  }
  if (lines[i].match(/^## \*\*AI资讯日报多渠道\*\*$/)) {
    endIdx = i
    break
  }
}

// fallback: 页面结构变化导致找不到起始锚点 → 返回 null，该 source 跳过
if (startIdx < 0) return null

const contentLines = lines.slice(startIdx, endIdx).filter(line => {
  return !AD_KEYWORDS.some(keyword => line.includes(keyword))
})
```

**输出格式**：保留原有的 Markdown 内容（何夕本身已经是结构化 Markdown），不过度清洗。

---

### 1.2 橘鸦AI早报 — 去重 + 链接保留

**问题**：每条 item 的 `<content:encoded>` 包含 `<blockquote>`（摘要）+ `<p>`（展开），导致重复内容。

**修复方案**：每条 item 只取 `<blockquote>` 内容 + 保留 `<h2>` 的链接 + 保留 `<ul>` 中的相关链接列表。

**HTML 结构分析**（每条 item）：

```html
<h2><a href="https://www.kimi.com/code">Kimi 推出 Kimi Code...</a> #1</h2>
<blockquote>
  <p>Kimi 现已推出 Kimi Code 抢先体验计划...</p>
</blockquote>
<p>（第二段展开，不取）</p>
<ul>
  <li><a href="https://www.kimi.com/code">链接</a></li>
</ul>
<hr>
<!-- 下一条 item -->
```

**实现**（`src/reports/ai-flash.ts` → `fetchJuyaDaily`）：

```typescript
interface JuyaItem {
  title: string
  url: string
  summary: string   // blockquote 内容
  links: string[]   // <ul> 内的所有链接
}

function extractJuyaItem(itemHtml: string): JuyaItem | null {
  // 1. 提取标题和链接（<h2>），作为主 URL
  const h2Match = /<h2><a href="([^"]+)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/.exec(itemHtml)
  if (!h2Match) return null
  const mainUrl = h2Match[1]
  const title = h2Match[2].trim()

  // 2. 提取 blockquote 作为摘要（优先）
  const bqMatch = /<blockquote><p>([\s\S]*?)<\/p><\/blockquote>/.exec(itemHtml)
  //    fallback：无 blockquote 时，取第一个 <p> 段落（去掉所有标签）
  const summary = bqMatch
    ? bqMatch[1].replace(/<[^>]+>/g, '').trim()
    : (itemHtml.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()

  // 3. 提取 <ul> 内所有链接作为相关链接
  const linkMatches = [...itemHtml.matchAll(/<li><a href="([^"]+)">(.*?)<\/a><\/li>/g)]
  const links = linkMatches.map(m => m[1]).filter(u => u !== mainUrl)

  return { title, url: mainUrl, summary, links }
}
```

**输出格式**：

```markdown
- [**Kimi 推出 Kimi Code 抢先体验计划**](https://www.kimi.com/code) — Kimi 现已推出 Kimi Code 抢先体验计划，付费用户可登录控制台提交申请，通过后即可获得更多额度并抢先体验最新 Code 模型。
  来源: [橘鸦AI早报](https://imjuya.github.io/...)
```

---

## 二、日报结构重组

### 2.0 配置现状调研

**三个 dedicated adapter 的 URL（hardcoded in `src/reports/ai-flash.ts`）：**

| adapter | 实际访问 URL | 说明 |
|---|---|---|
| `hexi-daily` | `r.jina.ai/https://ai.hubtoday.app/{month}/{date}/` | 当日文章页（rss.xml 是总览，不是当日内容） |
| `juya-daily` | `imjuya.github.io/juya-ai-daily/rss.xml` | RSS，与 pipeline URL 相同但 dedicated 有日期过滤 |
| `clawfeed-daily` | `clawfeed.kevinhe.io/feed/kevin` | JSON digest，与 pipeline URL 完全相同 |

**`config/sources.yaml` pipeline source URL 对比：**

| source id | pipeline URL | 与 dedicated URL 相同？ | 处理 |
|---|---|---|---|
| `clawfeed-kevinhe-io-feed-kevin` | `clawfeed.kevinhe.io/feed/kevin` | ✅ 完全相同 | **移除** |
| `ai-hubtoday-blog` | `ai.hubtoday.app/blog/index.xml` | ❌ 不同（pipeline 是总览，dedicated 是当日文章） | 保留或移除均可（dedicated 已覆盖） |
| `juya-ai-daily` | `imjuya.github.io/juya-ai-daily/rss.xml` | ❌ 不同（dedicated 有日期过滤） | 保留或移除均可（dedicated 已覆盖） |

> 注：后两者 pipeline 侧均为 `enabled: false`，不影响当前运行。但为避免混淆，一并移除。

**Adapter 读取 source 定义的方式：**
- Dedicated adapter 的 URL **全部 hardcoded** 在 `src/reports/ai-flash.ts` 三个函数里
- `config/ai-flash-sources.yaml` 只负责定义"有哪些 source 要跑"（id、adapter 类型、enabled 开关）
- 因此 **`ai-flash-sources.yaml` 的内容不需要任何改动**，adapter 代码也不需要改

**`sources.yaml` 需要移除的三个 source：**
- `clawfeed-kevinhe-io-feed-kevin`（完全重复）
- `ai-hubtoday-blog`（dedicated 已覆盖，pipeline enabled=false）
- `juya-ai-daily`（dedicated 已覆盖，pipeline enabled=false）

### 2.0 配置加载链路

**现状（已存在，无需变更）：**

```
config/
  ├── sources.yaml          → loadSources()      → pipeline 收集管道
  ├── tags.yaml             → loadTags()         → pipeline tag 过滤
  ├── reports.yaml          → loadReportsConfig() → enrich 配置 + dailyConfig
  └── ai-flash-sources.yaml → loadAiFlashSources() → dedicated adapter（已存在）
```

**配置读取入口**（`src/config/index.ts`）：

| 函数 | 读取文件 | 输出类型 | 消费者 |
|---|---|---|---|
| `loadSources()` | `config/sources.yaml` | `Source[]` | pipeline collect |
| `loadTags()` | `config/tags.yaml` | `Tag[]` | pipeline filter |
| `loadReportsConfig()` | `config/reports.yaml` | `{ enrichOptions, dailyConfig }` | enrich pipeline + daily report |
| `loadAiFlashSources()` | `config/ai-flash-sources.yaml` | `AiFlashSource[]` | `generateDailyReport()` |

**本次变更涉及的配置更新：**

- `loadReportsConfig()` 新增读取 `config/reports.yaml` 下的 `ai-flash-categorization` 配置节
- `loadAiFlashSources()` 保持不变（已正确读取 `ai-flash-sources.yaml`）

**变更后的 `DailyConfig` 接口**（`src/config/index.ts`）：

```typescript
export interface DailyConfig {
  quadrantPrompt: string
  aiFlashCategorization: {
    enabled: boolean
    maxCategories: number
    prompt: string
  }
}
```

### 2.1 目标结构

```
# 4月5日 日报

## AI快讯
[何夕2077 + 橘鸦AI早报 → AI 分类组织]

## 推特精选
[ClawFeed 单独呈现，不做二次加工]

## 文章列表
[pipeline 文章列表]
```

### 2.2 AI快讯 — 合并 + 分类

**处理流程**：

```
1. fetchHexiDaily() → 何夕 Markdown 内容 → parseHexiMarkdownToItems() → AiFlashItem[]
2. fetchJuyaDaily() → 橘鸦条目 → AiFlashItem[]
3. 合并两个来源的条目
4. AI 分类（只分类，不改写内容）
5. 渲染输出
```

**分类体系（固定）**：

| 分类 | 说明 | 边界说明 |
|---|---|---|
| 产品更新 | 新产品/功能发布、版本更新 | 以产品为主的事件（如 GPT-5 发布）归此类 |
| 前沿研究 | 论文、学术发现、技术研究 | 以技术突破为主的事件（如新论文、新架构）归此类 |
| 行业动态 | 公司动向、政策、市场趋势 | 商业决策、财报、政策法规归此类 |
| 开源项目 | GitHub 项目、工具发布 | 有明确代码仓库的项目发布归此类 |
| 社媒精选 | Twitter/X 讨论热度高的内容 | 社区热帖、观点争鸣、非产品/技术类推文归此类 |
| 其他 | 与 AI 行业无关的生活/娱乐内容 | 如 AI 生成的音乐，游戏等内容；分类失败时 fallback |

**`categorizeAiFlash` 接口定义**：

```typescript
// 输入条目格式（来自 Hexi 和 Juya 的标准化输出）
interface AiFlashItem {
  title: string       // 原始标题
  url: string         // 原始链接
  summary: string     // 摘要正文
  sourceName: string  // "何夕2077" | "橘鸦AI早报"
}

// 分类函数签名
async function categorizeAiFlash(
  items: AiFlashItem[],
  aiClient: AiClient,
  options?: { maxCategories?: number }
): Promise<AiFlashCategory[]>

// 输出格式
interface AiFlashCategory {
  name: '产品更新' | '前沿研究' | '行业动态' | '开源项目' | '社媒精选' | '其他'
  items: AiFlashItem[]
}
```

**AI 分类 Prompt**：存放于 `config/reports.yaml`，由 `ai-flash-categorization.prompt` 字段引用。

```yaml
ai-flash-categorization:
  enabled: true
  maxCategories: 6
  prompt: |
    你是一个内容分类助手。请将以下 AI 快讯条目分类到以下类别：
    产品更新 / 前沿研究 / 行业动态 / 开源项目 / 社媒精选 / 其他

    规则：
    - 不要改写任何内容，只输出分类结果
    - 每个条目必须归属一个类别
    - 输出 JSON 格式：{ "categories": [{ "name": "产品更新", "items": [...] }, ...] }
    - 类别数量不超过 6 个，"其他"作为最后兜底

    输入条目：
    {items}
```

**输出格式**：

```markdown
## AI快讯

### 产品更新
- [**Kimi Code** 抢先体验计划开放申请](https://www.kimi.com/code) — Kimi 现已推出 Kimi Code...
- [**NotebookLM** 升级测验闪卡功能](https://x.com/NotebookLM/status/2040227127082295424) — NotebookLM 升级 Quizzes 与 Flashcards...

### 前沿研究
- [**斯坦福实锤 ChatGPT 马屁精**](https://x.com/iBusinessAI/status/2040221469289099497) — 研究显示 ChatGPT 讨好程度比真人高 49%...
- ...

（其他分类同理）
```

**来源标注**：每个条目标题的链接即为原始来源，不额外标注来源名称。

---

### 2.3 推特精选 — ClawFeed 独立模块

**处理流程**：

```
1. fetchClawfeedDaily() → ClawFeed 内容（保持原样）
2. 直接渲染，不做 AI 分类
```

**输出格式**：保持 ClawFeed 原有 Markdown 格式，不做二次加工。时区（SGT）保留原始数据的时间标注。

```markdown
## 推特精选

☀️ ClawFeed | 2026-04-05 00:41 SGT

🔥 重要
• ...
```

---

## 三、文件变更

| 文件 | 变更 |
|---|---|
| `config/sources.yaml` | 移除 `clawfeed-kevinhe-io-feed-kevin`（与 dedicated clawfeed 完全重复）、`ai-hubtoday-blog`、`juya-ai-daily`（pipeline enabled=false，dedicated 已覆盖） |
| `config/ai-flash-sources.yaml` | **无需任何变更**（dedicated adapter URL 全部 hardcoded，不依赖此文件的 URL） |
| `config/reports.yaml` | 新增 `ai-flash-categorization` 配置节（`enabled`、`maxCategories`、`prompt`），AI 分类 prompt 从此读取 |
| `src/config/index.ts` | `loadReportsConfig()` 新增解析 `ai-flash-categorization` 配置节；`DailyConfig` 接口新增 `aiFlashCategorization` 字段 |
| `src/reports/ai-flash.ts` | **修复**：修复 `fetchHexiDaily` 边界 + 日期计算（改用 `beijingDayRange`）；重构 `fetchJuyaDaily` 去重逻辑（blockquote-only + link extraction）；**新增** `AiFlashItem` 和 `AiFlashCategory` 类型定义；**新增** `categorizeAiFlash` 函数（~100 行，核心分类逻辑） |
| `src/reports/daily.ts` | **`DailyReportData` 接口重新设计**：拆分为 `mergedAiFlash: AiFlashCategory[]`（分类后）和 `clawfeed: AiFlashContent | null`（独立）；**`generateDailyMarkdown` 完全重写**：从当前的"按 source 分块"改为"按分类渲染 + 推特模块独立" |
| `docs/superpowers/specs/2026-04-05-ai-flash-restructuring-design.md` | 本文档 |

---

## 四、验证计划

1. **单元测试**：修改后单独调用 `fetchHexiDaily`、`fetchJuyaDaily`，确认：
   - 边界提取正确（何夕不再有导航，橘鸦无重复）
   - 北京时间 00:30 运行，`beijingDayRange` 与旧逻辑结果一致
2. **E2E 测试**：`bun run src/cli/run.ts -t 1h`，检查日报输出：
   - 何夕部分不再有整页导航
   - 橘鸦部分每条只出现一次，无重复段落
   - AI快讯有分类标签（6 个分类的子标题），无来源名称标注
   - 推特精选独立成块，位置在 AI快讯 之后
   - 文章列表 位置从第二位移到第三位，内容不受影响
3. **回归测试**：确保 pipeline 文章列表不受影响
4. **配置核对**：`config/sources.yaml` 中不再包含 `clawfeed-kevinhe-io-feed-kevin`、`ai-hubtoday-blog`、`juya-ai-daily` 三个 source

---

## 五、风险与边界情况

| 风险 | 处理方式 |
|---|---|
| 何夕页面结构再次变化 | `startIdx < 0` 时返回 null，该 source 跳过（不再截取导航内容） |
| 橘鸦某 item 无 blockquote | 降级取 `<p>` 第一段 |
| AI 分类失败 | fallback：所有条目归入"其他" |
| ClawFeed 无当日内容 | 显示"暂无内容"，不报错 |
| `## **AI资讯日报多渠道**` 标题被移除 | `endIdx` 默认取 `lines.length`，不会漏内容但可能截到末尾广告，需要人工巡检 |

---

## 六、时区说明

- **何夕 / 橘鸦**：统一使用 `beijingDayRange` 计算北京时间（UTC+8），确保 00:00–00:59 边界无偏差
- **ClawFeed**：时间戳保留 SGT（新加坡时间），因数据本身来自新加坡服务器，保留原始时区便于追溯
