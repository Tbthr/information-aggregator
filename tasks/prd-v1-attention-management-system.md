# PRD: 信息聚合器 v1 - 个人注意力管理系统

## 概述

将信息聚合器从"聚合工具"升级为"个人注意力管理系统"。v1 的核心目标是：

- **主入口**：Web 首页默认进入"日报"
- **个性化方式**：AI 优先，规则与 prompt 配置作为兜底
- **核心能力**：按来源类型采取不同处理策略，显式区分"过滤模式"和"阅读辅助模式"
- **范围覆盖**：统一策略框架、X 场景深化、日报/周报、Pack/来源双维度浏览

## 目标

- 建立统一的来源策略框架（Source Policy），让不同来源的处理模式可配置、可解释
- X 作为第一类完整样板，验证统一框架可行性
- Web 从"查询工具"升级为"日常消费入口"，首页默认日报
- 周报从"当下筛选"延伸到"持续洞察"

## 用户故事

### Phase 1: 策略层打底

#### US-001: 定义 SourcePolicy 类型与配置结构

**描述**：作为开发者，我需要定义统一的策略类型，让不同来源的处理行为可配置。

**Acceptance Criteria:**
- [ ] 在 `src/types/index.ts` 新增 `SourcePolicy` 类型定义
- [ ] 包含 `sourceMode`: `'assist_only' | 'filter_then_assist' | 'filter_only'`
- [ ] 包含 `sourceIntent`: `'trusted_curated' | 'semi_curated' | 'open_stream' | 'reference_archive'`
- [ ] 包含 `aiTasks`: `string[]` (relevance, value, actionability, one_line_summary, reading_hint)
- [ ] 包含 `uiSurface`: `('daily' | 'weekly' | 'pack' | 'source')[]`
- [ ] 类型检查通过

#### US-002: 定义 ContentDecision 类型（AI 判断结果）

**描述**：作为开发者，我需要定义 AI 判断结果的统一输出结构，供 API、Web、日报、周报复用。

**Acceptance Criteria:**
- [ ] 在 `src/types/index.ts` 新增 `ContentDecision` 类型
- [ ] 包含 `relevanceLabel`: `'high' | 'medium' | 'low'`
- [ ] 包含 `valueLabel`: `'high' | 'medium' | 'low'`
- [ ] 包含 `actionabilityLabel`: `'high' | 'medium' | 'low'`
- [ ] 包含 `keepDecision`: `'keep' | 'maybe' | 'drop'`
- [ ] 包含 `keepReason`: `string` (一句话说明为什么保留/过滤)
- [ ] 包含 `readerBenefit`: `string` (读它的收益)
- [ ] 包含 `readingHint`: `string` (建议怎么读)
- [ ] 包含 `confidence`: `'low' | 'medium' | 'high'`
- [ ] 类型检查通过

#### US-003: 扩展 Pack/Source 配置支持策略定义

**描述**：作为用户，我希望在 Pack 或 source 级别定义策略，而不是散落到 view 和 prompt 中。

**Acceptance Criteria:**
- [ ] 扩展 `config/load-pack.ts` 支持 `policy` 字段解析
- [ ] Pack 配置文件支持 `defaultPolicy` 字段
- [ ] Source 配置支持 `policy` 字段覆盖 Pack 默认值
- [ ] 来源级 `promptOverride` 支持（不影响默认策略）
- [ ] 配置加载单元测试通过

#### US-004: 建立来源类型到策略模式的默认映射

**描述**：作为开发者，我需要为每种来源类型建立默认策略映射，确保开箱即用。

**Acceptance Criteria:**
- [ ] 在 `src/config/` 新建 `default-policy-mapping.ts`
- [ ] `x_bookmarks` → `assist_only` (不过滤，只做阅读辅助)
- [ ] `x_home` → `filter_then_assist` (先过滤，再做阅读辅助)
- [ ] `x_list` → `filter_then_assist`
- [ ] `x_likes` → `assist_only` (视作弱书签)
- [ ] `x_user_tweets` / `x_search` → `filter_then_assist`
- [ ] 高质量 RSS / JSON Feed → 默认 `filter_then_assist`
- [ ] 提供查询接口 `getDefaultPolicy(sourceType: SourceType): SourcePolicy`
- [ ] 类型检查通过

#### US-005: 实现 AI 内容判断服务

