# Query Runner 与 View System 设计

## 背景

当前项目以 `scan` 与 `digest` 作为顶层 CLI 命令。这种设计在项目早期是够用的，但随着使用场景扩展，问题已经比较明显：

- 输出模式和数据选择耦合过深
- 时间窗口不是统一参数，而是局部逻辑
- `profile` 过于中心化，显式选择 source / pack / topic 的能力不足
- 面向 X 的专项分析需求无法自然表达
- 未来如果增加网页或其他消费者，缺少稳定的中间层 JSON 契约

用户现在希望系统能支持更通用的查询式 CLI，覆盖这些典型场景：

- 每日日报：可指定主题，并隐含时间窗口筛选
- 对 X 的长文热帖获取
- 对 X bookmarks 分析，支持时间窗口
- 对 X likes 分析，支持时间窗口
- 支持主题和时间窗口的组合筛选
- 当前先输出 Markdown，未来可复用中间层 JSON 做网页

## 问题陈述

当前实现的主要问题不是 adapter 不够，而是运行模型不够通用。

现状的核心路径是：

```text
profile -> sourcePackIds -> sourceIds -> collect -> normalize -> dedupe -> rank -> render(scan|digest)
```

这带来的约束是：

- 用户很难直接表达“只看某类 source”
- 时间窗口没有成为一等参数
- `scan` / `digest` 被实现成两条端到端流程，而不是统一查询结果上的两种视图
- 想新增 `x-bookmarks-analysis`、`x-likes-analysis`、`x-longform-hot` 这类能力时，只能继续堆新命令或复制流程

## 设计目标

- 废弃 `scan` / `digest` 作为顶层运行模型
- 引入统一的 query-runner CLI
- 将 source 选择、topic、时间窗口、输出视图都变成显式参数
- 保持底层 pipeline 的确定性
- 维持 Markdown 输出，同时引入稳定的中间层 JSON 契约
- 保持现有 adapter / collect pattern，不把 source-specific 逻辑混入 render
- 让未来新增 view 成本明显降低

## 非目标

- 本轮不引入 Web UI
- 不引入 embeddings / vector similarity
- 不做通用模板 DSL
- 不重写现有 adapter 契约
- 不把 view 设计成会反向影响 fetch 行为的黑盒流程

## 设计决策摘要

### 1. 顶层命令改为统一查询入口

顶层 CLI 从：

