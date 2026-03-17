---
spec: v1-editorial-redesign
phase: requirements
created: 2026-03-17
---

# Requirements: Editorial Redesign v1

## Goal

将信息聚合器从"聚合工具"升级为"编辑部式个人注意力管理系统"，通过来源策略框架 + AI 判断解释 + 四大视图系统，让用户更高效地筛选和消费信息。

## User Stories

### US-1: 配置来源策略模式
**As a** 内容策展人
**I want to** 为每个来源配置策略模式（assist_only / filter_then_assist）
**So that** 不同来源的内容根据信任度获得差异化处理

**Acceptance Criteria:**
- [ ] AC-1.1: Pack YAML 支持 `policy.mode` 字段，可选值 `assist_only` | `filter_then_assist`
- [ ] AC-1.2: 来源级可覆盖 Pack 级策略（source.policy 覆盖 pack.policy）
- [ ] AC-1.3: 新来源默认 `filter_then_assist`
- [ ] AC-1.4: `assist_only` 模式：所有内容保留，AI 仅做增强（keyPoints/tags/summary）
- [ ] AC-1.5: `filter_then_assist` 模式：AI 先判断是否保留，再做增强

**Priority: P0**

### US-2: 查看 AI 过滤判断解释
**As a** 用户
**I want to** 看到每条内容为何被推荐/过滤
**So that** 理解决策逻辑，建立信任

**Acceptance Criteria:**
- [ ] AC-2.1: `filter_then_assist` 模式下，每个 item 包含 `keepDecision: boolean`
- [ ] AC-2.2: 每个 item 包含 `keepReason: string`（1-2 句判断理由）
- [ ] AC-2.3: 保留的 item 包含 `readerBenefit: string`（阅读价值）
- [ ] AC-2.4: 保留的 item 包含 `readingHint: string`（阅读建议，如"3分钟速读"）
- [ ] AC-2.5: API 响应中返回上述字段，前端卡片层可见

**Priority: P0**

### US-3: 使用日报首页
**As a** 日常用户
**I want to** 打开 Web UI 即看到今日精选内容
**So that** 快速获取最重要的信息，无需筛选

**Acceptance Criteria:**
- [ ] AC-3.1: `/` 路由显示日报首页，非旧版列表页
- [ ] AC-3.2: 日报首页包含 5 个模块：Cover Story、Lead Story、Top Signals、Scan Brief、Save For Later
- [ ] AC-3.3: Cover Story：1 篇，大卡片展示，含 readerBenefit
- [ ] AC-3.4: Lead Story：3 篇，中等卡片，含 readingHint
- [ ] AC-3.5: Top Signals：5-10 条，紧凑卡片，含 keepReason 标签
- [ ] AC-3.6: Scan Brief：标题列表，含来源和发布时间
- [ ] AC-3.7: Save For Later：用户保存的内容，含添加时间

**Priority: P0**

### US-4: 浏览 Pack 策展视图
**As a** 关注特定主题的用户
**I want to** 查看 Pack 的策展视图
**So that** 理解该主题的来源构成和今日代表内容

**Acceptance Criteria:**
- [ ] AC-4.1: `/pack/:id` 路由显示 Pack 策展视图
- [ ] AC-4.2: 显示 Pack 策略摘要（策略模式、来源数量、保留率）
- [ ] AC-4.3: 显示来源构成饼图/列表（类型分布）
- [ ] AC-4.4: 显示今日代表内容（3-5 条高质量内容）
- [ ] AC-4.5: 显示本周趋势（标签云/主题聚合）
- [ ] AC-4.6: 支持切换到传统列表视图

**Priority: P0**

### US-5: 查看来源视图
**As a** 来源管理员
**I want to** 查看单个来源的策略和效果
**So that** 评估来源质量，调整策略

**Acceptance Criteria:**
- [ ] AC-5.1: `/source/:id` 路由显示来源视图
- [ ] AC-5.2: 显示来源元信息（类型、URL、描述、所属 Pack）
- [ ] AC-5.3: 显示策略模式（assist_only / filter_then_assist）
- [ ] AC-5.4: 显示保留率（近 7 天）
- [ ] AC-5.5: 显示过滤理由分布（如"低相关性"、"时效过期"）
- [ ] AC-5.6: 显示最近 10 条内容，含 keepDecision 和 keepReason

**Priority: P1**

### US-6: 阅读周报回顾
**As a** 定期回顾用户
**I want to** 查看本周内容汇总
**So that** 回顾一周重要内容，发现遗漏

**Acceptance Criteria:**
- [ ] AC-6.1: `/weekly` 路由显示周报视图
- [ ] AC-6.2: 固定 7 天滚动窗口（今天 - 7 天 到今天）
- [ ] AC-6.3: 显示本周概览（总内容数、保留数、平均质量分）
- [ ] AC-6.4: 显示主题聚合（AI 生成的 3-5 个主题）
- [ ] AC-6.5: 每个主题下显示 3-5 条代表内容
- [ ] AC-6.6: 显示本周编辑精选（人为保存的内容）

**Priority: P1**

