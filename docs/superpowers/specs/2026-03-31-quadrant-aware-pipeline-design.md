# 四象限感知的信息 Pipeline 设计

## 概述

基于宝玉的四象限学习法思想，将「离生产力距离」和「知识保鲜期」两个维度引入日报生成 Pipeline，实现：

1. **过滤**：将"远+短"象限（左下角噪音）内容直接过滤
2. **评分加权**：近+经典内容获得更高优先级
3. **分类标注**：为 DigestTopic 添加保鲜期和生产力距离分类
4. **分布统计**：日志输出每天内容的象限分布

## 维度定义

### 维度一：生产力距离（Productivity Distance）

判断内容与"你当前工作"的距离。

| 级别 | 判断依据 | 示例 |
|------|----------|------|
| **近** | 来源/主题与日常工作直接相关 | AI 开发博客、编程教程、产品技术文档 |
| **中** | 行业相关信息，有间接价值 | 行业趋势分析、竞品技术解读 |
| **远** | 噪音区域，与具体工作距离远 | 融资新闻、高管变动、芯片参数、厂商八卦 |

### 维度二：知识保鲜期（Freshness Tier）

判断内容过时速度。

| 级别 | 判断依据 | 示例 |
|------|----------|------|
| **热点** | 新闻突发、产品发布、融资/并购 | "发布 GPT-5"、"X 公司融资" |
| **趋势** | 新技术出现但形态未稳定 | 新框架发布 1-2 周内 |
| **经典** | 原理分析、教程、深度解读 | "RAG 原理详解"、"React 架构解读" |

### 维度三：四象限判定

两个维度交叉得出四个象限：

| 象限 | 条件 | 处理策略 |
|------|------|----------|
| **噪音（过滤）** | 远 + 热点 | 直接丢弃，不进入日报 |
| **地图感** | 远 + 趋势/经典 | 保留，低优先级 |
| **尝试** | 近 + 热点/趋势 | 保留，中等优先级 |
| **深度（核心）** | 近 + 经典 | 高优先级，重点 AI 投入 |

## Pipeline 变更

### 插入位置（daily.ts）

```
filterContent(topicIds过滤 + excludeRules)
    ↓
collectCandidates(Content → ReportCandidate[])
    ↓
[NEW] classifyProductivityDistance()     ← 分类：近/中/远
    ↓
[NEW] classifyFreshness()               ← 分类：热点/趋势/经典
    ↓
[NEW] filterByQuadrant()                ← 左下角噪音过滤
    ↓
scoreCandidates(多阶段评分)
    ↓
[MOD] applyProductivityBonus()           ← 生产力距离 → 评分加成
    ↓
trimTopN(maxItems)
    ↓
[REMOVE] aiFilter - 象限过滤已足够，无需额外 AI 筛选
[REMOVE] topicClustering - 使用预设 Topic 替代 AI 聚类
    ↓
generateTopicSummaries()               ← AI 摘要（按预设 Topic 分组，不再聚类）

#### generateTopicSummaries 变更说明

旧逻辑（AI 聚类）：
- AI 先将内容聚类成 3-8 个 topics
- 再对每个 cluster 生成摘要

新逻辑（预设 Topic）：
- `filterContent` 阶段已按 `topicIds`（预设 Topic ID 列表）过滤
- 内容通过 `Content.topicIds` 直接知道自己属于哪个预设 Topic
- 生成摘要时，按**预设 Topic** 分组遍历
- 每个有内容的预设 Topic → 一个 DigestTopic
- 不再需要 AI 聚类，DigestTopic 直接对应 Topic 表中的 Topic

```typescript
// 新逻辑示意
for (const topicId of config.topicIds) {
  const topicCandidates = candidates.filter(c => c.topicIds.includes(topicId))
  if (topicCandidates.length === 0) continue  // 跳过无内容的 Topic

  const summary = await aiSummarize(topicCandidates)  // 只生成摘要，不聚类
  results.push({ topicId, summary, contentIds: topicCandidates.map(c => c.id) })
}
```
    ↓
[NEW] logDistribution()                ← 输出分布统计
    ↓
persistResults(DailyOverview + DigestTopic[])
```

## 分类函数设计

### classifyProductivityDistance

```typescript
interface CandidateWithDistance {
  candidate: ReportCandidate
  distance: "近" | "中" | "远"
  distanceSignals: string[]  // 用于日志：哪些信号判定为"远"
}

function classifyProductivityDistance(
  candidates: ReportCandidate[]
): CandidateWithDistance[]

// 判断逻辑（综合加权）：
// - 来源类型：HN/Reddit 热帖 → 中/远（行业讨论）；官方博客/论文 → 近
// - 关键词：含"融资/并购/高管/战略" → 远（+2分）
// - 关键词：含"开发/教程/实战/代码" → 近（+1分）
// - topicId 关联：用户在 pack 中配置的 topic 默认"近"
```

