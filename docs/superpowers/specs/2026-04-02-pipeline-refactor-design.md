# Pipeline 重构设计文档

## 背景

当前 `cli/run.ts` 的数据流为：

```
collect → rawItemToArticle → JsonArticleStore.save → generateDailyReport
```

存在以下问题：
1. 数据收集为串行执行，无并发优化
2. `normalize`、`dedupe-exact`、`dedupe-near`、`rank`、`enrich` 等 pipeline 模块已实现但未被调用
3. JSON 持久化在收集后即执行，后续 pipeline 逻辑缺失
4. `freshnessScore`、`contentQualityAi` 等评分维度未实际使用或为占位符
5. `sources.yaml` 中未配置 `priority` 字段

本次重构目标：
- 实现真正的 pipeline 整合
- 支持并发收集
- 简化评分体系
- 移除 JSON 落盘

---

## 目标架构

```
1 CLI（--timeWindow 必填，--adapter-concurrency/--source-concurrency 可选）
  ↓
2 并发收集（adapter × source 两级并发，adapter 内部按 timeWindow 过滤）
  ↓
3 normalize（RawItem → normalizedArticle，engagementScore 计算）
  ↓
4 topic 过滤（include/exclude 初筛，输出单一 article 池）
  ↓
5 评分排序（sourceWeightScore×0.4 + engagementScore×0.15）
  ↓
6 全局去重（URL 精确 + 语义 LCS，winner 取高分）
  ↓
7 象限划分（AI classify，每篇一次）
  ↓
8 MD 生成（AI 象限内容生成，使用 reports.yaml 中的 prompt）
  ↓
9 JSON 不落盘
```

**命名简化说明：**
- Fetch adapter 输出统称为 `RawItem`
- `normalize()` 输出称为 `normalizedArticle`（替代原有的 `Article → NormalizedItem` 两级命名）
- 后续流程中统一使用 `normalizedArticle`，不再有中间类型

---

## 各步骤详细说明

### 步骤 1：CLI 入口