**描述**：作为开发者，我需要实现 AI 内容判断服务，根据策略模式生成 ContentDecision。

**Acceptance Criteria:**
- [ ] 在 `src/ai/` 新建 `content-judge.ts`
- [ ] 实现 `judgeContent(item, policy): Promise<ContentDecision>`
- [ ] `assist_only` 模式：永不因 AI 被丢弃（keepDecision 永不为 drop）
- [ ] `filter_then_assist` 模式：正常生成 keep/maybe/drop
- [ ] 支持 prompt 模板注入（允许来源级覆盖）
- [ ] 支持并发控制（复用 `ai/concurrency.ts`）
- [ ] 单元测试通过

#### US-006: 将 ContentDecision 集成到 Enrichment 流程

**描述**：作为开发者，我需要将 AI 判断结果集成到现有 enrichment 流程中。

**Acceptance Criteria:**
- [ ] 修改 `src/pipeline/enrich.ts`，调用 `judgeContent`
- [ ] 将 `ContentDecision` 结果存储到 `AiEnrichmentResult`
- [ ] 保持向后兼容：无 AI 配置时系统仍能运行
- [ ] 现有 enrichment 测试不破坏
- [ ] 类型检查通过

#### US-007: 扩展 API 返回策略判断字段

**描述**：作为前端开发者，我需要 API 返回内容的策略判断字段和解释字段。

**Acceptance Criteria:**
- [ ] 修改 `src/api/routes/items.ts`，响应增加策略字段
- [ ] 条目级新增字段：`keepDecision`, `keepReason`, `readerBenefit`, `readingHint`, `relevanceLabel`, `valueLabel`, `actionabilityLabel`, `sourcePolicyMode`
- [ ] 来源级新增字段：`sourcePolicyMode`, `sourceIntent`, `keepRate`, `dailyRecommendedCount`
- [ ] API 类型定义同步更新（`frontend/src/types/api.ts`）
- [ ] 类型检查通过

#### US-008: 新增日报 API 端点

**描述**：作为前端开发者，我需要独立的日报 API，而不是用 items API 拼首页。

**Acceptance Criteria:**
- [ ] 在 `src/api/routes/` 新建 `daily.ts`
- [ ] 端点 `GET /api/daily` 返回日报数据
- [ ] 响应包含 `dailySummary`: 今日总体判断文案
- [ ] 响应包含 `leadStory`: 最值得读的 1 条内容
- [ ] 响应包含 `topSignals`: 必须看的内容列表（4-6 条）
- [ ] 响应包含 `scanBrief`: 可略读的内容列表（6-10 条）
- [ ] 响应包含 `saveForLater`: 收藏型内容列表
- [ ] 响应包含 `stats`: 已保留条目数、已过滤噪音数、高价值来源数
- [ ] 仅返回 `keepDecision` 为 `keep` 或 `maybe` 的内容
- [ ] 使用 `keepDecision + relevance + value` 排序
- [ ] 类型检查通过

#### US-009: 新增周报 API 端点

**描述**：作为前端开发者，我需要周报 API 支持主题聚合，而不是简单时间窗口拼接。

**Acceptance Criteria:**
- [ ] 在 `src/api/routes/` 新建 `weekly.ts`
- [ ] 端点 `GET /api/weekly` 返回周报数据
- [ ] 响应包含 `weeklySummary`: 本周总述
- [ ] 响应包含 `repeatedSignals`: 反复出现的话题（含出现次数、相关条目）
- [ ] 响应包含 `worthUnderstanding`: 值得系统理解的内容
- [ ] 响应包含 `sourceWatch`: 本周最有产出的来源
- [ ] 响应包含 `unresolvedQuestions`: 本周值得继续跟踪的问题
- [ ] 使用"重复出现主题 + 持续价值"聚合算法
- [ ] 类型检查通过

#### US-010: 新增来源视图 API 端点

**描述**：作为前端开发者，我需要来源视图 API 展示来源的策略和统计信息。

**Acceptance Criteria:**
- [ ] 在 `src/api/routes/` 新建 `sources.ts`
- [ ] 端点 `GET /api/sources/:sourceId` 返回来源详情
- [ ] 响应包含来源基础信息（名称、类型、所属 Pack、最近更新）
- [ ] 响应包含当前策略模式文案
- [ ] 响应包含来源定位说明（如"书签型高信号流，不参与过滤"）
- [ ] 响应包含关键统计（今日抓取数、保留率、高价值率、7 天稳定性）
- [ ] 响应包含该来源下的内容列表
- [ ] 支持查询参数 `includeFiltered=true` 显示被过滤内容及原因
- [ ] 类型检查通过

