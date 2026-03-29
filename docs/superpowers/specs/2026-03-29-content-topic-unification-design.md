# Content / Topic 统一模型设计

**日期**: 2026-03-29
**状态**: 草稿
**范围**: 用统一 `Content` 表替换 `Item`，将 `pack` 重命名并重定义为面向日报展示的 `Topic`

## 背景

当前系统虽然已经有通用的 article collect pipeline，但 X/Twitter 仍然保留了独立的采集与存储路径。随着后续要接入更多内容类型，这种“每种类型一条 pipeline”的方式会持续复制：

1. 采集配置会分裂
2. 候选池会分裂
3. 报表前的过滤、去重、聚类会重复实现

日报和周报天然是多内容类型的统一消费层，因此更合理的边界是：

1. 每种类型允许有自己的预处理
2. 所有类型尽早映射到统一的 `Content`
3. topic 分类、去重、报表生成全部围绕统一 `Content` 进行

## 参考项目结论

同目录的 `tech-news-digest` 提供了两点可直接借鉴的思路：

1. `source` 是统一配置对象，类型差异只体现在专属字段
2. `topic` 更像“日报栏目定义”，内容在 merge 阶段根据 `source.topics` 和规则进入对应 topic

它并不是“抓完再完全靠 AI 从零分类”，而是：

`source 默认 topic 候选 -> merge 阶段统一分组`

本设计沿用这个思路，不走 AI-first 分类。

## 设计目标

1. 用统一 `Content` 替换 `Item`
2. 将 `pack` 改名为 `Topic`，语义收敛为“日报/周报栏目定义”
3. 允许一条内容同时命中多个 topic，并在评分阶段获得额外加分
4. 不引入 `ContentDetail` / `ContentTopic` 等额外表，第一版保持主模型克制
5. 保持“类型预处理”和“统一报表主干”之间的清晰边界

## 核心模型

### 1. Source

`Source` 负责“从哪抓、怎么抓、默认供给哪些 topic”。

建议字段：

1. `id`
   用途：来源唯一标识，供日志、健康状态、配置引用使用。
2. `kind`
   用途：来源类型，例如 `rss`、`xHome`、`xList`、`githubRelease`。
3. `name`
   用途：后台展示、调试、报表来源说明。
4. `enabled`
   用途：统一开关，关闭后该来源不参与采集。
5. `priority`
   用途：来源基础权重，可进入评分阶段。
6. `defaultTopicIds`
   用途：借鉴 `tech-news-digest` 的 `source.topics`；内容初始的 topic 候选集合来自这里。
7. `configJson`
   用途：来源类型专属采集参数，例如 RSS 的 URL、website 的抓取入口、JSON feed 的 URL、X 的 listId / birdMode / count。
8. `authRef`
   用途：认证配置引用，避免将凭据散落在业务逻辑中。
9. `createdAt` / `updatedAt`
   用途：审计字段。

### 2. Topic

`Topic` 不再代表“内容标签”或“source 容器”，而是日报/周报中的栏目定义。

建议字段：

1. `id`
   用途：栏目稳定标识。
2. `name`
   用途：日报/周报展示标题。
3. `description`
   用途：栏目说明，也可作为 AI 聚类或摘要时的上下文补充。
4. `enabled`
   用途：栏目总开关；关闭后既不参与分类，也不参与展示。
5. `includeRules`
   用途：栏目命中规则；第一版使用简单关键词数组，与 `tech-news-digest` 保持一致。
6. `excludeRules`
   用途：栏目排除规则；第一版同样使用简单关键词数组。
7. `displayOrder`
   用途：日报/周报里的栏目排序。
8. `maxItems`
   用途：栏目候选上限，控制每个 topic 进入报表的内容数量。
9. `scoreBoost`
   用途：命中该 topic 时的额外加分。
10. `createdAt` / `updatedAt`
   用途：审计字段。

### 3. Content

`Content` 是统一内容主表，替换现有 `Item`。它既服务于采集后的统一候选池，也服务于 topic 分类和报表生成。

建议字段：

1. `id`
   用途：内部主键，供所有流程稳定引用。
2. `kind`
   用途：内容类型标记，例如 `article`、`tweet`、未来的 `video`、`repo`。注意它描述的是内容类型，不等于 `Source.kind`。