**新增参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--timeWindow <duration>` | 是 | 时间窗口，格式 `24h` / `7d` / `30d` |
| `--adapter-concurrency <n>` | 否 | 不同 type adapter 间并发数，默认 4 |
| `--source-concurrency <n>` | 否 | 同 type 下不同 source 间并发数，默认 4 |

**设计决策：**
- `timeWindow` 为必填参数，无默认值，强制调用方明确时间范围
- 两个并发参数分别控制不同维度的并发度，支持独立调优

### 步骤 2：并发收集

**现有实现问题：**
- 当前 `collect.ts` 的 `CollectDependencies` 只有单一 `concurrency` 参数
- 当前 `AdapterFn` 类型为 `(source: Source) => Promise<RawItem[]>`，不接收 `timeWindow` 参数
- 当前 RSS adapter 内部硬编码 24h 窗口逻辑在 `parseRssItems` 中

**改造方案：**

Adapter 函数签名变更为：
```typescript
type AdapterFn = (source: Source, options: { timeWindow: number }) => Promise<RawItem[]>
```
其中 `timeWindow` 单位为毫秒，由 CLI 传入。

**两级并发实现：**

1. **Adapter 维度并发**：按 source type 分组，同组内用 `sourceConcurrency` 控制并发度，组间并行度由总任务数自动决定。例如有 3 种 type，每种 10 个 source，adapterConcurrency=3 表示最多同时运行 3 个不同 type 的 adapter。

2. **Source 维度并发**：同 type 下多个 source 使用 `processWithConcurrency` 并发抓取，`sourceConcurrency` 控制每个 type 内的并发数。

**改造清单：**
- `src/types/index.ts`：将 `AdapterFn` 改为接收 `{ timeWindow: number }` 选项
- `src/pipeline/collect.ts`：改造为两级并发模型
- `src/adapters/rss.ts`：移除硬编码 24h，改为使用传入的 `timeWindow` 参数
- `src/adapters/json-feed.ts`、`src/adapters/website.ts`、`src/adapters/x-bird.ts`、`src/adapters/techurls.ts`、`src/adapters/zeli.ts`、`src/adapters/newsnow.ts`、`src/adapters/clawfeed.ts`、`src/adapters/attentionvc.ts`：统一改造 adapter 函数签名
- `src/adapters/build-adapters.ts`：适配新签名

**数据关联：**
- collect 后的 RawItem 需带上 source 对应的 `topicIds`（从 `Source` 对象的 `topics` 字段继承）
- `Source` 类型已有 `topics: string[]` 字段，`loadSourcesConfig()` 需读取 YAML 中的 `topics` 字段并传入

### 步骤 3：normalize

- 纯格式转换：`RawItem → normalizedArticle`
- URL 标准化（移除 tracking 参数）
- 正文归一化（去 HTML、空白字符处理）

**engagementScore 计算：**
```
// engagementScore：X/Twitter 互动分，用于后续评分排序
// 其他 source 类型 engagementScore 为 0
// 若后续需要对特定类别进行评分，在此归一化
engagementScore = min(100, floor((score * 1 + comments * 2 + reactions * 3) / 10))
```
其中 `score`、`comments`、`reactions` 字段来自 `RawItemMetadata`（对应 metadataJson 中的字段）。其他 source 类型 engagementScore 为 0。

- Topic 仅作为初筛标签存储，不参与 normalize 逻辑

### 步骤 4：topic 过滤（初筛）

**设计说明：**
- topic 是人工配置的初筛标签，代表"对这个 source 的内容大致预期"
- 不参与最终日报呈现，仅作为初始过滤层

**过滤逻辑：**
1. 根据 article 的 `topicIds` 找到对应的 topic 配置
2. 按 topic 的 `includeRules`（必须包含关键词）/ `excludeRules`（必须排除关键词）过滤
3. 过滤后输出单一 article 池，topic 标签不再保留

**数据流对齐：**
- `RawItem.topicIds` → `normalizedArticle.topicIds` → `FilterableItem.topicIds`
- topic 过滤可复用现有 `filter-by-topic.ts`，输入为 `normalizedArticle[]`，输出过滤后的 `normalizedArticle[]`

**配置变更：**
- `sources.yaml` 新增 `priority` 字段（每 source 配置一个数值，用于后续评分）
- `loadSourcesConfig()` 需读取 YAML 中的 `priority` 字段，映射到 `Source.priority`
- `topics.yaml` 无需变更

**优先级字段映射：**
- `InlineSource` 类型已有 `priority?: number` 字段，无需修改类型定义
- 只需在 `loadSourcesConfig()` 中添加读取逻辑：
  ```typescript
  return raw.sources
    .filter(s => s.enabled !== false)
    .map(s => ({
      ...
      priority: s.priority ?? 0.5,  // 默认 0.5
    }))
  ```

### 步骤 5：评分排序

**评分公式：**

```
finalScore = sourceWeightScore × 0.4 + engagementScore × 0.15
```

**字段说明：**

| 字段 | 来源 |
|------|------|
| `sourceWeightScore` | `sources.yaml` 中配置的 `priority` 字段（已归一化到 0-1） |
| `engagementScore` | normalize 阶段计算的 X/Twitter 互动分（`score * 1 + comments * 2 + reactions * 3`，其他 source 为 0） |

**移除的维度：**
- `freshnessScore`：所有数据在 timeWindow 内，无区分度，移除
- `contentQualityAi`：AI 增强已移除，移除
- `community_post` 扣减项：移除

**rank.ts 改造：**
- 简化 `rankCandidates()` 函数，移除 `freshnessScore`、`contentQualityAi`、`relationshipPenalty` 相关逻辑
- 输入类型简化为只含 `sourceWeightScore` 和 `engagementScore` 的候选对象

### 步骤 6：全局去重

**两步去重：**

**1. URL 精确去重（dedupe-exact）：**
- 按 `normalizedUrl` 分组
- 同 URL 下 winner 选择：高分数优先
- 复用现有 `dedupe-exact.ts`

**2. 语义去重（dedupe-near）：**
- LCS 相似度 ≥ 0.75 的 article 归为一组
- winner 选择：高分数优先
- 复用现有 `dedupe-near.ts`（无需改动 winner 选择逻辑，已支持 priority 参与）

**设计决策：**
- 去重发生在评分之后，确保 winner 是高分数 article
- 去重后输出单一 article 池，不保留 topic 归属

### 步骤 7：象限划分

- 对每篇文章调用 AI `classifyArticleQuadrant`
- 输出：尝试 / 深度 / 地图感 三象限之一
- 失败重试 3 次，仍失败默认归入"地图感"
- 复用现有 `generateDailyReport` 中的象限分类逻辑

### 步骤 8：MD 生成

**三个象限的呈现形式：**

| 象限 | 内容生成 |
|------|---------|
| **地图感** | AI 生成核心要点（123…），下方列出引用文章基本信息（标题 + URL + 来源） |
| **尝试** | AI 生成总结概括（每条含"尝试理由 + 预计时间"），下方列出引用文章基本信息 |
| **深度** | 每篇文章列出基本信息 + "为什么值得深入阅读"，无统一总结 |

**Prompt 配置：**
- 在 `config/reports.yaml` 中新增三个象限各自的 prompt 配置
- 移除现有的 `weekly` 相关配置（只保留 daily 相关）

**复用逻辑：**
- 改造 `generateDailyReport`：prompt 模板从 `reports.yaml` 读取，不再硬编码
- 移除 `generateDailyReport` 中 `quadrantBonus` 加成逻辑（三象限不再有加成）
- 移除 `weekly` 相关代码

**Prompt 加载逻辑：**
- `config/reports.yaml` 新增 `quadrantPrompts.map`、`quadrantPrompts.try`、`quadrantPrompts.deep` 三个字段
- `daily.ts` 中新增 `loadQuadrantPrompts()` 函数，从 YAML 读取三个 prompt
- 象限分类（`classifyArticleQuadrant`）使用现有 `QUADRANT_PROMPT`
- 象限内容生成使用 `reports.yaml` 中对应的 prompt

### 步骤 9：JSON 不落盘

- 移除 `JsonArticleStore` 及相关读写逻辑
- 全流程在内存中完成，无持久化中间状态

---

## 配置变更汇总

### config/sources.yaml

```yaml
sources:
  - type: rss
    id: example-source
    name: Example
    url: https://example.com/feed
    enabled: true
    topics: [ai-news]     # 用于初筛过滤
    priority: 0.8          # 新增字段，0.0-1.0，越高越优先（用于评分和 dedupe winner 选择）
