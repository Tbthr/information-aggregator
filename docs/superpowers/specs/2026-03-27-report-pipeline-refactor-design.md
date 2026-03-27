# Report Pipeline Refactor Design

## 背景

当前项目的日报链路混合了多种职责：

- 采集阶段与日报阶段对过滤和筛选都有参与
- `Item` 表同时承担候选池、增强结果和部分运行时筛选语义
- `DailyReport` 直接消费 `Item` / `Tweet` 原始持久化模型，跨类型差异在后续流程中暴露

本次设计目标是将链路拆清：

- 采集层只负责产出干净的候选池
- 不同数据类型分别采集、分别持久化
- 日报层统一读取多种持久化对象，映射为统一候选模型
- 评分阶段以运行时 pipeline 的形式处理，不回写原表

本设计只覆盖主流程与数据模型边界，不包含具体实现方案和迁移计划。

## 目标

- 统一文章主链的数据入口和时间语义
- 将 pack 级主题过滤前移到采集主链
- 简化 `normalize`，删除 canonical 相关逻辑
- 将 `Item` 收缩为日报文章候选池，而非聚合仓库
- 让日报支持多 pack 输入，并与 `Tweet` 等其他数据类型统一汇总
- 用 `ReportCandidate + score adapter` 替代直接对持久化对象做混合评分

## 非目标

- 本轮不改 Twitter/X 的独立采集链路
- 本轮不纳入 GitHub Trending，后续单独适配
- 本轮不设计跨 pack 的单条内容复用
- 本轮不回写运行时评分到 `Item` / `Tweet`
- 本轮不包含具体 schema migration 和代码拆分计划

## 总体架构

系统拆为三层：

1. 类型内采集层
2. 日报候选映射层
3. 日报决策层

### 类型内采集层

每种数据类型有自己的采集与持久化链路：

- `Item` 主链：RSS / JSON Feed 等文章类来源
- `Tweet` 主链：保持独立
- 未来其他类型：继续独立处理

该层负责：

- 采集
- 时间解析与统一窗口过滤
- 类型内 normalize
- 类型内主题过滤
- 类型内去重
- 落到对应持久化表

### 日报候选映射层

日报运行时不直接消费 `Item` / `Tweet` 原始模型，而是先映射成统一的 `ReportCandidate`。

### 日报决策层

日报层负责：

- 读取多个 pack 的候选
- 统一映射为 `ReportCandidate`
- 运行分段评分 pipeline
- 应用历史重复惩罚
- 取 top N 进入 AI
- 做 AI filter / clustering / summary
- 持久化日报结果

## Item 主链

### 输入配置

配置来源于 Supabase，而不是 `config/*.yaml`。

每次任务开始时读取：

- pack
- source
- pack 级过滤规则

pack 级过滤规则作为本次任务快照进入 pipeline，不在后续阶段反复查库。

### 统一时间基准

每次 `runCollectJob()` 开始时生成统一的 `jobStartedAt`，并传给所有 adapter。

该时间用于：

- 解析相对时间，如“2小时前”
- 统一 24 小时时间窗口判断基准

后端服务统一使用 UTC：

- Supabase / Prisma 使用 `timestamptz`
- adapter 必须将来源时间统一换算为 UTC
- 采集过滤、持久化、评分、日报生成全部以 UTC 时间点为准
- 只有 API 返回给前端展示时，才转换为北京时间等展示时区
- 本设计中的日报时间语义为滚动 24 小时，而不是北京时间自然日

### Adapter 职责

adapter 输出的是 `RawItem`，不是落库对象。

adapter 必须完成：

- 解析来源时间字段
- 将时间统一到 UTC 语义
- 支持绝对时间与相对时间格式
- 纯日期补成 `23:59:59`
- 在 adapter 内执行统一 24h 窗口过滤
- 对无法解析时间或超出窗口的内容打印 warning

warning 至少包含：

- `sourceId`
- source type
- 标题或 URL
- 原始时间值
- 丢弃原因

日期补全规则：

- 优先按来源时间字符串自带时区解析
- 如果来源值只有日期且无时区信息，则按 UTC 当日 `23:59:59` 处理

### RawItem

`RawItem` 是采集最小标准化结果，仅用于进入 normalize。

字段：

- `id`
- `sourceId`
- `title`
- `url`
- `fetchedAt`
- `publishedAt`
- `metadataJson`
- `filterContext`

约束：

- `publishedAt` 必填
- 其他来源差异信息不放顶层，统一放入 `metadataJson`
- `fetchedAt` 表示 adapter 产出该条 `RawItem` 时的抓取时间，并原样映射到 `Item.fetchedAt`

### metadataJson

`metadataJson` 统一承载来源扩展信息。

时间相关字段：

- `rawPublishedAt`
- `timeSourceField`
- `timeParseNote`

内容相关字段：