3. `sourceId`
   用途：追踪内容来自哪个来源，参与来源健康和来源权重计算。
4. `title`
   用途：统一标题，供展示、去重、聚类提示使用。
5. `body`
   用途：统一主文本。它同时用于过滤、文本去重、AI 聚类和报表摘要输入。
6. `url`
   用途：归一化后的最终 URL，作为统一跳转地址和 URL 去重依据。
7. `authorLabel`
   用途：统一作者显示名，可空。
8. `publishedAt`
   用途：发布时间，必填；用于时效评分和日报/周报时间窗口。
9. `fetchedAt`
   用途：抓取时间，用于增量同步和审计。
10. `engagementScore`
   用途：统一热度分，可空；把点赞、评论、转发、star 等平台信号折算为统一排序输入。
11. `qualityScore`
   用途：统一质量分，可空；供运行时排序和选材。
12. `topicIds`
   用途：该内容最终命中的 topic 列表；一条内容可以属于多个栏目。
13. `topicScoresJson`
   用途：记录每个 topic 的命中分；支撑“一条内容同时命中多个 topic 并加分”。
   第一版结构固定为“以稳定 `topicId` 为 key、以基础匹配分为 value”的对象映射。
   例如：`{"llm": 12, "agents": 8}`。
   约束：
   - key 必须是 `Topic.id`
   - value 必须是未叠加 `Topic.scoreBoost` 的基础匹配分
   - 未命中的 topic 不出现在对象中
   - 不使用 topic name 或展示文案作为 key
14. `metadataJson`
   用途：承载类型差异字段，例如 tweet 的 media / thread / quote / article preview。
15. `createdAt` / `updatedAt`
   用途：审计字段。

## 关键约束

### 1. 只保留一个 URL 字段

旧 `Item` 的 `url` / `canonicalUrl` 在新模型中收敛为单个 `url`：

1. 预处理阶段负责把原始链接归一化
2. 入库时只保存归一化后的最终 URL
3. 后续去重、跳转、引用都统一围绕该字段

### 2. `publishedAt` 必填

统一内容层不接受缺失发布时间的内容：

1. fetch / preprocess 阶段若无法拿到 `publishedAt`
2. 该内容直接丢弃
3. 打印 `warn` 日志，记录来源和内容标识

原因是日报/周报是显式的时间窗口产物，缺少发布时间会破坏时效过滤、排序和审计。

### 3. 不引入 `ContentDetail` / `ContentTopic`

第一版不新增额外表：

1. 类型差异通过 `metadataJson` 承载
2. topic 分类结果直接写入 `Content.topicIds`
3. topic 分数写入 `Content.topicScoresJson`

这样更贴近 `tech-news-digest` 的“内容对象直接带 topics”思路，也降低迁移复杂度。

## 分类策略

topic 分类沿用 `tech-news-digest` 的规则优先策略，不走 AI-first：

1. `Source.defaultTopicIds` 先提供初始 topic 候选
2. `Topic.includeRules` / `excludeRules` 对内容做过滤判断
3. 生成最终 `topicIds`
4. 同时计算 `topicScoresJson`
5. 若内容命中多个高价值 topic，可在评分阶段追加 cross-topic bonus

这个策略的优点：

1. 易解释：为什么一条内容被归入某个 topic 可以回溯到 source 和规则
2. 易扩展：新增内容类型不要求先解决复杂 AI 分类
3. 易维护：topic 调整主要靠配置，不需要大幅改 pipeline

### 规则语义

第一版关键词规则需要保持简单且可预测：

1. 匹配面为 `Content.title + "\n\n" + Content.body`
2. 匹配前统一转为小写，并折叠连续空白
3. `includeRules` / `excludeRules` 都是大小写不敏感的关键词数组
4. `excludeRules` 优先级高于 `includeRules`
5. 某个 topic 的判定顺序为：
   `source.defaultTopicIds` 包含该 topic -> 检查 exclude -> 若命中 exclude 则剔除 -> 若 includeRules 为空则保留 -> 若 includeRules 非空则至少命中一条才保留
6. 第一版不做“脱离 source 默认候选的全局 topic 猜测”；也就是说，topic 分类不会仅凭关键词把内容分配到 `defaultTopicIds` 之外的新 topic
7. `topicScoresJson` 只保存基础匹配分；`Topic.scoreBoost` 仅在后续统一评分阶段参与最终排序，不回写到 `topicScoresJson`