### US-7: 保存内容稍后阅读
**As a** 用户
**I want to** 标记内容为"稍后阅读"
**So that** 保留重要内容不被信息流冲走

**Acceptance Criteria:**
- [ ] AC-7.1: 每个 item 卡片有"Save"按钮
- [ ] AC-7.2: 点击后保存到后端数据库（archive.db）
- [ ] AC-7.3: 保存状态在页面刷新后保持
- [ ] AC-7.4: 可在 Save For Later 模块查看已保存内容
- [ ] AC-7.5: 支持取消保存
- [ ] AC-7.6: 保存内容包含：itemId、保存时间、来源 Pack

**Priority: P0**

### US-8: X 场景差异化处理
**As a** X(Twitter) 用户
**I want to** 不同 X 来源获得不同处理
**So that** 首页、列表、书签内容按场景区分

**Acceptance Criteria:**
- [ ] AC-8.1: `x_bookmarks` 默认 `assist_only`（用户主动收藏）
- [ ] AC-8.2: `x_home` 默认 `filter_then_assist`（信息流噪音高）
- [ ] AC-8.3: `x_list` 默认 `filter_then_assist`（用户精选但仍需过滤）
- [ ] AC-8.4: X 帖子类型内容显示 engagement（点赞/转发/评论）
- [ ] AC-8.5: X 内容保留原始链接和展开链接

**Priority: P1**

## Functional Requirements

### FR-1: 数据模型扩展

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.1 | SourcePack 增加 policy 字段 | P0 | YAML 加载支持 policy.mode，默认 filter_then_assist |
| FR-1.2 | InlineSource 支持 policy 覆盖 | P0 | source.policy 覆盖 pack.policy |
| FR-1.3 | AiEnrichmentResult 扩展判断字段 | P0 | 新增 keepDecision, keepReason, readerBenefit, readingHint |
| FR-1.4 | 新增 SavedItem 表 | P0 | SQLite 表存储 itemId, savedAt, packId |

### FR-2: Pipeline 策略过滤阶段

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.1 | 新增 policy_filter 阶段 | P0 | 在 rank 阶段前执行 |
| FR-2.2 | assist_only 模式跳过过滤 | P0 | 所有 item 的 keepDecision = true |
| FR-2.3 | filter_then_assist 调用 AI 判断 | P0 | 批量调用，返回 keepDecision + keepReason |
| FR-2.4 | 判断结果持久化 | P1 | 存储到 enrichment 表，避免重复计算 |

### FR-3: API 端点扩展

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.1 | 新增 GET /api/views/daily-brief | P0 | 返回日报首页所需数据结构 |
| FR-3.2 | 扩展 GET /api/packs/:id | P0 | 返回策略摘要、来源构成、代表内容 |
| FR-3.3 | 新增 GET /api/sources/:id | P1 | 返回来源视图数据 |
| FR-3.4 | 新增 GET /api/views/weekly-review | P1 | 返回周报数据（7天滚动） |
| FR-3.5 | 新增 POST /api/items/:id/save | P0 | 保存 item 到 saved_items 表 |
| FR-3.6 | 新增 DELETE /api/items/:id/save | P0 | 取消保存 |
| FR-3.7 | 新增 GET /api/saved | P0 | 获取已保存列表 |
| FR-3.8 | GET /api/items 返回策略字段 | P0 | item 包含 keepDecision, keepReason, readerBenefit, readingHint |

### FR-4: 前端视图系统

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-4.1 | 新增 DailyBriefPage 组件 | P0 | 实现 5 模块布局 |
| FR-4.2 | 新增 PackViewPage 组件 | P0 | 策展视图，含统计图表 |
| FR-4.3 | 新增 SourceViewPage 组件 | P1 | 来源详情和过滤统计 |
| FR-4.4 | 新增 WeeklyReviewPage 组件 | P1 | 周报回顾 |
| FR-4.5 | 新增 ItemCardWithReason 组件 | P0 | 显示 keepReason/readerBenefit |
| FR-4.6 | 新增 SaveButton 组件 | P0 | 保存/取消保存功能 |
| FR-4.7 | 路由配置更新 | P0 | `/` → DailyBrief, `/pack/:id` → PackView, etc. |

### FR-5: AI Prompt 扩展

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-5.1 | 新增 filter-then-assist prompt | P0 | 输入 item，输出 keepDecision + keepReason + readerBenefit + readingHint |
| FR-5.2 | prompt 模板可配置 | P1 | 支持 config/prompts/ 覆盖 |
| FR-5.3 | 批量判断优化 | P1 | 单次请求处理多个 item |

## Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-1 | 日报首页加载时间 | P95 latency | < 500ms |
| NFR-2 | AI 判断延迟 | 单 item | < 2s |
| NFR-3 | 批量判断吞吐 | 10 items | < 5s |
| NFR-4 | 前端包大小 | gzip | < 200KB |
| NFR-5 | API 响应格式 | JSON Schema | 符合 OpenAPI 规范 |
| NFR-6 | 向后兼容 | 配置文件 | 旧 Pack YAML 仍可加载 |
| NFR-7 | 数据库迁移 | 自动迁移 | 启动时自动添加新表/字段 |

## Glossary