#### US-011: 新增 Pack 视图 API 扩展

**描述**：作为前端开发者，我需要 Pack API 返回策略摘要和来源分布信息。

**Acceptance Criteria:**
- [ ] 修改 `src/api/routes/packs.ts`
- [ ] Pack 列表响应增加 `policySummary` 字段（策略摘要文案）
- [ ] Pack 列表响应增加 `sourceDistribution` 字段（来源类型分布）
- [ ] Pack 详情端点 `GET /api/packs/:packId` 增加策略说明
- [ ] Pack 详情响应包含今日重点、本周持续话题、来源分布
- [ ] 类型检查通过

---

### Phase 2: X 场景深化

#### US-012: X Bookmarks 专用处理逻辑

**描述**：作为用户，我希望 x_bookmarks 内容不会被过滤，但会生成阅读建议。

**Acceptance Criteria:**
- [ ] `x_bookmarks` 默认使用 `assist_only` 模式
- [ ] 每条内容生成一句话总结
- [ ] 每条内容生成"对我的启发"
- [ ] 每条内容生成建议阅读动作
- [ ] `keepDecision` 永不为 `drop`
- [ ] 来源页展示"今日书签导读"标题
- [ ] 不出现"过滤掉了多少"作为主叙事
- [ ] 类型检查通过

#### US-013: X Home 过滤与解释链路

**描述**：作为用户，我希望 x_home 内容经过智能过滤，并能看到过滤理由。

**Acceptance Criteria:**
- [ ] `x_home` 默认使用 `filter_then_assist` 模式
- [ ] AI 判断"是否和我有关"和"是否值得现在读"
- [ ] 卡片层显示"为什么被保留"理由
- [ ] 被过滤内容可查看"为什么被过滤"
- [ ] 来源页展示"今日时间线筛选"标题
- [ ] 必须展示保留比例与过滤理由统计
- [ ] 类型检查通过

#### US-014: X List 主题化处理

**描述**：作为用户，我希望 x_list 作为半结构化高质量流，支持独立的主题偏好。

**Acceptance Criteria:**
- [ ] `x_list` 默认使用 `filter_then_assist` 模式
- [ ] 支持按 list 定义独立 prompt 或主题偏好
- [ ] 来源页展示"专题信号流"标题
- [ ] 强调主题密度和可跟踪价值
- [ ] 类型检查通过

#### US-015: X Likes 弱书签处理

**描述**：作为用户，我希望 x_likes 视作弱书签，默认不过滤但排序较低。

**Acceptance Criteria:**
- [ ] `x_likes` 默认使用 `assist_only` 模式
- [ ] 默认不过滤任何内容
- [ ] 在日报中的排序低于 bookmarks
- [ ] 来源页展示弱书签定位说明
- [ ] 类型检查通过

#### US-016: X Search/User Tweets 任务型来源处理

**Description**：作为用户，我希望 x_search 和 x_user_tweets 作为任务型来源，优先进入来源页和 Pack 页。

**Acceptance Criteria:**
- [ ] `x_search` / `x_user_tweets` 默认使用 `filter_then_assist` 模式
- [ ] 不默认进入日报头部
- [ ] 优先在来源页和 Pack 页展示
- [ ] 类型检查通过

#### US-017: 来源级 Prompt 覆盖机制

**描述**：作为用户，我希望能够为特定来源自定义 prompt，而不影响默认策略。

**Acceptance Criteria:**
- [ ] Source 配置支持 `promptOverride` 字段
- [ ] Prompt 覆盖仅影响该来源的 AI 判断
- [ ] 不影响其他来源
- [ ] 配置加载时校验 prompt 格式
- [ ] 无 promptOverride 时使用默认 prompt
- [ ] 类型检查通过

---

### Phase 3: 日报主入口（Web 重设计）

#### US-018: 引入前端路由系统

**描述**：作为开发者，我需要引入路由库支持多页面导航。

**Acceptance Criteria:**
- [ ] 安装 `react-router-dom` 依赖
- [ ] 配置 4 个一级路由：`/daily`, `/packs`, `/sources`, `/weekly`
- [ ] 根路径 `/` 重定向到 `/daily`
- [ ] 支持路由参数（packId, sourceId）
- [ ] 类型检查通过

