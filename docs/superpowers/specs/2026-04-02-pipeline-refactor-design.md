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
3 rawItemToArticle（带 topicIds，仅作初筛标签）
  ↓
4 normalize（纯转换，engagementScore 计算）
  ↓
5 topic 过滤（include/exclude 初筛，输出单一 article 池）
  ↓
6 评分排序（sourceWeightScore×0.4 + engagementScore×0.15）
  ↓
7 全局去重（URL 精确 + 语义 LCS，winner 取高分）
  ↓
8 象限划分（AI classify，每篇一次）
  ↓
9 MD 生成（AI 象限内容生成，使用 reports.yaml 中的 prompt）
  ↓
10 JSON 不落盘
```

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

**Adapter 维度并发：**
- 不同 type 的 adapter（rss / json-feed / website / x / techurls / zeli / newsnow / clawfeed / attentionvc）并行执行

**Source 维度并发：**
- 同 type 下多个 source 并行抓取

**实现方式：**
- 复用现有 `processWithConcurrency` 工具函数
- `collect.ts` 改造：接收 `adapterConcurrency` 和 `sourceConcurrency` 两个参数
- 各 adapter 接收 `timeWindow` 参数，自行按时间窗口过滤（替代原有的硬编码 24h 逻辑）

**数据关联：**
- collect 后的 RawItem 需带上 source 对应的 `topicIds`，用于后续初筛

### 步骤 3：rawItemToArticle 转换

- 格式转换：`RawItem → Article`
- 带上 `topicIds`（从 source 配置继承，仅作初筛标签）
- 不做过滤，不做去重

### 步骤 4：normalize

- 纯格式转换：`Article → NormalizedItem`
- URL 标准化（移除 tracking 参数）
- 正文归一化（去 HTML、空白字符处理）
- `engagementScore` 计算：从 metadata 解析 X/Twitter 互动数据，计算公式：

```
engagementScore = min(100, floor((likeCount * 1 + comments * 2 + reactions * 3) / 10))
```

其他 source 类型 engagementScore 为 0。

- Topic 仅作为初筛标签存储，不参与 normalize 逻辑

### 步骤 5：topic 过滤（初筛）

**设计说明：**
- topic 是人工配置的初筛标签，代表"对这个 source 的内容大致预期"
- 不参与最终日报呈现，仅作为初始过滤层

**过滤逻辑：**
1. 根据 article 的 `topicIds` 找到对应的 topic 配置
2. 按 topic 的 `includeRules`（必须包含关键词）/ `excludeRules`（必须排除关键词）过滤
3. 过滤后输出单一 article 池，topic 标签不再保留

**配置变更：**
- `sources.yaml` 新增 `priority` 字段（每 source 配置一个数值，用于后续评分）
- `topics.yaml` 无需变更

### 步骤 6：评分排序

**评分公式：**

```
finalScore = sourceWeightScore × 0.4 + engagementScore × 0.15
```

**字段说明：**

| 字段 | 来源 |
|------|------|
| `sourceWeightScore` | `sources.yaml` 中配置的 `priority` 字段，归一化到 0-1 |
| `engagementScore` | normalize 阶段计算的 X/Twitter 互动分，其他 source 为 0 |

**移除的维度：**
- `freshnessScore`：所有数据在 timeWindow 内，无区分度，移除
- `contentQualityAi`：AI 增强已移除，移除
- `community_post` 扣减项：移除

### 步骤 7：全局去重

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

### 步骤 8：象限划分

- 对每篇文章调用 AI `classifyArticleQuadrant`
- 输出：尝试 / 深度 / 地图感 三象限之一
- 失败重试 3 次，仍失败默认归入"地图感"
- 复用现有 `generateDailyReport` 中的象限分类逻辑

### 步骤 9：MD 生成

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
- 复用现有 `generateDailyReport` 中的 Markdown 输出逻辑
- Prompt 模板从 `reports.yaml` 读取，不再硬编码

### 步骤 10：JSON 不落盘

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
    topics: [ai-news]
    priority: 0.8   # 新增字段，0.0-1.0，越高越优先
```

### config/reports.yaml

```yaml
daily:
  maxItems: 50
  minScore: 0
  quadrantBonus:
    near: 1.3
    mid: 1.0
    far: 0.8
  # 新增三个象限的 prompt
  quadrantPrompts:
    map: |
      （地图感 prompt：生成核心要点 123…）
    try: |
      （尝试 prompt：生成总结概括，每条含尝试理由和预计时间）
    deep: |
      （深度 prompt：生成"为什么值得深入阅读"）

# 移除 weekly 配置
```

### config/topics.yaml

无需变更（topic 仅作初筛，不参与最终呈现）

---

## 代码变更汇总

### 需新建/改造的文件

| 文件 | 变更说明 |
|------|---------|
| `src/cli/run.ts` | 改造为完整 pipeline 入口，新增并发参数解析，移除 JsonArticleStore |
| `src/pipeline/collect.ts` | 支持两级并发控制，adapter 接收 timeWindow 参数 |
| `src/pipeline/normalize.ts` | 保持不变，作为纯转换层 |
| `src/pipeline/dedupe-exact.ts` | 保持不变 |
| `src/pipeline/dedupe-near.ts` | 保持不变 |
| `src/pipeline/rank.ts` | 简化为 `finalScore = sourceWeightScore×0.4 + engagementScore×0.15` |
| `src/pipeline/enrich.ts` | 不再调用（AI 增强已移除） |
| `src/reports/daily.ts` | 读取 reports.yaml 中的象限 prompt，移除 weekly 逻辑 |
| `src/archive/json-store.ts` | 移除 |
| `src/archive/index.ts` | 移除 ArticleStore 接口中 JsonArticleStore 相关内容 |

### 需删除的文件

- `src/archive/json-store.ts`

### 需改造的配置加载

- `src/cli/run.ts`：加载 `sources.yaml` 中的 `priority` 字段，传入 pipeline
- `src/reports/daily.ts`：从 `reports.yaml` 读取三个象限的 prompt

---

## 测试要点

1. **并发收集验证**：不同 adapter 和 source 并发执行，结果与串行一致
2. **timeWindow 过滤**：不同时间窗口参数下，过滤结果正确
3. **评分公式**：priority 和 engagementScore 加权正确
4. **去重正确性**：exact dedupe 和 near dedupe 的 winner 选择符合预期
5. **象限分类**：三象限分类结果符合各象限定义
6. **MD 输出**：三个象限的呈现格式符合设计

---

## 实施顺序建议

1. CLI 参数解析 + 并发收集改造
2. pipeline 整合（normalize → 评分 → 去重）
3. reports.yaml prompt 配置 + 象限 MD 生成
4. 移除 JsonArticleStore 及相关代码
5. 端到端测试验证
