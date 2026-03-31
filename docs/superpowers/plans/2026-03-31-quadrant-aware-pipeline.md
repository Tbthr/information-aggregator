# 四象限感知 Pipeline 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在日报生成 Pipeline 中引入四象限感知：生产力距离分类 + 保鲜期分类 + 象限过滤 + 评分加权，移除 aiFilter 和 topicClustering（改用预设 Topic）。

**Architecture:** 核心变更在 `src/reports/daily.ts`，新增分类函数在 `src/reports/` 下新建文件，评分加权在内联实现（不修改共享类型），Schema 新增字段持久化象限信息。

**Tech Stack:** TypeScript, Prisma, Next.js API Routes

---

## File Impact Map

```
新建:
  src/reports/classify-productivity.ts      # 生产力距离分类
  src/reports/classify-freshness.ts        # 保鲜期分类
  src/reports/filter-quadrant.ts           # 象限过滤
  src/reports/log-distribution.ts          # 分布统计日志

修改:
  src/reports/daily.ts                     # 串联新步骤，移除 aiFilter/topicClustering，内联评分加权
  src/reports/scoring/types.ts             # ScoredCandidate 新增字段
  src/ai/prompts-reports.ts                # 移除聚类/过滤相关 prompt 函数
  src/types/index.ts                        # ReportCandidate 新增 freshnessTier/productivityDistance
  prisma/schema.prisma                      # DigestTopic 新增 freshnessTier/productivityDistance
```

---

## Task 1: Prisma Schema 变更

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 添加 DigestTopic 新字段**

修改 `prisma/schema.prisma` 中 DigestTopic 模型：

```prisma
model DigestTopic {
  // ... existing fields (id, dailyId, order, title, summary, contentIds) ...

  freshnessTier         String?  // "热点" | "趋势" | "经典"
  productivityDistance  String?  // "近" | "中" | "远"
}
```

- [ ] **Step 2: 执行数据库变更**

```bash
npx prisma db push
```

验证：`npx prisma db pull` 后检查 schema 是否包含新字段

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add freshnessTier and productivityDistance to DigestTopic"
```

---

## Task 2: 类型定义变更

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/reports/scoring/types.ts`

- [ ] **Step 1: ReportCandidate 新增可选字段**

在 `src/types/index.ts` 中找到 `ReportCandidate` 接口，添加：

```typescript
export interface ReportCandidate {
  // ... existing fields ...

  freshnessTier?:        "热点" | "趋势" | "经典"
  productivityDistance?: "近" | "中" | "远"
}
```

- [ ] **Step 2: ScoredCandidate 透传新字段**

在 `src/reports/scoring/types.ts` 中，`ScoredCandidate` 继承 `ReportCandidate`，会自动获得新字段。如需显式声明可检查是否需要修改。

- [ ] **Step 3: 验证类型**

```bash
pnpm check
```

预期：PASS（无类型错误）

- [ ] **Step 4: 提交**

```bash
git add src/types/index.ts
git commit -m "feat(types): add freshnessTier and productivityDistance to ReportCandidate"
```

---

## Task 3: 创建 classifyProductivityDistance

**Files:**
- Create: `src/reports/classify-productivity.ts`

- [ ] **Step 1: 编写分类函数**

创建文件 `src/reports/classify-productivity.ts`：