#### US-019: 实现编辑部风格视觉系统

**描述**：作为用户，我希望 Web UI 采用"现代杂志 + 研究简报"的视觉语言。

**Acceptance Criteria:**
- [ ] 配置 Tailwind 字体组合（标题用衬线/窄体，正文用人文无衬线）
- [ ] 定义色彩变量：暖白底色、深墨黑主色、锈红/深蓝绿强调色
- [ ] 定义保留/存疑/过滤的编辑标记色
- [ ] 桌面端使用"不对称报刊网格"布局
- [ ] 背景加入轻微纸张纹理/噪点
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-020: 实现顶部导航组件

**描述**：作为用户，我希望通过顶部导航在 4 个一级视图间切换。

**Acceptance Criteria:**
- [ ] 新建 `TopNav.tsx` 组件
- [ ] 包含 4 个一级导航项：日报、Pack、来源、周报
- [ ] 当前激活项高亮显示
- [ ] 右侧保留全局搜索入口
- [ ] 桌面端导航放顶部，移动端用可滑动 tab
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-021: 实现日报首页 Hero 封面区

**描述**：作为用户，我希望日报首页首屏展示今日总体判断。

**Acceptance Criteria:**
- [ ] 新建 `DailyHero.tsx` 组件
- [ ] 左侧：今日标题，如"今天最值得读的 5 条信号"
- [ ] 中部：编辑导语，说明今日总体判断（使用 `dailySummary` API）
- [ ] 右侧：三枚摘要指标（已保留条目数、已过滤噪音数、高价值来源数）
- [ ] 组件使用编辑部视觉风格
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-022: 实现 Lead Story 主卡组件

**描述**：作为用户，我希望日报首页有一个突出的主卡展示最值得读的内容。

**Acceptance Criteria:**
- [ ] 新建 `LeadStoryCard.tsx` 组件
- [ ] 只展示 1 条最值得读内容（使用 `leadStory` API）
- [ ] 显示：标题、来源、时间、一句话总结、为什么值得看、建议怎么读
- [ ] 视觉上突出于其他卡片
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-023: 实现 Top Signals 栏目

**描述**：作为用户，我希望在日报中看到"必须看"的内容列表。

**Acceptance Criteria:**
- [ ] 新建 `SignalCard.tsx` 组件
- [ ] 展示 4-6 条"必须看"内容（使用 `topSignals` API）
- [ ] 竖向紧凑样式
- [ ] 突出保留理由和价值标签（`keepReason`, `valueLabel`）
- [ ] 显示 `relevanceLabel`, `actionabilityLabel`
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-024: 实现 Scan Brief 栏目

**描述**：作为用户，我希望在日报中看到"可略读"的内容列表。

**Acceptance Criteria:**
- [ ] 新建 `ScanBriefItem.tsx` 组件
- [ ] 展示 6-10 条"可略读"内容（使用 `scanBrief` API）
- [ ] 更轻量的条目样式，减少卡片重量
- [ ] 显示一句话总结和来源
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-025: 实现 Save For Later 栏目

**描述**：作为用户，我希望在日报中看到收藏型内容（如 x_bookmarks）。

**Acceptance Criteria:**
- [ ] 新建 `SaveForLaterSection.tsx` 组件
- [ ] 展示收藏型或辅助型内容（使用 `saveForLater` API）
- [ ] 承接 `x_bookmarks` 类型内容
- [ ] 显示阅读建议和启发
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-026: 实现日报侧边栏

**描述**：作为用户，我希望在日报侧边栏看到来源分布和主题簇。

**Acceptance Criteria:**
- [ ] 新建 `DailySidebar.tsx` 组件
- [ ] 展示今日来源分布
- [ ] 展示今日主题簇
- [ ] 周报预告入口
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-027: 实现 Reason Badge 组件

**描述**：作为用户，我希望在卡片层直接看到推荐/过滤原因。

**Acceptance Criteria:**
- [ ] 新建 `ReasonBadge.tsx` 组件
- [ ] 显示 `keepReason` (一句话说明)
- [ ] 显示 `readerBenefit` (读它的收益)
- [ ] 显示 `readingHint` (建议怎么读)
- [ ] 支持展开/收起
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-028: 实现 Decision Ribbon 组件