| Term | Definition |
|------|------------|
| **Source Policy** | 来源处理策略，决定是否启用 AI 过滤 |
| **assist_only** | 策略模式：所有内容保留，AI 仅做增强 |
| **filter_then_assist** | 策略模式：AI 先判断保留，再做增强 |
| **keepDecision** | AI 判断结果：是否保留该内容 |
| **keepReason** | AI 判断理由：为何保留/过滤 |
| **readerBenefit** | 阅读价值：该内容对用户的价值 |
| **readingHint** | 阅读建议：如何高效阅读（如"速读3分钟"） |
| **Cover Story** | 封面故事：日报首页最重要的一条内容 |
| **Lead Story** | 领衔故事：仅次于封面的 3 条重要内容 |
| **Top Signals** | 热点信号：快速浏览的 5-10 条内容 |
| **Scan Brief** | 扫描简报：标题列表，含来源和时间 |
| **Save For Later** | 稍后阅读：用户主动保存的内容 |
| **Source Pack** | 来源包：一组相关来源的集合 |

## Out of Scope

- 用户认证系统（单用户场景）
- 移动端原生 App
- 内容全文阅读器（仅展示摘要和链接）
- 社交分享功能
- AI 问答/对话功能
- 自定义策略规则（仅预设两种模式）
- 多语言支持
- 实时推送通知
- 离线模式

## Dependencies

### 技术依赖
- React 18+ (已满足)
- Tailwind CSS 3+ (已满足)
- Bun runtime (已满足)
- SQLite 3 (已满足)
- AI Provider API (OpenAI/Anthropic/Gemini，已有 client)

### 数据依赖
- 现有 pipeline 输出（raw_items, normalized_items）
- 现有 Pack 配置文件
- 现有 AI enrichment 数据

### 外部依赖
- 无新增外部服务依赖

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| 首页加载时间 | < 500ms | P95 latency |
| 用户保存率 | > 5% items | saved_items / total_items |
| 过滤准确率 | > 80% 用户认同 | keepDecision 与用户行为一致性 |
| 周活跃使用 | > 3 次/周 | 周报页面访问 |
| 来源覆盖 | 100% 配置来源 | 所有 source 可访问来源视图 |

## Verification Methods

### 前端页面验证（chrome-cdp）

以下 AC 需要通过 `chrome-cdp` skill 操作浏览器进行验证：

| AC ID | 验证步骤 |
|-------|---------|
| AC-3.1 ~ AC-3.7 | 1. 启动前端服务 `cd frontend && bun dev` 2. 使用 chrome-cdp 导航到 `http://localhost:5173/` 3. 检查 5 个模块 DOM 结构 4. 验证各模块内容展示 |
| AC-4.1 ~ AC-4.6 | 1. 导航到 `http://localhost:5173/pack/:id` 2. 检查策略摘要、来源构成、代表内容 3. 验证列表视图切换 |
| AC-5.1 ~ AC-5.6 | 1. 导航到 `http://localhost:5173/source/:id` 2. 检查来源信息、策略模式、保留率 3. 验证过滤理由分布 |
| AC-6.1 ~ AC-6.6 | 1. 导航到 `http://localhost:5173/weekly` 2. 检查周报概览、主题聚合、编辑精选 |
| AC-7.1 | 1. 在任意卡片上检查 Save 按钮存在 |
| AC-7.3 | 1. 点击 Save 2. 刷新页面 3. 检查保存状态保持 |
| AC-7.4 | 1. 导航到日报首页 2. 检查 Save For Later 模块有已保存内容 |
| AC-7.5 | 1. 点击已保存内容的取消按钮 2. 验证从 Save For Later 移除 |

### 验证命令示例

```bash
# 启动服务
bun src/cli/main.ts serve &
cd frontend && bun dev &

# 使用 chrome-cdp 验证（在 Claude Code 中）
# /chrome-cdp 然后导航到 http://localhost:5173/
```

### API 验证（curl）

| AC ID | 验证命令 |
|-------|---------|
| AC-2.1 ~ AC-2.5 | `curl http://localhost:3000/api/items | jq '.[0] \| {keepDecision, keepReason, readerBenefit, readingHint}'` |
| AC-3.1 (API) | `curl http://localhost:3000/api/views/daily-brief` |
| AC-4.2 (API) | `curl http://localhost:3000/api/packs/:id` |
| AC-7.2 | `curl -X POST http://localhost:3000/api/items/:id/save` |

## Unresolved Questions

1. **过滤内容存储**：被过滤的内容是否持久化？如需展示"过滤统计"，需保留被过滤数据
2. **AI 判断缓存**：同一内容多次判断是否缓存？缓存 TTL 如何设置？
3. **主题聚合算法**：周报的主题聚合是基于 tags 聚类还是 AI 生成？
4. **保留率计算窗口**：固定 7 天还是可配置？

## Next Steps

1. 用户确认需求文档，特别是 Unresolved Questions
2. 创建技术设计文档（technical-design.md）
3. Phase 1 实现：日报首页 + Pack 视图 + Save For Later + 策略字段
4. Phase 2 实现：来源视图 + 周报视图 + 统计聚合