```typescript
import type { ReportCandidate } from "@/src/types/index"

export type ProductivityDistance = "近" | "中" | "远"

export interface CandidateWithDistance {
  candidate: ReportCandidate
  distance: ProductivityDistance
  distanceSignals: string[]  // 用于日志：哪些信号判定为该距离
}

const PRODUCTIVITY_KEYWORDS = {
  近: ["开发", "教程", "实战", "代码", "编程", "架构", "API", "SDK", "Bug", "修复"],
  中: ["趋势", "分析", "行业", "竞品", "市场"],
  远: ["融资", "并购", "高管", "战略", "宫斗", "估值", "IPO", "财报", "八卦"],
}

/**
 * 综合判断内容与生产力的距离
 * - 来源类型：HN/Reddit 热帖 → 中/远；官方博客/论文 → 近
 * - 关键词匹配
 */
export function classifyProductivityDistance(
  candidates: ReportCandidate[]
): CandidateWithDistance[] {
  return candidates.map((candidate) => {
    const signals: string[] = []
    let score = 0

    // 来源类型判断
    const sourceKind = candidate.sourceKind
    if (sourceKind === "website" || sourceKind === "blog") {
      score += 1
      signals.push(`sourceKind:${sourceKind}=近`)
    } else if (sourceKind === "hn" || sourceKind === "reddit") {
      score -= 0.5
      signals.push(`sourceKind:${sourceKind}=中/远`)
    }

    // 标题 + summary 文本
    const text = ((candidate.title ?? "") + " " + (candidate.summary ?? "")).toLowerCase()

    // 近距离关键词
    for (const kw of PRODUCTIVITY_KEYWORDS.近) {
      if (text.includes(kw)) {
        score += 1
        signals.push(`近:${kw}`)
      }
    }

    // 远距离关键词
    for (const kw of PRODUCTIVITY_KEYWORDS.远) {
      if (text.includes(kw)) {
        score -= 2
        signals.push(`远:${kw}`)
      }
    }

    // 中距离关键词（轻微加成）
    for (const kw of PRODUCTIVITY_KEYWORDS.中) {
      if (text.includes(kw)) {
        score += 0.5
        signals.push(`中:${kw}`)
      }
    }

    // 判定
    let distance: ProductivityDistance
    if (score >= 1) {
      distance = "近"
    } else if (score <= -1) {
      distance = "远"
    } else {
      distance = "中"
    }

    return { candidate, distance, distanceSignals: signals }
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add src/reports/classify-productivity.ts
git commit -m "feat(classify): add classifyProductivityDistance function"
```

---

## Task 4: 创建 classifyFreshness

**Files:**
- Create: `src/reports/classify-freshness.ts`

- [ ] **Step 1: 编写分类函数**

创建文件 `src/reports/classify-freshness.ts`：

```typescript
import type { ReportCandidate } from "@/src/types/index"

export type FreshnessTier = "热点" | "趋势" | "经典"

export interface CandidateWithFreshness {
  candidate: ReportCandidate
  freshness: FreshnessTier
  freshnessSignals: string[]
}

const FRESHNESS_KEYWORDS = {
  热点: ["发布", "更新", "紧急", "融资", "收购", "上线", "发布日", "发布"],
  经典: ["教程", "指南", "原理", "分析", "解读", "详解", "深入", "完全指南", "入门", "一步一步"],
}

const SHORT_CONTENT_TYPES = ["news", "discussion", "announcement"]
const LONG_CONTENT_TYPES = ["tutorial", "documentation", "article", "paper"]

/**
 * 综合判断内容的保鲜期
 * - 来源类型：HN/Reddit → 偏短；官方文档/博客 → 偏长
 * - 内容类型：news/discussion → 短；tutorial/documentation → 长
 * - 关键词
 * - 字数
 */
export function classifyFreshness(
  candidates: ReportCandidate[]
): CandidateWithFreshness[] {
  return candidates.map((candidate) => {
    const signals: string[] = []
    let score = 0

    // 内容类型判断
    const contentType = candidate.contentType?.toLowerCase() ?? ""
    if (SHORT_CONTENT_TYPES.includes(contentType)) {
      score -= 1
      signals.push(`contentType:${contentType}=短`)
    } else if (LONG_CONTENT_TYPES.includes(contentType)) {
      score += 1
      signals.push(`contentType:${contentType}=长`)
    }

    // 来源类型
    const sourceKind = candidate.sourceKind
    if (sourceKind === "hn" || sourceKind === "reddit") {
      score -= 0.5
      signals.push(`sourceKind:${sourceKind}=偏短`)
    } else if (sourceKind === "website" || sourceKind === "blog") {
      score += 0.5
      signals.push(`sourceKind:${sourceKind}=偏长`)
    }

    // 标题 + summary 文本
    const text = ((candidate.title ?? "") + " " + (candidate.summary ?? "")).toLowerCase()

    // 热点关键词
    for (const kw of FRESHNESS_KEYWORDS.热点) {
      if (text.includes(kw)) {
        score -= 1.5
        signals.push(`热点:${kw}`)
      }
    }

    // 经典关键词
    for (const kw of FRESHNESS_KEYWORDS.经典) {
      if (text.includes(kw)) {
        score += 1.5
        signals.push(`经典:${kw}`)
      }
    }

    // 字数判断（summary 长度）
    const summaryLen = (candidate.summary ?? "").length
    if (summaryLen > 2000) {
      score += 1
      signals.push(`长文:${summaryLen}字`)
    } else if (summaryLen < 300) {
      score -= 1
      signals.push(`短文:${summaryLen}字`)
    }

    // 判定
    let freshness: FreshnessTier
    if (score >= 1) {
      freshness = "经典"
    } else if (score <= -1) {
      freshness = "热点"
    } else {
      freshness = "趋势"
    }

    return { candidate, freshness, freshnessSignals: signals }
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add src/reports/classify-freshness.ts
git commit -m "feat(classify): add classifyFreshness function"
```