- `summary`
- `content`
- `authorName`

规则：

- `summary` 优先取来源自带摘要
- 若无摘要，则从 `content` 截一段作为 fallback

### filterContext

`filterContext` 是运行时上下文，不属于来源 metadata。

字段：

- `packId`
- `mustInclude`
- `exclude`

规则：

- 规则挂在 pack 级
- `mustInclude` / `exclude` 在进入 pipeline 前先转小写
- 同一轮任务中视为配置快照

## Normalize

### 目标

`normalize` 只负责将文章类 `RawItem` 转成统一内部候选，不承担 canonical 推断、跨类型兼容或评分职责。

### 删除的旧职责

从现有 normalize 中删除：

- `rawItemId`
- `canonicalUrl`
- `linkedCanonicalUrl`
- `relationshipToCanonical`
- `isDiscussionSource`
- `normalizedText`
- `exactDedupKey`
- `engagementScore`
- 顶层 `content`

### NormalizedItem

字段：

- `id`
- `sourceId`
- `title`
- `publishedAt`
- `sourceType`
- `contentType`
- `normalizedUrl`
- `normalizedTitle`
- `normalizedSummary`
- `normalizedContent`
- `metadataJson`
- `filterContext`

规则：

- 本轮只处理文章类来源
- `contentType` 当前固定为 `article`
- `normalizedUrl` 用于精确去重与落库

### URL 归一化

`normalizedUrl` 基于现有 URL 归一化逻辑增强实现。

规则：

- 域名小写
- 去掉 `www.`
- 去掉 fragment
- 去掉动态/追踪参数
- 统一路径尾部 `/`
- 作为精确去重和数据库唯一性依据

### 标题归一化

`normalizedTitle` 使用强归一化。

规则：

- 去除 `RT @xxx:`
- 去除尾部站点名，例如 `| SiteName`
- 去标点
- 小写
- 压缩空白

### 摘要归一化

`normalizedSummary` 使用轻归一化。

规则：

- 来源为 `metadataJson.summary`
- 去 HTML
- decode 实体
- 压缩空白
- 小写
- 保留句子结构，不去标点

### 正文归一化

`normalizedContent` 使用轻归一化并截断。

规则：

- 来源为 `metadataJson.content`
- 去 HTML
- decode 实体
- 压缩空白
- 小写
- 截断到 500 字符

## 主题过滤

主题过滤发生在 normalize 之后。

输入字段：

- `normalizedTitle`
- `normalizedSummary`
- `normalizedContent`

规则：

- 先检查 `exclude`
- 任一命中直接丢弃
- 再检查 `mustInclude`
- 配置了 `mustInclude` 时，任一命中即通过
- 未配置 `mustInclude` 时默认通过

匹配语义：

- 当前统一为小写后的子串匹配
- `mustInclude` 内部是 OR 语义
- `exclude` 内部是 OR 语义
- 不引入 token match、布尔表达式或语言特定分词逻辑

过滤规则只使用 `filterContext`，不回查数据库。

## 去重

### Exact Dedupe

精确去重发生在主题过滤之后。

规则：

- key = `normalizedUrl`
- 相同 URL 保留 `publishedAt` 最新的一条

### Near Dedupe

近重复去重只基于标题。

规则：

- 使用 `normalizedTitle`
- 先做 token 分桶筛候选
- 候选对再做 `SequenceMatcher` 比较
- 阈值为 `0.75`

不引入 summary/content 参与近重复判断。

## Item 持久化模型

### 定位

`Item` 不是聚合仓库，不存运行时评分，也不存增强结果。

它的定位是：

- 已标准化
- 已通过 pack 级过滤
- 已完成当前批次内部去重
- 可供日报消费的文章候选池

### Item 字段

保留字段：

- `id`
- `title`
- `url`
- `packId`
- `sourceId`
- `sourceName`
- `sourceType`
- `publishedAt`
- `fetchedAt`
- `author`
- `summary`
- `content`
- `metadataJson`
- `createdAt`
- `updatedAt`

删除字段：

- `score`
- `bullets`
- `categories`
- `imageUrl`

### 字段映射

`NormalizedItem -> Item`：

- `title <- title`
- `url <- normalizedUrl`
- `packId <- filterContext.packId`
- `sourceId <- sourceId`
- `sourceName <- source snapshot`
- `sourceType <- sourceType`
- `publishedAt <- publishedAt`
- `fetchedAt <- RawItem.fetchedAt`
- `author <- metadataJson.authorName`
- `summary <- normalizedSummary`
- `content <- normalizedContent`
- `metadataJson <- metadataJson`

### 唯一性与更新策略

- `Item.url` 存 `normalizedUrl`
- 数据库唯一键继续以 `url` 为准
- 命中已有 `url` 时，刷新候选基础字段
- 保留 `id` 与 `createdAt`
- 更新其余基础事实字段