这个约束是有意的：先让 topic 成为“报表栏目过滤器”，而不是“全局自动标签器”。

## 新 Pipeline 分层

统一 pipeline 采用“类型预处理 + 统一主干”的中间路线：

### 阶段 1：Source Fetch

每种来源走自己的 adapter / preprocess：

1. `rss` 使用独立的 RSS fetcher adapter
2. `website` 使用独立的 website fetcher adapter
3. `json-feed` 使用独立的 JSON feed fetcher adapter
4. X 相关 source kinds（如 `xHome`、`xList`）共用独立的 X fetcher adapter，并在这一阶段补全 quote / thread / article preview
5. 未来的新类型也在这里完成类型专属的数据获取

这样拆分的原因是：

1. RSS、website、JSON feed 虽然最终都可能产出 `Content(kind="article")`，但抓取方式、失败模式和配置结构并不相同
2. fetcher adapter 按来源类型拆开后，后续接入新 article-like 来源时不会继续把逻辑堆到同一个 adapter 中
3. “独立 fetcher，统一 normalize” 的边界更清晰，和 `tech-news-digest` 的 `fetch-rss.py` / `fetch-web.py` 分工一致

### 阶段 2：Normalize To Content

所有类型映射为统一 `Content` 输入对象。在这里完成：

1. 标题统一化
2. 主文本 `body` 生成
3. URL 归一化
4. `engagementScore` 标准化
5. `publishedAt` 校验

#### 字段生成规则

为避免不同 fetcher / normalizer 对统一字段产生不同理解，第一版明确以下生成规则：

##### 标题统一化

目标：所有内容类型都必须生成稳定、可展示、可比较的 `title`。

1. `article`
   优先使用原始标题；处理顺序固定为：HTML 解码 -> 去 RT 前缀 -> 去尾部站点名 -> 空白折叠 -> 长度截断。
2. `tweet`
   使用正文首句或首个非空段；处理顺序固定为：去裸 URL -> 空白折叠 -> 长度截断。
3. 清洗后的 `title` 不能为空。
4. 若清洗后为空，则该内容直接丢弃并记录 `warn`。
5. `title` 是展示文本，不额外做激进去噪；文本去重依赖 `title + body` 的组合，而不是把 `title` 单独做成算法字段。
6. 第一版 `title` 最大长度固定为 160 个字符，截断发生在所有清洗完成之后。
7. 存储到 `Content.title` 的值保持原大小写，不做 lowercasing。

##### 主文本 `body` 生成

目标：生成统一的主文本，既能服务报表，也能服务文本去重与聚类。

1. `article`
   优先级为：正文摘要/正文内容 > feed summary > 标题补足。
2. `tweet`
   优先级为：tweet text + quote text + article preview text + thread 摘要片段。
3. `body` 必须是纯文本；处理顺序固定为：去 HTML -> HTML 解码 -> 空白折叠 -> 长度截断。
4. 第一版 `body` 最大长度固定为 500 个字符，截断发生在所有清洗完成之后。
5. `body` 保留自然语义顺序，不做 lowercasing；如需大小写不敏感比较，由去重阶段自行处理。
6. 若正文缺失，可退化为 `title`；若退化后仍为空，则该内容直接丢弃并记录 `warn`。

##### 去重比较文本

存储字段和 dedupe 比较字段分开定义，避免“重复规范化”带来的歧义：

1. `Content.title` 和 `Content.body` 按上面的存储规则写入库中
2. near-dedup 时，不直接比较存储值，而是现算 `dedupeText`
3. `dedupeText` 的生成规则固定为：
   - 输入：`Content.title + " " + Content.body`
   - 处理顺序：lowercase -> 去标点 -> 空白折叠
4. `dedupeText` 不回写数据库，只用于 near-dedup 比较
5. 第一版不对 `dedupeText` 再做 HTML 处理，因为进入 `Content.body` 前 HTML 已被移除

##### URL 归一化

目标：`Content.url` 同时作为统一跳转地址和 URL 精确去重键。