---

## Task 5: 创建 filterByQuadrant

**Files:**
- Create: `src/reports/filter-quadrant.ts`

- [ ] **Step 1: 编写过滤函数**

创建文件 `src/reports/filter-quadrant.ts`：

```typescript
import type { CandidateWithDistance } from "./classify-productivity"
import type { CandidateWithFreshness } from "./classify-freshness"

export type Quadrant = "噪音" | "地图感" | "尝试" | "深度"

export function getQuadrant(
  distance: CandidateWithDistance["distance"],
  freshness: CandidateWithFreshness["freshness"]
): Quadrant {
  const isFar = distance === "远"
  const isHot = freshness === "热点"

  if (isFar && isHot) return "噪音"
  if (isFar) return "地图感"
  if (freshness === "经典") return "深度"
  return "尝试"
}

/**
 * 左下角噪音过滤：远 + 热点 → 丢弃
 * 其他象限保留
 */
export function filterByQuadrant(
  candidatesWithDistance: CandidateWithDistance[],
  allCandidatesWithFreshness: CandidateWithFreshness[]
): CandidateWithDistance[] {
  const freshnessMap = new Map(
    allCandidatesWithFreshness.map(({ candidate, freshness }) => [candidate.id, freshness])
  )

  return candidatesWithDistance.filter(({ candidate, distance }) => {
    const freshness = freshnessMap.get(candidate.id) ?? "趋势"
    const quadrant = getQuadrant(distance, freshness)
    return quadrant !== "噪音"
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add src/reports/filter-quadrant.ts
git commit -m "feat(filter): add filterByQuadrant for quadrant-based filtering"
```

---

## Task 6: 创建 logDistribution

**Files:**
- Create: `src/reports/log-distribution.ts`

- [ ] **Step 1: 编写日志函数**

创建文件 `src/reports/log-distribution.ts`：

```typescript
import type { CandidateWithDistance } from "./classify-productivity"
import type { CandidateWithFreshness } from "./classify-freshness"
import type { DigestTopic } from "@prisma/client"
import { getQuadrant } from "./filter-quadrant"

export interface DistributionStats {
  quadrant: Record<string, number>
  freshness: Record<string, number>
  productivity: Record<string, number>
  inputCount: number
  filteredCount: number
  topicCount: number
}

export function logDistribution(
  allCandidates: (CandidateWithDistance & CandidateWithFreshness)[],
  filteredCandidates: CandidateWithDistance[],
  finalTopics: DigestTopic[]
): void {
  const quadrantCounts: Record<string, number> = { 噪音: 0, 地图感: 0, 尝试: 0, 深度: 0 }
  const freshnessCounts: Record<string, number> = { 热点: 0, 趋势: 0, 经典: 0 }
  const productivityCounts: Record<string, number> = { 近: 0, 中: 0, 远: 0 }

  for (const c of allCandidates) {
    const quadrant = getQuadrant(c.distance, c.freshness)
    quadrantCounts[quadrant]++
    freshnessCounts[c.freshness]++
    productivityCounts[c.distance]++
  }

  console.log("[daily-report] 分布统计:")
  console.log(`  象限分布: ${JSON.stringify(quadrantCounts)}`)
  console.log(`  保鲜期:   ${JSON.stringify(freshnessCounts)}`)
  console.log(`  生产力:   ${JSON.stringify(productivityCounts)}`)
  console.log(`  输入候选: ${allCandidates.length} → 过滤后: ${filteredCandidates.length} → 最终topics: ${finalTopics.length}`)
}
```

- [ ] **Step 2: 提交**

```bash
git add src/reports/log-distribution.ts
git commit -m "feat(log): add logDistribution for quadrant statistics"
```

---

## Task 7: 评分加权（内联实现）

**Files:**
- Modify: `src/reports/daily.ts`（在 Task 9 中一并处理）

**说明**：`applyProductivityBonus` 作为独立函数放入 `merge-stage.ts` 会导致类型不匹配问题（`ScoreBreakdown` 不能随意扩展字段）。采用内联方式在 `daily.ts` 的 `scoreCandidates` 之后直接修改 `finalScore`，不修改共享类型定义。

此任务合并到 Task 9 中执行。

---

## Task 8: 更新 prompts-reports.ts（移除废弃函数）

**Files:**
- Modify: `src/ai/prompts-reports.ts`

- [ ] **Step 1: 确认哪些函数需要移除**