本轮先不支持一篇内容属于多个 pack。

pack 归属规则：

- 若同一 `normalizedUrl` 被多个 pack 命中，当前版本只保留一条 `Item`
- `packId` 采用首次命中优先
- 后续其他 pack 再命中相同 URL，不改已有 `Item.packId`

## 日报输入与统一候选模型

### 日报输入

日报可选择多个 pack。

日报输入来源包括：

- `Item`
- `Tweet`
- 未来其他持久化类型

不同数据类型继续分开处理和持久化，不强行合并 schema。

### ReportCandidate

`ReportCandidate` 是日报阶段统一候选模型，不是数据库表。

字段：

- `id`
- `kind`
- `packId`
- `title`
- `summary`
- `content`
- `publishedAt`
- `sourceLabel`
- `normalizedUrl`
- `normalizedTitle`
- `rawRef`

规则：

- 单条候选只属于一个 pack
- 日报支持多 pack，本质是多来源合并读取
- 对 `tweet`，`packId` 暂时允许使用固定保留值，而不强行映射到真实业务 pack
- `tweet` 当前总是参与日报输入，不受所选 pack 集合限制

## 评分阶段

### 设计原则

评分阶段拆成多个小阶段，而不是一个黑盒函数。

运行时评分不回写原始持久化表。

### Stage 1: Base Stage

输入：

- `ReportCandidate`
- 日报配置中的 kind 偏好

输出：

- `baseScore`

规则：

- 不同 kind 有不同基础分
- 基础分由日报配置驱动
- 例如本期偏向 Twitter，则 `tweet` 的基础分更高

### Stage 2: Kind Signal Stage

输入：

- `ReportCandidate`

输出：

- `signalScores`

规则：

- 每个 kind 有自己的 score adapter
- `tweet` 适配器可参考：
  - like
  - bookmark
  - view
  - reply
  - repost/retweet
- `item` 适配器后续可根据文章型信号扩展

### Stage 3: Merge Stage

输入：

- `baseScore`
- `signalScores`

输出：

- `runtimeScore`

规则：

- 合并不同 kind 的分数信号
- 形成可跨类型比较的运行时分数

### Stage 4: History Penalty Stage

输入：

- `runtimeScore`
- 最近已进入日报的历史内容

输出：

- `finalScore`

规则：

- 历史重复惩罚放在最后一个小阶段
- 使用：
  - `normalizedUrl` 精确命中
  - `normalizedTitle` 近似命中
- 只降权，不直接过滤

### 评分输出

每条候选至少产出：

- `baseScore`
- `signalScores`
- `runtimeScore`
- `historyPenalty`
- `finalScore`
- `breakdown`

## 日报生成顺序

1. 读取日报配置
2. 读取多个 pack 下最近 24h 的 `Item`
3. 读取 `Tweet`
4. 映射成统一 `ReportCandidate`
5. 进入评分 pipeline
6. 按 `finalScore` 截断到 top N
7. 对 top N 执行 AI filter
8. 对过滤后的候选执行 topic clustering
9. 对每个 topic 执行 summary
10. 持久化 `DailyOverview` 和 `DigestTopic`
11. 周报继续消费日报结果

当前周报兼容规则：

- 本轮设计下，日报可包含多 kind 候选
- 周报暂时只消费日报中的 item 相关结果
- 非 item 的日报候选先不进入周报主链，后续单独设计

## 对现有逻辑的主要影响

- pack 级主题过滤从日报前移到采集主链
- `Item` 从混合职责表收缩为候选池表
- `normalize` 去掉 canonical 相关逻辑
- `Item.score` 及增强结果字段删除
- 日报不再直接依赖 `Item.score`
- 历史重复惩罚移到日报评分阶段最后一步
- `Item` / `Tweet` 不再直接进入日报后半段，统一先映射成 `ReportCandidate`

## 待后续设计的问题

本轮已明确以下结论：

- `Tweet -> ReportCandidate`
  - `title = tweet 主文本首句或截断文本`
  - `summary = tweet 主文本`
  - `content` 当前留空，后续在支持 thread / quoted / article 展开后再增强
  - `sourceLabel = @handle`
  - 实现时添加注释：`TODO: 需要优化`
- `item` score adapter
  - 本轮只要求保留独立 adapter 边界与统一输出结构
  - 具体信号定义与权重本轮不定死
  - 实现时添加注释：`TODO: 需要优化`
- 历史重复判断窗口固定为最近 14 天
- `DailyOverview` / `DigestTopic` 与底层候选引用关系当前继续使用 `itemIds` / `tweetIds`
- 对应实现位置添加注释：`TODO: 需要优化`
- 迁移策略采用分阶段兼容方式：
  1. 先新增新字段和新结构，保留旧逻辑
  2. 再切换写路径
  3. 再切换读路径
  4. 最后删除旧字段和旧逻辑