**描述**：作为用户，我希望通过视觉标记快速识别内容的保留状态。

**Acceptance Criteria:**
- [ ] 新建 `DecisionRibbon.tsx` 组件
- [ ] `keep` 状态：绿色/稳定编辑标记色
- [ ] `maybe` 状态：黄色/存疑编辑标记色
- [ ] `drop` 状态：灰色/过滤编辑标记色（仅在查看已过滤内容时显示）
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-029: 实现 Pack 视图页面

**描述**：作为用户，我希望按主题消费内容，了解 Pack 的策略和来源构成。

**Acceptance Criteria:**
- [ ] 新建 `PackView.tsx` 页面组件
- [ ] Pack 顶部封面：名称、简介、关键词、来源数
- [ ] 策略说明文案（如"该 Pack 对开放流采用强过滤"）
- [ ] 三栏目：今日重点、本周持续话题、来源分布
- [ ] 支持"仅看保留内容 / 查看全部 / 查看已过滤原因"切换
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-030: 实现来源视图页面

**描述**：作为用户，我希望按来源查看内容，了解该来源被如何对待。

**Acceptance Criteria:**
- [ ] 新建 `SourceView.tsx` 页面组件
- [ ] 来源头部：名称、类型、所属 Pack、最近更新、当前策略模式
- [ ] 来源定位文案（如"书签型高信号流，不参与过滤"）
- [ ] 关键统计：今日抓取数、保留率、高价值率、7 天稳定性
- [ ] `assist_only` 模式：默认展示全部，突出阅读建议
- [ ] `filter_then_assist` 模式：默认只展示保留条目，可展开查看被过滤内容
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-031: 实现次级筛选条

**描述**：作为用户，我希望通过次级筛选条快速过滤内容。

**Acceptance Criteria:**
- [ ] 新建 `FilterBar.tsx` 重构版
- [ ] 支持时间窗口切换
- [ ] 支持 Pack/来源选择
- [ ] 支持搜索
- [ ] 支持"是否显示已过滤内容"切换
- [ ] 桌面端吸顶，移动端收进 drawer
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-032: 废弃旧版侧边栏和首页

**描述**：作为开发者，我需要清理旧的 UI 结构。

**Acceptance Criteria:**
- [ ] 移除常驻左侧大筛选栏
- [ ] 移除单一流水式列表首页
- [ ] 保留 Sidebar 组件但重构为移动端 drawer
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

---

### Phase 4: 周报与长期沉淀

#### US-033: 实现周报封面区

**描述**：作为用户，我希望周报首页展示本周总体回顾。

**Acceptance Criteria:**
- [ ] 新建 `WeeklyHero.tsx` 组件
- [ ] 本周标题
- [ ] 一段总述（使用 `weeklySummary` API）
- [ ] 三个主题主张
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-034: 实现 Repeated Signals 栏目

**描述**：作为用户，我希望看到本周反复出现的话题。

**Acceptance Criteria:**
- [ ] 新建 `RepeatedSignals.tsx` 组件
- [ ] 展示反复出现的话题（使用 `repeatedSignals` API）
- [ ] 显示出现次数
- [ ] 显示相关条目列表
- [ ] 点击可跳转到相关内容
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-035: 实现 Worth Understanding 栏目

**描述**：作为用户，我希望看到值得系统理解而不是只扫过的内容。

**Acceptance Criteria:**
- [ ] 新建 `WorthUnderstanding.tsx` 组件
- [ ] 展示深度内容（使用 `worthUnderstanding` API）
- [ ] 强调内容价值和阅读收益
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-036: 实现 Source Watch 栏目

**描述**：作为用户，我希望看到本周最有产出的来源。

**Acceptance Criteria:**
- [ ] 新建 `SourceWatch.tsx` 组件
- [ ] 展示本周最有产出的来源（使用 `sourceWatch` API）
- [ ] 显示来源产出统计
- [ ] 可跳转到来源详情
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-037: 实现 Unresolved Questions 栏目

**描述**：作为用户，我希望看到本周值得继续跟踪的问题。

**Acceptance Criteria:**
- [ ] 新建 `UnresolvedQuestions.tsx` 组件
- [ ] 展示未解决问题（使用 `unresolvedQuestions` API）
- [ ] 显示问题来源和相关内容
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

#### US-038: 实现周报主题卡片

**描述**：作为用户，我希望周报以主题聚合形式展示，而不是单条内容罗列。