需要移除：
- `buildTopicClusteringPrompt`
- `parseTopicClusteringResult`
- `buildFilterPrompt`
- `parseFilterResult`

需要保留：
- `buildTopicSummaryPrompt`（仍用于按预设 Topic 生成摘要）
- `parseTopicSummaryResult`

- [ ] **Step 2: 移除废弃函数并清理 exports**

在 `src/ai/prompts-reports.ts` 中删除上述 4 个函数及其相关类型（如 `TopicClusterItem`）。

- [ ] **Step 3: 验证构建**

```bash
pnpm check
```

预期：可能有类型错误（使用了被删除函数的地方），按需修复。

- [ ] **Step 4: 提交**

```bash
git add src/ai/prompts-reports.ts
git commit -m "feat(prompts): remove unused clustering and filter prompts"
```

---

## Task 9: 重构 daily.ts

**Files:**
- Modify: `src/reports/daily.ts`

- [ ] **Step 1: 阅读当前 daily.ts 结构**

重点关注：
- `collectCandidates` 位置（约 line 260+）
- `scoreCandidates` 位置
- `trimTopN` 位置
- `aiFilter` 调用（约 line 504）
- `topicClustering` 调用（约 line 515）
- `generateTopicSummaries` 实现
- `persistResults` 实现

- [ ] **Step 2: 按 spec 的 pipeline 顺序重排代码**

新的 `generateDailyReport` 函数内顺序：

```typescript
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient
): Promise<DailyGenerateResult> {
  // ... 现有 config 加载 ...

  // Step 1: Collect data
  const { contents } = await collectData(now)

  // Step 2: Filter by topic/excludeRules
  const { filteredContents } = await filterContent(contents, config)

  if (filteredContents.length === 0) {
    await persistResults(date, dayLabel, [], "过去24小时无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 3: Map to ReportCandidate[]
  const candidates = collectCandidates(filteredContents)

  // Step 4: Classify productivity distance
  const candidatesWithDistance = classifyProductivityDistance(candidates)

  // Step 5: Classify freshness
  const candidatesWithFreshness = classifyFreshness(candidates)

  // Step 6: Quadrant filter (远+热点 丢弃)
  const filteredByQuadrant = filterByQuadrant(
    candidatesWithDistance,
    candidatesWithFreshness
  )
  const filteredCandidates = filteredByQuadrant.map(c => c.candidate)

  if (filteredCandidates.length === 0) {
    await persistResults(date, dayLabel, [], "象限过滤后无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 7: Score candidates
  const kindPreferences = parseKindPreferences(config.kindPreferences)
  let scored = scoreCandidates(filteredCandidates, { kindPreferences })

  // Step 8: Productivity bonus
  const distanceMap = new Map(
    candidatesWithDistance.map(c => [c.candidate.id, c.distance])
  )
  scored = scored.map(c => ({
    ...c,
    breakdown: {
      ...c.breakdown,
      finalScore: c.breakdown.finalScore * (distanceMap.get(c.id) === "近" ? 1.3 : distanceMap.get(c.id) === "远" ? 0.8 : 1.0)
    }
  }))

  // Step 9: Trim top N
  const maxItems = config.maxItems ?? 50
  const trimmed = trimTopN(scored, maxItems)

  // [REMOVE] aiFilter - no longer needed
  // [REMOVE] topicClustering - use preset topics instead

  // Step 10: Generate topic summaries by preset Topic
  const topics = await generateTopicSummariesByPresetTopics(trimmed, aiClient, config, candidatesWithDistance, candidatesWithFreshness)

  // Step 11: Log distribution
  const allClassified = candidatesWithDistance.map((c, i) => ({
    ...c,
    ...candidatesWithFreshness[i],
  }))
  logDistribution(allClassified, filteredByQuadrant, topics)

  // Step 12: Persist
  await persistResults(date, dayLabel, topics, errorSteps.length > 0 ? "部分步骤失败" : undefined, errorSteps)

  return { date, topicCount: topics.length, errorSteps }
}
```

- [ ] **Step 3: 新实现 generateTopicSummariesByPresetTopics（替换原 generateTopicSummaries）**

原 `generateTopicSummaries` 依赖 AI 聚类结果。新版本按预设 Topic 遍历：

