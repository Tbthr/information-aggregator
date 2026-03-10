# 数据源类型路线图设计

日期：2026-03-10
状态：已确认

## 目标

为 `information-aggregator` 制定一份按阶段推进的数据源类型实现路线图。路线图要同时覆盖：

- source type 体系
- 每个阶段要新增的能力
- 配置规范与 pack 规范
- X 数据接入方向
- 测试与文档策略

本设计不覆盖：

- Web UI
- 多用户能力
- 调度平台化
- 鉴权与部署编排

## 当前背景

当前仓库已经具备：

- 本地 YAML 配置：`sources`、`packs`、`topics`、`profiles`
- 已接入或已具备 collector 路径的类型：`rss`、`json-feed`、`website`、`hn`、`reddit`
- 规范化、精确去重、近似去重、排序、聚类、Markdown 输出
- 根据 5 个参考项目扩充后的 source surface

当前配置已经同时包含两类内容：

1. 当前可以进入主链路的数据源
2. 为了完整表达参考项目 source surface 而加入的 disabled reference source

因此后续路线图不能只写“继续加 adapter”，还必须先解决 source type、config schema、pack 语义和文档边界。

## 设计原则

- 一类 source family 只保留一套正式命名。
- 先定义 config schema，再实现 adapter。
- 先写 fixture test，再接真实网络。
- collector 只负责稳定采集，不提前塞入重型 enrichment。
- X 统一走 `bird CLI`，不引入浏览器自动化双实现。
- AI 只在候选缩减之后介入，不参与基础采集。

## 数据源类型体系

### Feed Family

- `rss`
- `json-feed`
- `website`
- `opml_rss`

### Community Family

- `hn`
- `reddit`
- `github_trending`

### Structured External Family

- `digest_feed`
- `custom_api`

### X Family

- `x_home`
- `x_list`
- `x_bookmarks`
- `x_likes`
- `x_multi`

仓库内部不再保留旧版别名族，统一使用 `x_*` 作为正式类型。

## 参考项目映射

### `ai-daily-digest`

贡献：

- 高质量 RSS/blog 数据源池
- digest 输出结构参考

对应阶段：

- Phase 1 的 feed baseline

### `ai-news-radar`

贡献：

- 聚合站与新闻站 source set
- `opml_rss` 需求
- source health 思路

对应阶段：

- Phase 1 feed defaults
- Phase 2 `opml_rss`

### `clawfeed`

贡献：

- 更广的 source type surface：
  - `rss`
  - `website`
  - `hn`
  - `reddit`
  - `github_trending`
  - `digest_feed`
  - `custom_api`

对应阶段：

- Phase 1：`hn`、`reddit`
- Phase 2：`digest_feed`、`custom_api`、`github_trending`

### `smaug`

贡献：

- `bird CLI` 路线
- X 内容提取与 enrichment 思路
- t.co 展开、GitHub repo 提取、外链正文提取、X 长文提取

对应阶段：

- Phase 3：X ingestion
- Phase 4：X enrichment

### `x-ai-topic-selector`

贡献：

- X 内容筛选、评分、报告组织方式

对应阶段：

- Phase 3：`x_home`、`x_list`、`x_bookmarks` 的需求边界
- Phase 4：X ranking / report hooks

## X 方向

所有 X 采集统一使用 `bird CLI`。

明确约束：

- 不做 CDP / 浏览器双路线
- 不引入旧版 X 别名体系
- `smaug` 负责提供 ingestion / extraction 思路
- `x-ai-topic-selector` 负责提供 filtering / scoring / report 思路

因此：

- Phase 3 只解决 X source 的稳定接入
- Phase 4 再吸收 `smaug` 和 `x-ai-topic-selector` 的高价值能力

## 配置与 Pack 审计结果

本次设计已把 `config/packs` 的审计结果纳入后续路线图，当前发现如下：

### 1. 没有悬空引用

所有 pack 中的 `sourceIds` 都能在 `config/sources.example.yaml` 中找到，因此不存在 referential integrity 错误。

### 2. 命名存在与设计冲突的条目

当前配置与文档审计曾发现旧版别名与社区源命名漂移。

问题：

- 旧版 X 别名与本设计确认的 `x_*` 单一命名冲突
- 旧版 HN 命名与当前仓库 collector/adapter 的 `hn` 命名不一致

这些问题必须作为路线图的第一批修正项。

### 3. 存在 reference-only packs

当前已按数据源本质收敛为下列 reference-only packs，而不是继续保留参考项目命名：