```bash
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

演进为：

```bash
bun scripts/aggregator.ts run --view <view> [query options]
```

`scan` 与 `digest` 不再作为独立模式存在，而是历史上的两个具体视图：

- `scan` -> `item-list`
- `digest` -> `daily-brief`

### 2. 运行模型改为 Query + View

新的统一运行流：

```text
CLI args
-> QuerySpec
-> SelectionResolver
-> Collect
-> Normalize
-> Dedup
-> TimeWindowFilter
-> Rank / Cluster / Analyze
-> ViewRenderer
-> Markdown
```

这里的关键变化是：

- 用户请求首先被表达为 `QuerySpec`
- 底层统一产出 `QueryResult`
- 不同 `view` 只是在同一个 `QueryResult` 上做分析与渲染

### 3. 时间窗口成为一等参数

时间窗口不再是 `digest` 私有逻辑，而是 query 级标准字段。

支持的表达方式：

- `--window 24h|7d|30d|all`
- `--since <datetime>`
- `--until <datetime>`

统一语义：

- 优先使用 `publishedAt`
- 缺失时回退到 `fetchedAt`
- 始终做最终统一后过滤，保证跨 source 语义一致
- 如果未来个别 adapter 可以下推时间参数，那只是性能优化，不改变结果语义

### 4. YAML 只保留当前可运行能力

配置层不再区分 runnable pack 和 reference-only pack。

新原则：

- 只要出现在 YAML 中，就应该是当前系统认可的可运行 source / pack
- 暂不支持、需要额外前提、尚未完成的 source，不放进 YAML
- 这些未来能力统一写入 Markdown 设计或路线图文档，不体现在运行时配置层

这意味着现有 `pack.referenceOnly` 需要被移除。

## CLI 设计

### 顶层命令

```bash
bun scripts/aggregator.ts run --view <view> [selectors...] [options...]
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts sources list [selectors...] [options...]
```

说明：

- `run`：统一运行查询并输出结果
- `config validate`：校验本地配置
- `sources list`：仅解析并展示本次查询最终命中的 source，便于调试和预览

### 选择器参数

这些参数决定“看哪些内容”：

- `--profile <id>`
- `--pack <id>`，可重复
- `--source-type <type>`，可重复
- `--source <id>`，可重复
- `--topic <id>`，可重复

### 查询选项

这些参数决定“如何看这些内容”：

- `--window <preset>`
- `--since <datetime>`
- `--until <datetime>`
- `--limit <n>`
- `--sort <mode>`
- `--lang <code>`
- `--format md|json`
- `--dry-run`

### 参数优先级

统一优先级为：

```text
view defaults -> profile defaults -> explicit selectors/options
```

规则细化：

- 如果没有任何显式选择器，则可以默认落到 `profile=default`
- 一旦出现显式选择器，系统进入显式选择模式
- `profile` 在新模型下只是 preset，不再决定运行模式
- 用户显式传入的参数总是优先

## View System 设计

### View 的职责

view 是消费统一 `QueryResult` 的分析与渲染插件。它不能负责抓取，也不能把 source-specific fetch 细节带回上游。

每个 view 负责：

- 声明自己的默认参数
- 声明自己需要的中间结果
- 将 `QueryResult` 转换为 `ViewModel`
- 将 `ViewModel` 渲染为 Markdown

### 第一版 View 集合

#### `item-list`

用途：

- 快速浏览当前命中的条目
- 是 `scan` 的替代者

输入：

- ranked items

输出：

- 标题
- URL
- score
- source
- 可选 rationale

#### `daily-brief`

用途：

- 日报式主题摘要
- 是 `digest` 的替代者

输入：

- ranked items
- clusters
- highlights
- 可选 narration

默认：

- `window=24h`
- `sort=relevance`

#### `x-longform-hot`

用途：

- 发现 X 上值得阅读的长文 / 热帖

输入：

- X family items
- engagement signals
- 外链 hint
- clusters

分析重点：

- 是否带外链
- 文本长度
- engagement
- 聚类热度
- 主题与语言约束

#### `x-bookmarks-analysis`

用途：

- 分析某时间窗口内收藏了什么

输入：

- `x_bookmarks` items
- clusters
- domain 聚合
- topic 分布

输出重点：

- summary
- top themes
- notable saved items
- frequent domains
- frequent authors

#### `x-likes-analysis`

用途：

- 分析某时间窗口内点赞偏好

输入与 bookmarks 类似，但分析重点更偏兴趣信号：

- topic distribution
- frequently liked authors
- notable liked posts
- emerging interests

## 中间层契约

### `QuerySpec`

用于表达用户请求。

建议字段：

- `view`
- `profileId?`
- `packIds`
- `sourceTypes`
- `sourceIds`
- `topicIds`
- `window`
- `since`
- `until`
- `limit`
- `sort`
- `lang`
- `format`
- `dryRun`

### `ResolvedSelection`

用于表达一次运行真正解析出的输入边界。

建议字段：

- `view`
- `selectedSourceIds`
- `selectedSources`
- `topicIds`
- `topicRule`
- `window`
- `since`
- `until`
- `limit`
- `sort`
- `format`
- `appliedDefaults`

### `QueryResult`

用于表达统一 pipeline 的产物。

建议字段：

- `query`
- `selection`
- `items`
- `normalizedItems`
- `rankedItems`
- `clusters`
- `analytics`
- `warnings`
- `viewModel`

说明：

- Markdown renderer 使用 `viewModel`
- 未来网页可以直接消费 `viewModel` 或更底层字段

## 配置模型演进

### 保留的配置

- `sources`
- `packs`
- `topics`

### 重新定义的配置

`profiles` 从“运行模式配置”变成“query preset”。

旧形态：

```yaml
profiles:
  - id: default
    name: Default Digest
    mode: digest
    topicIds:
      - ai-news
      - engineering-blogs
    sourcePackIds:
      - ai-news-sites
      - engineering-blogs-core
```

新形态建议：

```yaml
profiles:
  - id: default
    name: Default
    topicIds:
      - ai-news
      - engineering-blogs
    sourcePackIds:
      - ai-news-sites
      - engineering-blogs-core
    defaultView: daily-brief
    defaultWindow: 24h