```typescript
async function generateTopicSummariesByPresetTopics(
  candidates: ScoredCandidate[],
  aiClient: AiClient,
  config: DailyReportConfig,
  candidatesWithDistance: CandidateWithDistance[],
  candidatesWithFreshness: CandidateWithFreshness[]
) {
  // 先查 Topic 表获取 topicId → topicName 的映射
  const { loadTopicsByIds } = await import("@/src/config/load-pack-prisma")
  const topicRecords = await loadTopicsByIds(config.topicIds)
  const topicNameMap = new Map(topicRecords.map(t => [t.id, t.name]))

  const results: { topicId: string; title: string; summary: string; contentIds: string[]; freshnessTier?: string; productivityDistance?: string }[] = []

  for (const topicId of config.topicIds) {
    const topicName = topicNameMap.get(topicId) ?? topicId
    const topicCandidates = candidates.filter(c =>
      c.topicIds?.includes(topicId)
    )
    if (topicCandidates.length === 0) continue

    // 获取该 topic 下内容的 freshness 和 distance
    const freshnessCounts = { 热点: 0, 趋势: 0, 经典: 0 }
    const distanceCounts = { 近: 0, 中: 0, 远: 0 }
    for (const c of topicCandidates) {
      const freshness = candidatesWithFreshness.find(f => f.candidate.id === c.id)?.freshness ?? "趋势"
      const distance = candidatesWithDistance.find(d => d.candidate.id === c.id)?.distance ?? "中"
      freshnessCounts[freshness]++
      distanceCounts[distance]++
    }

    // AI 生成摘要
    const contents = topicCandidates.map(c => ({
      title: c.title ?? "",
      summary: c.summary.slice(0, 500),
      type: c.kind === "tweet" ? "tweet" : "item",
    }))

    // buildTopicSummaryPrompt(topicTitle, contents, prompt)
    const prompt = buildTopicSummaryPrompt(topicName, contents, config.topicSummaryPrompt)
    const result = await aiClient.generateText(prompt)
    const parsed = parseTopicSummaryResult(result)

    // 取最多的象限作为这个 DigestTopic 的标注
    const topFreshness = (Object.entries(freshnessCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) as "热点" | "趋势" | "经典" | undefined
    const topDistance = (Object.entries(distanceCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) as "近" | "中" | "远" | undefined

    results.push({
      topicId,
      title: topicName,  // 使用 Topic 表中的 name，不是 ID
      summary: parsed.summary,
      contentIds: topicCandidates.map(c => c.id),
      freshnessTier: topFreshness,
      productivityDistance: topDistance,
    })
  }

  return results
}
```

- [ ] **Step 4: 移除 aiFilter 和 topicClustering 相关代码**

删除：
- `aiFilter` 函数定义（约 line 242-262）
- `topicClustering` 函数定义（约 line 263-290）
- 所有对 `aiFilter` 和 `topicClustering` 的调用

- [ ] **Step 5: 更新 persistResults**

修改 `persistResults` 调用，传入 freshnessTier 和 productivityDistance：

```typescript
async function persistResults(
  date: string,
  dayLabel: string,
  topics: {
    title: string
    summary: string
    contentIds: string[]
    topicId: string
    freshness?: string
    productivityDistance?: string
  }[],
  errorMessage?: string,
  errorSteps?: string[]
) {
  // ... 现有逻辑，DigestTopic 创建时增加新字段 ...
}
```

- [ ] **Step 6: 验证构建**

```bash
pnpm check && pnpm build
```

处理所有类型错误

- [ ] **Step 7: 提交**

```bash
git add src/reports/daily.ts
git commit -m "feat(daily): integrate quadrant-aware pipeline, remove aiFilter/topicClustering"
```

---

## Task 10: 全量验证

- [ ] **Step 1: 运行 TypeScript 检查**

```bash
pnpm check
```

预期：PASS，无类型错误

- [ ] **Step 2: 运行构建**

```bash
pnpm build
```

预期：BUILD SUCCESSFUL

- [ ] **Step 3: 运行日报诊断（如 dev server 运行中）**

```bash
npx tsx scripts/diagnostics.ts reports --daily-only --verbose
```

验证：
- 日报生成成功
- 分布日志正常输出
- 远+热点内容被过滤（看日志中 噪音: 0 或具体数值）

- [ ] **Step 4: 提交所有剩余变更**

如有未提交文件，一并提交

---

## 验收标准

- [ ] `pnpm check` 通过
- [ ] `pnpm build` 通过
- [ ] 日报生成成功，分布日志正常输出（噪音/地图感/尝试/深度统计）
- [ ] 远+热点内容被正确过滤
- [ ] 近+经典内容排名靠前（通过 DigestTopic 中 contentIds 顺序验证）
- [ ] DigestTopic 表中正确存储 freshnessTier 和 productivityDistance
