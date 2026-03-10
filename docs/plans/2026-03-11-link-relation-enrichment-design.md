# Link Relation Enrichment 设计

日期：2026-03-11
状态：已确认

## 背景

当前仓库已经具备：

- 统一 `run --view <view>` 查询入口
- X family `bird CLI` 接入
- `normalize -> dedupe -> rank -> cluster -> view` 主链路
- `RawItem.metadataJson` 中的 `canonicalHints`
- 有界 AI 打分钩子

但当前 Phase 4 仍缺少一个足够小、可验证、不会引入额外网络波动的首个切片。

现状问题是：

- X / community source 已经能提供 `expandedUrl`、外链 URL 等 hint
- pipeline 只把这些 hint 用在 canonical URL 解析
- view 层无法稳定表达“原帖、讨论页、转述、外链原文”的关系
- ranking 虽然对 `community_post` 有惩罚，但关系语义仍然过于隐式

这导致结果质量提升空间已经存在，但还没有形成明确的 enrichment 层。

## 目标

实现一个确定性的、无额外网络请求的 link relation enrichment 切片，用于：

- 正式消费已有 `canonicalHints`
- 把条目和 canonical 原文之间的关系变成显式字段
- 让 ranking 与 view 可以基于这些关系做更清楚的展示
- 为后续正文抓取、t.co 展开、外链提取预留稳定边界

## 非目标

本轮不做：

- 外链正文抓取
- t.co 在线展开
- 新的 adapter 接入
- embeddings / vector similarity
- 重写现有 render 或 query 模型

## 方案比较

### 方案 A：确定性 relation enrichment

做法：

- 在 pipeline 中新增一个轻量 enrichment 步骤
- 只消费已有 metadata / canonical hints
- 产出显式关系字段给 ranking / view 使用

优点：

- 改动小
- 完全确定性
- 不引入新网络失败模式
- 易于用单元测试和 mock E2E 覆盖

缺点：

- 只提升关系表达和结果质量，不增加正文信息量

### 方案 B：直接做外链正文提取

做法：

- 新增 fetch 型 enrichment worker
- 在候选缩减后抓取正文并供后续排序/摘要使用

优点：

- 用户感知最强

缺点：

- 网络行为复杂度高
- 测试与失败模式显著增加
- 不适合和文档收口绑在同一轮

### 方案 C：只调 ranking，不引入 enrichment 层

做法：

- 只修改 rank / cluster 规则

优点：

- 实现最小

缺点：

- 关系仍然隐式
- view 层收益有限

## 决策

采用方案 A。

理由：

- 它与当前代码最连续
- 它能把已有 `canonicalHints` 从“隐式 URL 修正”提升为“显式关系语义”
- 它为后续更重的 enrichment 提供稳定契约

## 设计

## 1. 新增 relation 语义

在 normalization 之后补一个轻量关系判定层，面向每个规范化条目生成：

- `linkedCanonicalUrl`
- `relationshipToCanonical`
- `isDiscussionSource`

关系值先收敛为最小集合：

- `original`
- `discussion`
- `share`

语义：

- `original`：当前条目 URL 与 canonical 原文一致，或没有额外外链关系
- `discussion`：社区讨论页或站内帖子指向外部原文
- `share`：X 等分享型内容指向外部原文，但本身不是原文页

第一版不引入更多关系值，避免过早抽象。

## 2. 数据边界

不修改 `RawItem` 采集契约。

关系判定依赖现有输入：

- `NormalizedItem.canonicalUrl`
- `NormalizedItem.url`
- `NormalizedItem.contentType`
- `RawItem.metadataJson` 中的 `canonicalHints`

为避免把 source-specific 逻辑回塞到 adapter，relation enrichment 只在 pipeline 内运行。

## 3. ranking 变化

ranking 保持现有混合分数结构，只增加一个有界关系修正：

- `discussion`：继续保持负向权重
- `share`：轻微负向权重
- `original`：不惩罚

目标不是“绝不展示讨论源”，而是让原文在同等条件下更稳定地排在前面。

## 4. view 变化

第一版只调整最需要关系语义的视图：

- `x-longform-hot`
- `x-bookmarks-analysis`
- `x-likes-analysis`

行为：

- 当存在 `linkedCanonicalUrl` 时，优先展示原文链接
- 仍保留 post 本身的标题或来源语义
- 在 Markdown 中显式标注这是 linked article / discussion source

`item-list` 与 `daily-brief` 本轮不强制改版，只要不破坏既有行为。

## 5. 测试策略

采用 TDD，最小覆盖链路：

- `src/pipeline/normalize.test.ts`
- `src/pipeline/rank.test.ts`
- `src/views/x-longform-hot.test.ts`
- `src/views/x-analysis.test.ts`
- 必要时补 `src/e2e/mock-sources.test.ts`

断言重点：

- X post 指向 article 时生成 `share` 关系
- reddit / hn 指向 article 时生成 `discussion` 关系
- ranking 对 `discussion` / `share` 的惩罚有界
- X views 优先展示 linked article

## 6. 文档对齐

同时更新活跃文档，消除当前漂移：

- `docs/plans/2026-03-10-source-type-roadmap-design.md`
- `docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md`
- `README.md`
- `docs/testing.md`

要点：

- 不再保留 reference-only pack 语义
- YAML 只保留 runnable source / pack
- 非可运行示例仅保留为 source 级 `config.placeholderMode: schema`
- Phase 4 首个切片为确定性 relation enrichment，而不是直接正文抓取

## 成功标准

- 活跃文档与当前代码语义一致
- 新 relation 字段可被 ranking 与 X views 使用
- 现有测试保持通过，并新增 relation 相关测试
- 不引入新的网络依赖或不稳定 CI 行为