```

变化点：

- 删除 `mode`
- 增加 `defaultView`
- 增加 `defaultWindow`

### 新增配置

新增 `views` 配置，例如 `config/views.example.yaml`。

示意：

```yaml
views:
  - id: item-list
    name: Item List
    defaultSort: relevance

  - id: daily-brief
    name: Daily Brief
    defaultWindow: 24h
    defaultSort: relevance

  - id: x-bookmarks-analysis
    name: X Bookmarks Analysis
    defaultSourceTypes:
      - x_bookmarks
    defaultWindow: 7d
    defaultSort: recency
```

这层配置用于承载：

- view 的默认参数
- view 的帮助信息
- view 与 source-type 的合理绑定

## 代码结构演进

建议新增或重组为以下模块：

```text
src/cli/           参数解析与命令入口
src/config/        YAML 加载与校验
src/query/         QuerySpec / SelectionResolver / QueryEngine
src/pipeline/      collect / normalize / dedupe / rank / cluster
src/views/         各 view 的分析逻辑与 registry
src/render/        markdown/json 渲染
```

### 关键收敛点

- `src/config/resolve-profile.ts`
  - 被更通用的 `src/query/resolve-selection.ts` 取代

- `src/cli/run-scan.ts`
  - 退役或短期作为兼容 wrapper

- `src/cli/run-digest.ts`
  - 退役或短期作为兼容 wrapper

- `src/render/scan.ts`
  - 迁移为 `item-list` markdown renderer

- `src/render/digest.ts`
  - 迁移为 `daily-brief` markdown renderer

## 错误处理设计

错误分为三类：

### 1. 配置错误

例如：

- 未知 pack
- 未知 source
- 未知 view
- 未知 topic
- YAML schema 非法

要求：

- 在 collect 前失败
- 消息包含明确的 id 和字段

### 2. 查询冲突错误

例如：

- `since > until`
- 参数组合非法
- view 与显式 source-type 冲突

要求：

- 在 collect 前失败
- 不做隐式修正

### 3. source 运行时错误

例如：

- 网络失败
- `bird` 不可用
- 上游 HTML / payload 变化

要求：

- 单个 source 失败可降级
- 结果顶部附带 warning
- 全部 source 失败时整次 query 失败

## 验证策略

### 测试层次

1. CLI 参数解析测试
2. `SelectionResolver` 测试
3. `QueryEngine` 测试
4. view 级 E2E 测试

### 测试重点

- 显式选择器优先级
- view 默认值应用
- 时间窗口语义
- `item-list` / `daily-brief` / X 分析视图最终 Markdown
- 中间层 JSON 契约
- 删除 `referenceOnly` 后的 pack 行为

## 迁移策略

建议采用短期双轨、快速收敛：

### 阶段 1

- 新增 `run --view ...`
- 保留 `scan` / `digest` 作为 thin wrapper
- 帮助文案中标记 deprecated
- `scan` 映射到 `item-list`
- `digest` 映射到 `daily-brief`

### 阶段 2

- README、测试、文档迁到新命令
- 删除 `scan` / `digest`
- 删除 `profile.mode`
- 删除 `pack.referenceOnly`
- 清理旧命令专属代码

## 风险与取舍

### 风险 1：重构跨度较大

这是行为级重构，牵涉 CLI、config、render、tests、docs。需要通过小步计划执行，避免一次性改动过大。

### 风险 2：X 专项视图需要额外分析逻辑

`x-longform-hot`、`x-bookmarks-analysis`、`x-likes-analysis` 不是简单换渲染模板，需要在统一 `QueryResult` 上增加 analytics 与 view-specific scoring。

### 风险 3：旧配置与旧命令的兼容期管理

如果双轨兼容太久，会增加维护成本。因此兼容应短期存在，并在文档中明确废弃路径。

## 最终结论

本次设计的核心结论如下：

- 顶层运行模型从 `scan` / `digest` 迁移到统一 `run --view`
- `scan` 与 `digest` 退化为历史视图名，而不是独立 pipeline
- source 选择、topic、时间窗口、排序、视图都变成显式 query 参数
- YAML 只保留当前可运行 source / pack，不再区分 reference-only
- 引入统一 `QuerySpec`、`ResolvedSelection`、`QueryResult` 契约
- Markdown 是当前主输出，结构化 JSON 为未来网页预留

这个方向能在不破坏 deterministic pipeline 原则的前提下，把当前项目从“双命令渲染器”升级为“通用查询引擎 + 多视图系统”。