```

### config/reports.yaml

```yaml
daily:
  maxItems: 50
  minScore: 0
  # 新增三个象限的 prompt（quadrantBonus 字段可移除，已无评分加成逻辑）
  quadrantPrompts:
    map: |
      你是一个信息整理助手。用户会提供一个话题下的多篇文章列表，你需要生成该话题的核心要点，用清晰的123...格式列出。
      每条要点应该简洁有力，反映该话题的主要趋势或发现。
    try: |
      你是一个信息整理助手。用户会提供一个话题下的多篇文章列表，你需要生成该话题的总结概括，用清晰的123...格式列出。
      每条需要说明：1)值得尝试的原因 2)预计投入时间。
    deep: |
      你是一个信息整理助手。对于每篇文章，说明"为什么值得深入阅读"，包括：文章解决了什么问题、提供了什么独特视角、适合什么程度的读者。

# 移除 weekly 配置
# 移除 quadrantBonus 配置（简化后不再需要）
```

### config/topics.yaml

无需变更（topic 仅作初筛，不参与最终呈现）

---

## 代码变更汇总

### 需新建/改造的文件

| 文件 | 变更说明 |
|------|---------|
| `src/types/index.ts` | `AdapterFn` 类型变更为 `(source: Source, options: { timeWindow: number }) => Promise<RawItem[]>` |
| `src/adapters/rss.ts` | 移除硬编码 24h，改为使用传入的 `timeWindow` 参数 |
| `src/adapters/json-feed.ts` | 同上 |
| `src/adapters/website.ts` | 同上 |
| `src/adapters/x-bird.ts` | 同上 |
| `src/adapters/techurls.ts` | 同上 |
| `src/adapters/zeli.ts` | 同上 |
| `src/adapters/newsnow.ts` | 同上 |
| `src/adapters/clawfeed.ts` | 同上 |
| `src/adapters/attentionvc.ts` | 同上 |
| `src/adapters/build-adapters.ts` | 适配新 AdapterFn 签名 |
| `src/pipeline/collect.ts` | 改造为两级并发模型（adapterConcurrency + sourceConcurrency） |
| `src/archive/index.ts` | `Article` 类型重命名为 `normalizedArticle` 并添加 `topicIds` 字段；移除 `JsonArticleStore` 导出 |
| `src/cli/run.ts` | 改造为完整 pipeline 入口，新增 CLI 参数解析（--timeWindow/--adapter-concurrency/--source-concurrency），移除 JsonArticleStore，加载 `sources.yaml` 中的 `priority` 和 `topics` 字段 |
| `src/pipeline/normalize.ts` | 改造为 `RawItem → normalizedArticle`，engagementScore 计算，topicIds 透传 |
| `src/pipeline/filter-by-topic.ts` | 复用，输入输出类型已对齐 |
| `src/pipeline/dedupe-exact.ts` | 保持不变 |
| `src/pipeline/dedupe-near.ts` | 保持不变 |
| `src/pipeline/rank.ts` | 简化为 `finalScore = sourceWeightScore×0.4 + engagementScore×0.15`，移除 freshnessScore/contentQualityAi/relationshipPenalty |
| `src/pipeline/enrich.ts` | 不再调用（AI 增强已移除），可保留文件但不在 pipeline 中使用 |
| `src/reports/daily.ts` | 新增 `loadQuadrantPrompts()` 从 reports.yaml 读取象限 prompt，移除 weekly 逻辑和 quadrantBonus 加成 |
| `src/ai/prompts-reports.ts` | `QUADRANT_PROMPT` 保留，移除 weekly 相关 prompt |
| `src/archive/json-store.ts` | 删除 |
| `src/archive/index.ts` | 移除 `JsonArticleStore` 导出和 `ArticleStore` 接口中相关定义 |

### 需删除的文件

- `src/archive/json-store.ts`

### 需改造的配置加载

- `src/cli/run.ts`：`loadSourcesConfig()` 读取 `sources.yaml` 中的 `priority` 和 `topics` 字段

---

## 端到端测试命令

```bash
bun run src/cli/run.ts --timeWindow 1h --adapter-concurrency 4 --source-concurrency 6
```

**参数说明：**
- `--timeWindow 1h`：使用 1 小时窗口，避免测试运行时间过长
- `--adapter-concurrency 4`：4 个不同 type 的 adapter 并发运行
- `--source-concurrency 6`：每个 type 下最多 6 个 source 并发抓取

1. **并发收集验证**：不同 adapter 和 source 并发执行，结果与串行一致
2. **timeWindow 过滤**：不同时间窗口参数下，过滤结果正确；适配器签名变更后现有测试仍可通过
3. **topicIds 传递**：`Article` 新增 `topicIds` 字段后，从 collect 到 topic 过滤的数据流正确
4. **priority 加载**：`sources.yaml` 中 `priority` 字段能正确读取和映射
5. **评分公式**：priority 和 engagementScore 加权正确，rank.ts 简化后公式与测试对齐
6. **去重正确性**：exact dedupe 和 near dedupe 的 winner 选择符合预期（高分数优先）
7. **象限分类**：三象限分类结果符合各象限定义；AI 失败时默认归入"地图感"
8. **MD 输出**：三个象限的呈现格式符合设计，prompt 从 reports.yaml 正确读取
9. **边界情况**：空数据、全过滤掉、AI 失败等场景处理正确
10. **JSON 不落盘**：运行全程无磁盘 IO（除最终 MD 输出）

---

## 实施顺序建议

1. **基础设施改造**：CLI 参数解析（--timeWindow/--adapter-concurrency/--source-concurrency）+ 类型定义变更（AdapterFn 新签名 + normalize 输出类型）
2. **Adapter 改造**：统一 adapter 函数签名 + timeWindow 传入逻辑
3. **并发收集**：`collect.ts` 两级并发模型实现
4. **normalize 改造**：`RawItem → normalizedArticle`，engagementScore 计算，topicIds 透传
5. **pipeline 整合**：topic 过滤 → 评分 → 去重
6. **reports.yaml 配置**：添加 `quadrantPrompts`，移除 weekly 和 quadrantBonus
7. **日报生成改造**：`daily.ts` prompt 加载逻辑 + 移除不需要的逻辑
8. **清理**：移除 JsonArticleStore 及相关代码
9. **端到端测试验证**

---

## 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| `timeWindow` 内无任何数据 | 直接退出，输出提示信息，不生成日报 |
| 所有 article 被 topic 过滤淘汰 | 直接退出，输出提示信息，不生成日报 |
| 去重后 article 数量为 0 | 直接退出，输出提示信息，不生成日报 |
| AI 象限分类失败（重试3次） | 默认归入"地图感"象限 |
| source 的 `priority` 未配置 | 默认 0.5 |
| `sources.yaml` 中引用了不存在的 topic | 忽略该 topic 配置，article 仍参与后续流程 |