- `community-api-reference`
- `import-and-special-feed-reference`
- `web-auth-reference`
- `x-auth-reference`

原因：

- 它们表达的是 source taxonomy，而不是上游项目边界
- 其中包含 disabled reference source、auth-required source 或 schema placeholder
- 如果未来误接入 profile，会把不可匿名运行的 source 混入默认选择

### 4. 存在 placeholder 但并非可运行示例

典型例子：

- `hn-front-page-reference`

问题：

- 它当前的 URL 指向 Algolia HN 搜索接口
- 但当前 `hn` adapter 期望的是另一种 payload 契约

因此这类 source 不能只被标记为“disabled placeholder”，还要被文档明确标为“schema placeholder / non-runnable placeholder”。

### 5. 文档与设计存在漂移

当前 README 曾提到旧版 X placeholder 类型，这与最终确认的 `x_*` 设计不一致。  
这类漂移必须纳入路线图中的文档对齐任务。

## Phase 规划

## Phase 1：稳定基线

范围：

- `rss`
- `json-feed`
- `website`
- `hn`
- `reddit`

目标：

把当前主链路打磨成稳定的、可文档化的 baseline。

内容：

- 收紧 type taxonomy
- 增加 source-type-specific validation 基础能力
- 为 `hn` / `reddit` 增加 source-aware dedupe 和 ranking
- 明确哪些 source type 已稳定支持
- 处理配置审计中最先暴露的命名问题

退出标准：

- 当前默认 pack 可稳定工作
- `hn` / `reddit` 成为一等支持类型

## Phase 2：结构化非标准输入

范围：

- `opml_rss`
- `digest_feed`
- `custom_api`
- `github_trending`

目标：

让非标准 feed 源拥有明确 schema，而不是仅靠自由格式配置。

内容：

- 定义 type-specific config schema
- 允许 collector 根据 config 决定解析行为
- 为 `digest_feed` 增加 canonical-link dedupe 规则
- 为 `custom_api` 引入受限 mapping 能力
- 为 `github_trending` 设计受控的 fixture-first parser

退出标准：

- `opml_rss` 可用
- `digest_feed` / `custom_api` 有显式 schema
- `github_trending` 有可测设计

## Phase 3：X 采集

范围：

- `x_home`
- `x_list`
- `x_bookmarks`
- `x_likes`
- `x_multi`

目标：

把 X family 统一接入主 pipeline，且只依赖 `bird CLI`。

内容：

- 定义 X source config contract
- 加入 `bird CLI` 调用层
- 将 `bird` 输出映射为统一 `RawItem`
- 增加 X 专用规范化与 canonical hint
- collector 只做采集，不做重型内容展开

退出标准：

- X source 可以走统一 family 进入主链路
- 测试基于 fixture，而不是浏览器

## Phase 4：Enrichment 与质量提升

本阶段不新增 source type，而是提升复杂源质量。

重点：

- X thread / quote 扩展
- t.co 展开
- 外链正文提取
- GitHub repo 提取
- X 长文提取
- source-aware cluster 与 ranking

目标：

让系统从“多源抓取器”升级为“多源聚合 + 去重 + 深化理解”。

内容：

- 增加 enrichment worker 边界
- 复用 `smaug` 的提取思路
- 吸收 `x-ai-topic-selector` 的排序与报告思路
- 在 render 中区分原始源、讨论源、转述源

## 各阶段共同要求

每个 phase 都必须覆盖：

- config schema
- source validation
- collector contract
- normalization
- dedupe
- ranking 影响
- focused tests
- 文档更新

任何只增加 adapter 代码、但不补上述配套能力的阶段都不能视为完成。

## 测试策略

- 全部新增 source type 先走 fixture-first
- adapter contract test 优先于真实网络测试
- 真实网络探测只做手动 probe
- X 相关测试默认不进入稳定 CI
- config schema 更新必须伴随 config validation test

## 文档策略

仓库文档要明确区分两层语义：

1. 当前稳定支持的 source type
2. 为了 reference-project 覆盖而存在的 roadmap / placeholder source type

同时要再区分：

- disabled but structurally valid placeholder
- non-runnable schema placeholder

否则 pack 和 source config 会误导使用者。

## 结论

- 仓库内部 source type 统一为 `x_*`、`hn` 等 canonical 命名
- X 只走 `bird CLI`
- `smaug` 作为 X ingestion / extraction 参考
- `x-ai-topic-selector` 作为 X ranking / reporting 参考
- 路线图必须先解决 config 与 pack 的命名、语义、文档边界问题，再逐步实现新 adapter