### classifyFreshness

```typescript
interface CandidateWithFreshness {
  candidate: ReportCandidate
  freshness: "热点" | "趋势" | "经典"
  freshnessSignals: string[]  // 用于日志：哪些信号判定
}

function classifyFreshness(
  candidates: ReportCandidate[]
): CandidateWithFreshness[]

// 判断逻辑（综合加权）：
// - 来源类型：HN/Reddit → 偏短；官方文档/博客 → 偏长
// - 内容类型：news/discussion → 短；tutorial/documentation → 长
// - 标题关键词：含"发布/更新/紧急/融资" → 热点（+2分）
// - 标题关键词：含"教程/指南/原理/分析/解读" → 经典（+2分）
// - 发布时间：< 48h 且来源偏短 → 热点
// - 正文字数：> 2000 字 → 偏经典（+1分）
```

### filterByQuadrant

```typescript
function filterByQuadrant(
  candidates: (CandidateWithDistance & CandidateWithFreshness)[]
): CandidateWithDistance[]

// 过滤规则：
// - "远 + 热点" → 丢弃（左下角噪音）
// - 其他象限 → 保留
```

## 评分变更：applyProductivityBonus

在 `scoreCandidates()` 的 mergeStage 之后，新增加权步骤：

```typescript
function applyProductivityBonus(
  scored: ScoredCandidate[],
  distances: Map<string, "近" | "中" | "远">
): ScoredCandidate[]

// 加成规则：
// - "近"：finalScore * 1.3（+30%）
// - "中"：finalScore * 1.0（不变）
// - "远"：finalScore * 0.8（-20%，但不丢弃）
```

## 日志输出

### logDistribution

每天日报生成后，输出分布统计：

```typescript
function logDistribution(
  candidates: CandidateWithDistance & CandidateWithFreshness,
  finalTopics: DigestTopic[]
): void

// 输出示例：
// [daily-report] 分布统计:
//   象限分布: {噪音: 12, 地图感: 8, 尝试: 23, 深度: 15}
//   保鲜期:  {热点: 18, 趋势: 21, 经典: 19}
//   生产力:  {近: 38, 中: 20, 远: 10}
//   输入候选: 68 → 过滤后: 58 → 最终topics: 7
```

## 可配置项

以下值通过 `DailyReportConfig` 配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `productivityBonusNear` | 1.3 | "近"象限评分加成倍数 |
| `productivityBonusMid` | 1.0 | "中"象限评分加成倍数 |
| `productivityBonusFar` | 0.8 | "远"象限评分加成倍数 |
| `enableQuadrantFilter` | true | 是否启用象限过滤 |
| `distances` | 见下文 | 关键词 → 距离映射 |

### 默认关键词映射

```typescript
const PRODUCTIVITY_KEYWORDS = {
  近: ["开发", "教程", "实战", "代码", "编程", "架构", "API", "SDK"],
  远: ["融资", "并购", "高管", "战略", "宫斗", "估值", "IPO", "财报"],
}

const FRESHNESS_KEYWORDS = {
  热点: ["发布", "更新", "紧急", "融资", "收购", "发布日", "上线"],
  经典: ["教程", "指南", "原理", "分析", "解读", "详解", "深入", "完全指南"],
}
```

## 影响范围

| 文件 | 变更类型 |
|------|----------|
| `src/reports/daily.ts` | 新增 classifyProductivityDistance, classifyFreshness, filterByQuadrant, logDistribution；移除 aiFilter、topicClustering 调用 |
| `src/ai/prompts-reports.ts` | 移除 buildTopicClusteringPrompt、parseTopicClusteringResult；generateTopicSummaries 改为按预设 Topic 遍历 |
| `src/reports/scoring/merge-stage.ts` | 新增 applyProductivityBonus |
| `src/types/index.ts` | ReportCandidate 新增 topicIds?, freshnessTier?, productivityDistance? |
| `src/reports/report-candidate.ts` | contentToReportCandidate 新增 topicIds 传递 |

## 验收标准

- [ ] `pnpm check` 通过
- [ ] `pnpm build` 通过
- [ ] 日报生成成功，分布日志正常输出
- [ ] 远+热点内容被正确过滤（可通过日志验证）
- [ ] 近+经典内容排名靠前（可通过 topic 顺序验证）