**Acceptance Criteria:**
- [ ] 新建 `WeeklyThemeCard.tsx` 组件
- [ ] 以主题为聚合单元
- [ ] 单条内容作为主题下的证据链存在
- [ ] 显示主题摘要和相关条目数量
- [ ] 类型检查通过
- [ ] 使用 chrome-cdp skill 在浏览器中验证

---

## 功能需求

### FR-1: 策略层

- FR-1.1: 系统必须支持三种来源模式：`assist_only`, `filter_then_assist`, `filter_only`
- FR-1.2: 系统必须支持四种来源意图：`trusted_curated`, `semi_curated`, `open_stream`, `reference_archive`
- FR-1.3: Pack 配置必须支持默认策略定义
- FR-1.4: Source 配置必须支持策略覆盖
- FR-1.5: Source 配置必须支持 prompt 覆盖
- FR-1.6: 系统必须为每种来源类型提供默认策略映射

### FR-2: AI 判断

- FR-2.1: AI 判断必须输出统一结构：`relevanceLabel`, `valueLabel`, `actionabilityLabel`, `keepDecision`, `keepReason`, `readerBenefit`, `readingHint`, `confidence`
- FR-2.2: `assist_only` 模式下，`keepDecision` 必须永不为 `drop`
- FR-2.3: `filter_then_assist` 模式下，`keepDecision` 可以为 `keep`, `maybe`, 或 `drop`
- FR-2.4: AI 判断结果必须存储到 enrichment 结果中
- FR-2.5: 无 AI 配置时，系统必须能够正常运行

### FR-3: API 层

- FR-3.1: Items API 响应必须包含策略判断字段
- FR-3.2: 系统必须提供 `/api/daily` 日报端点
- FR-3.3: 系统必须提供 `/api/weekly` 周报端点
- FR-3.4: 系统必须提供 `/api/sources/:sourceId` 来源详情端点
- FR-3.5: Pack API 必须返回策略摘要和来源分布

### FR-4: X 场景

- FR-4.1: `x_bookmarks` 必须使用 `assist_only` 模式，永不因 AI 被丢弃
- FR-4.2: `x_home` 必须使用 `filter_then_assist` 模式，展示过滤理由
- FR-4.3: `x_list` 必须支持独立的 prompt 或主题偏好
- FR-4.4: `x_likes` 必须使用 `assist_only` 模式，排序低于 bookmarks
- FR-4.5: `x_search` / `x_user_tweets` 不默认进入日报头部

### FR-5: Web UI

- FR-5.1: 首页必须默认进入日报
- FR-5.2: 导航必须包含 4 个一级视图：日报、Pack、来源、周报
- FR-5.3: 日报首页必须展示：Hero 封面、Lead Story、Top Signals、Scan Brief、Save For Later
- FR-5.4: 卡片层必须显示推荐解释（为什么推荐/为什么过滤）
- FR-5.5: Pack 视图必须展示策略说明和来源分布
- FR-5.6: 来源视图必须展示策略模式、统计信息、保留率

---

## 非目标

- **不引入用户账户系统**：v1 先服务单用户、本地优先
- **不做全自动黑盒裁决**：AI 判断以"辅助决策、可解释"为目标
- **不做复杂可视化图表**：首期优先把阅读结构、解释层和页面节奏做好
- **不做实时在线写回反馈系统**：用户偏好先由本地配置文件承载
- **不做 X 特化分叉架构**：在统一策略层上实现 X 场景

---

## 设计考虑

### 视觉方向

- **编辑部式设计**：现代杂志 + 研究简报的混合语言
- **字体**：标题用高辨识衬线/窄体，正文用耐读的人文无衬线
- **色彩**：暖白底色、深墨黑主色、锈红/深蓝绿强调色
- **版式**：桌面端使用不对称报刊网格，移动端单列纵向阅读流

### 组件体系

核心新组件：

- `EditorialShell` - 编辑部风格页面外壳
- `TopNav` - 顶部导航
- `DailyHero` - 日报封面区
- `LeadStoryCard` - 主卡
- `SignalCard` - 信号卡片
- `ReasonBadge` - 原因徽章
- `DecisionRibbon` - 决策丝带
- `SourceProfilePanel` - 来源档案面板
- `ThemeClusterPanel` - 主题簇面板
- `WeeklyThemeCard` - 周报主题卡片
- `FilterDrawer` - 过滤抽屉