1. 优先使用来源已解析出的 canonical URL；若没有 canonical，则使用原始 URL。
2. 统一使用现有 `src/pipeline/normalize-url.ts` 的规则作为第一版契约。
3. 规范化步骤固定为：
   - 协议小写
   - host 小写
   - 去掉 `www.`
   - `twitter.com` / `www.twitter.com` / `www.x.com` 统一改写为 `x.com`
   - 去掉 fragment
   - 删除追踪参数：`fbclid`、`gclid`、`mc_cid`、`mc_eid`、`ref`、`utm_campaign`、`utm_content`、`utm_medium`、`utm_source`、`utm_term`
   - 移除非根路径的尾部斜杠
4. 其余 query 参数默认保留；第一版不做 allowlist。
5. X / Twitter 内容入库前必须展开到最终内容 URL，而不是短链。
6. 归一化失败或结果非法时，该内容直接丢弃并记录 `warn`。

##### `engagementScore` 标准化

目标：提供一个可跨内容类型比较的统一热度输入，而不是保存所有平台的原始互动字段。

1. 原始平台指标保留在 `metadataJson`。
2. `engagementScore` 只保存统一后的单值。
3. 第一版采用轻量规则映射，不引入复杂学习型归一化。
4. 各内容类型可使用不同公式，但输出区间必须一致。
5. 第一版统一输出区间为 `0-100` 的整数，并在计算后做 `Math.max(0, Math.min(100, score))` 裁剪。
6. 没有互动数据时可为空，不伪造热度值。

第一版必须使用以下映射规则：

1. `tweet`
   `min(100, floor((likeCount * 1 + replyCount * 2 + retweetCount * 3) / 10))`
2. `github`
   `min(100, floor((starCount * 1 + forkCount * 2 + commentCount * 2) / 10))`
3. `reddit`
   `min(100, floor((score * 1 + commentCount * 2) / 10))`
4. `article` / `rss` / `website` / `json-feed`
   若无显式互动信号，则保持 `null`；不为了统一而虚构 engagement。

在所有需要比较 `engagementScore` 的地方，`null` 视为 `-1`，永远低于任何非空分值。

### 阶段 3：Drop Invalid Content

无法满足统一内容要求的数据直接丢弃：

1. `publishedAt` 缺失 -> 丢弃 + warn
2. 必填标题/URL 不成立 -> 丢弃 + warn

### 阶段 4：Topic Classify

围绕统一 `Content` 进行栏目分类：

1. 从 `Source.defaultTopicIds` 获取初始候选
2. 用 `Topic.includeRules` / `excludeRules` 过滤
3. 写入 `topicIds` 和 `topicScoresJson`

### 阶段 5：Deduplicate

对全类型统一内容进行去重：

1. 先按归一化 `url` 精确去重
2. 再按 `title + body` 做文本近似去重

#### 文本近似去重算法

第一版直接复用现有 `src/pipeline/dedupe-near.ts` 的核心思路，避免引入新的算法变量：

1. 比较文本为本节前文定义的 `dedupeText`
2. 先将 `dedupeText` 按空白切分成 token 数组；后续的预过滤、LCS 和 cluster 构建都基于 token，而不是字符
3. token 级预过滤：至少共享 1 个 token
4. 时间预过滤：`publishedAt` 相差不超过 24 小时
5. 相似度算法：SequenceMatcher 风格 ratio，具体为 `2 * LCS / (len(a) + len(b))`
6. 阈值固定为 `0.75`
7. near-dedup 必须按“构图 + 连通分量”方式执行，而不是单次顺序扫描：
   - 若 A≈B，B≈C，则 A/B/C 属于同一 duplicate cluster
   - 每个 cluster 只选一个 winner
   - winner 选择必须与输入顺序无关

这意味着第一版 near-dedup 是“复用现有 LCS / 0.75 阈值思路，但比较输入扩展为 title + body，并升级为顺序无关的 cluster-based 去重”。

#### 去重胜出规则

当多条内容被判定为同一条内容时，统一按以下顺序选择保留者：

1. `topicIds` 数量更多者优先
2. `Source.priority` 更高者优先
3. `engagementScore` 更高者优先
4. `publishedAt` 更新者优先
5. `fetchedAt` 更新者优先
6. 若仍相同，按 `id` 字典序稳定选一个

原因：