---

## 技术考虑

### 后端

- **复用现有 pipeline**：不重做 adapter 层
- **复用现有 archive 与 query 体系**
- **依赖注入模式**：便于测试
- **向后兼容**：旧 pack 配置仍可加载并使用默认值

### 前端

- **复用现有 React + Vite + Tailwind 栈**
- **引入 react-router-dom** 支持多页面
- **保持无全局状态管理库**，使用 React 原生 hooks

### 数据库

- **复用现有 SQLite schema**
- **扩展 enrichment_results 表**：存储 ContentDecision 字段

---

## 成功指标

- **日报首页首屏无需滚动**就能看懂"今日重点 + 推荐原因 + 下一步入口"
- **x_bookmarks 卡片默认展示阅读建议**，而非过滤标签
- **x_home 卡片能直观看到"为何被保留"**
- **日报结果明显少于普通流**，形成"少而精"体验
- **周报页能展示主题聚合**，而不是普通列表换标题
- **当 AI 解释字段缺失时，UI 能平稳回退**到基础摘要和来源信息

---

## 测试计划

需要覆盖的验证场景：

### 策略层

- [ ] `x_bookmarks` 内容不会被过滤，但会生成阅读建议
- [ ] `x_home` 相同内容在过滤链路中可得到 `keep/maybe/drop`
- [ ] `assist_only` 与 `filter_then_assist` 输出结构一致，但行为不同
- [ ] 来源级 prompt 覆盖不会破坏默认策略
- [ ] 新增策略字段后，旧 pack 配置仍可加载并使用默认值
- [ ] 无 AI 配置时系统仍能运行，回退到 deterministic 排序与基础摘要

### API

- [ ] `/api/daily` 仅返回 `keep`/`maybe` 内容
- [ ] `/api/weekly` 主题聚合不只是时间窗口拼接
- [ ] Pack 视图与来源视图对同一条内容展示一致的解释字段

### Web UI

- [ ] 日报首页首屏无需滚动就能看懂今日重点
- [ ] Pack 页与来源页对同一内容的解释字段一致，不出现语义冲突
- [ ] 桌面端导航清晰，移动端不会因模块过多失控
- [ ] 当没有来源/没有结果时，空状态仍保留编辑部风格
- [ ] 颜色、字体、对比度满足基础可读性

---

## 开放问题

1. **周报聚合算法**：如何平衡"重复出现"和"持续价值"两个维度？
2. **AI 判断置信度阈值**：`low confidence` 的判断是否应该降级处理？
3. **移动端响应式优先级**：是否需要在 Phase 3 同时完成移动端适配？
4. **主题提取策略**：使用现有 tags 还是引入新的主题模型？

---

## 实施计划

### Phase 1: 策略层打底（US-001 ~ US-011）

- 建立统一来源策略框架
- 定义 AI 判断输出结构
- 扩展配置和 API

### Phase 2: X 深化落地（US-012 ~ US-017）

- 打通 X 场景差异化体验
- 验证统一框架可行性

### Phase 3: 日报主入口（US-018 ~ US-032）

- 重构 Web 信息组织
- 实现编辑部式 UI

### Phase 4: 周报与长期沉淀（US-033 ~ US-038）

- 周报视图实现
- 主题聚合算法

---

## 附录

### 现有代码库关键文件

| 模块 | 关键文件 |
|------|---------|
| 类型定义 | `src/types/index.ts` |
| Pipeline 入口 | `src/query/run-query.ts` |
| API Server | `src/api/server.ts` |
| Enrichment | `src/pipeline/enrich.ts` |
| AI Client | `src/ai/providers/index.ts` |
| Pack 配置加载 | `src/config/load-pack.ts` |
| 前端入口 | `frontend/src/App.tsx` |
| 前端类型 | `frontend/src/types/api.ts` |

### 配置示例

```yaml
# Pack 配置扩展示例
pack:
  id: tech-news
  name: 科技资讯聚合
  defaultPolicy:
    sourceMode: filter_then_assist
    sourceIntent: semi_curated
    aiTasks: [relevance, value, actionability, one_line_summary, reading_hint]
    uiSurface: [daily, weekly, pack]

sources:
  - type: x_bookmarks
    policy:
      sourceMode: assist_only  # 覆盖默认值
    promptOverride: |
      这是我收藏的内容，请分析它对我的启发...
```