1. 优先保留对报表价值更高、topic 覆盖更广的版本
2. 规则完全确定，避免不同实现产生不同报表输入
3. 不依赖 AI 分数，保证 dedupe 阶段本身可独立运行

### 阶段 6：Archive Content

所有类型最终统一写入 `Content` 表，不再区分 `Item` / `Tweet` 双候选池。

### 阶段 7：Report Pipeline

日报/周报只从 `Content` 读取数据：

1. 按 topic 分组
2. 按统一评分排序
3. 做 AI 聚类、摘要和最终输出

## 迁移方向

本次目标是一步到位替换 `Item`：

1. 新建 `Content` 表并接手 `Item` 的职责
2. article collect pipeline 改为写 `Content`
3. X collect pipeline 也改为写 `Content`
4. 报表逻辑改为只消费 `Content`
5. 旧 `Item` 相关代码逐步删除

数据迁移上建议：

1. 现有 `Item` 数据迁移到 `Content(kind="article")`
2. 现有 `Tweet` 数据迁移到 `Content(kind="tweet")`
3. tweet 特有结构合并进 `metadataJson`
4. 迁移后日报/周报候选池只保留 `Content`

### 迁移矩阵

为避免 `Pack -> Topic` 和 `Item/Tweet -> Content` 边界不清，本次迁移按下表执行：

| 现有对象 | 新对象 | 迁移策略 |
|----------|--------|----------|
| `Pack` | `Topic` | 重命名并重定义；保留核心展示与过滤语义，字段改为 topic 语义 |
| `CustomViewPack` | `CustomViewTopic` | 关联表改名，继续表示自定义视图关联哪些 topic |
| `DailyReportConfig.packs` | `DailyReportConfig.topicIds` | 配置字段改名，表示日报启用哪些 topic |
| `Source.packId` | `Source.defaultTopicIds` | 单 pack 归属改为多 topic 默认候选；迁移时将旧 `packId` 转成单元素数组 |
| `Item.packId` | 删除 | `Content` 不再保存单 topic 归属，改由 `topicIds` 表达 |
| `Item` | `Content(kind=\"article\")` | 文章类候选统一迁入 `Content` |
| `Tweet` | `Content(kind=\"tweet\")` | 推文候选统一迁入 `Content`，tweet 专属结构写入 `metadataJson` |
| `app/api/packs/*` | `app/api/topics/*` | API 重命名并切换为 topic 语义 |
| `customView.packIds` 输入/输出 | `topicIds` | 前后端接口统一改名 |

### 报表存储迁移

统一 `Content` 后，报表持久化也同步收敛，不再保留 `itemIds` / `tweetIds` 双轨：

1. `DigestTopic.itemIds` 和 `DigestTopic.tweetIds` 替换为单个 `contentIds`
2. `WeeklyPick.itemId` 替换为 `contentId`
3. 数据迁移脚本负责：
   - 把原 `DigestTopic.itemIds` 映射到新的 `Content.id`
   - 把原 `DigestTopic.tweetIds` 映射到新的 `Content.id`
   - 合并写入 `contentIds`
   - 把 `WeeklyPick.itemId` 映射到新的 `contentId`
4. API 层、diagnostics、integrity checks、前端数据类型同步切换到 `contentIds`
5. 本次迁移不做长期 dual-write；在数据回填和 API 切换完成后，旧字段直接删除

这意味着“日报/周报只从 `Content` 读取数据”不仅是读取逻辑变化，也包含持久化结构本身的统一。

## 取舍说明

本设计有意不做以下事情：

1. 不保留 `Pack` 语义；统一改为 `Topic`
2. 不引入 `ContentDetail` 分表
3. 不引入 `ContentTopic` 关系表
4. 不把 topic 设计成复杂 DSL；第一版先使用简单关键词数组
5. 不要求 AI 成为 topic 分类主入口

这些取舍的目的都是先把统一内容主表和统一报表主干搭起来，避免一步到位时同时引入过多抽象。

## 后续实现重点

1. Prisma schema 迁移：`Item -> Content`，`Pack -> Topic`
2. 统一 TypeScript 类型：围绕 `Content.kind` 做 discriminated union
3. 统一 collect pipeline 输出：所有类型都归一为 `Content`
4. 统一 reports 输入：日报/周报只读取 `Content`
5. 迁移现有 X 和 article 数据，确保报表生成不中断
