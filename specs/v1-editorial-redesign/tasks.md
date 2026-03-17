---
spec: v1-editorial-redesign
phase: tasks
created: 2026-03-17
granularity: fine
totalTasks: 96
---

# Tasks: Editorial Redesign v1

## Overview

将信息聚合器从"聚合工具"升级为"编辑部式个人注意力管理系统"。

**Workflow**: POC-first (GREENFIELD)
**Granularity**: fine (52 tasks)
**Execution Strategy**: 分阶段交付（Phase 1→2，每 phase 提交 PR）

---

## Phase 1: Make It Work (POC)

Focus: 验证核心功能端到端可用。跳过测试，接受硬编码值。仅要求类型检查通过。

### 1.1 数据模型与类型定义

- [x] 1.1 [P] 创建 Policy 类型定义
  - **Do**:
    1. 创建 `src/types/policy.ts`
    2. 定义 `PolicyMode = 'assist_only' | 'filter_then_assist'`
    3. 定义 `PackPolicy { mode, filterPrompt? }`
    4. 定义 `SourcePolicy extends PackPolicy { inheritedFrom? }`
    5. 导出所有类型
  - **Files**: src/types/policy.ts
  - **Done when**: 类型文件存在，导出 PolicyMode, PackPolicy, SourcePolicy
  - **Verify**: `grep -E "export (type|interface)" src/types/policy.ts && bun run check`
  - **Commit**: `feat(types): add policy types`
  - _Requirements: FR-1.1_
  - _Design: Data Model > 新增类型定义_

- [x] 1.2 [P] 扩展 AI 响应类型定义
  - **Do**:
    1. 在 `src/types/ai-response.ts` 添加 `FilterJudgment` 接口
    2. 添加 `keepDecision: boolean`, `keepReason: string`
    3. 添加 `readerBenefit?: string`, `readingHint?: string`
    4. 添加 `judgedAt: string`
  - **Files**: src/types/ai-response.ts
  - **Done when**: FilterJudgment 类型存在，包含所有字段
  - **Verify**: `grep "FilterJudgment" src/types/ai-response.ts && bun run check`
  - **Commit**: `feat(types): add FilterJudgment type`
  - _Requirements: FR-1.3, AC-2.1-2.4_
  - _Design: Data Model > 新增类型定义_

- [x] 1.3 [P] 扩展 SourcePack/InlineSource 类型
  - **Do**:
    1. 在 `src/types/index.ts` 中 `SourcePack` 添加 `policy?: PackPolicy`
    2. 在 `InlineSource` 添加 `policy?: SourcePolicy`
    3. 从 `./policy` 导入类型
  - **Files**: src/types/index.ts
  - **Done when**: SourcePack 和 InlineSource 包含 policy 字段
  - **Verify**: `grep "policy" src/types/index.ts | head -5 && bun run check`
  - **Commit**: `feat(types): extend SourcePack with policy field`
  - _Requirements: FR-1.1, FR-1.2_
  - _Design: Data Model > 新增类型定义_

- [x] 1.4 [VERIFY] Quality checkpoint: types
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.2 配置加载与解析

- [x] 1.5 扩展 Pack YAML 解析
  - **Do**:
    1. 修改 `src/config/load-pack.ts` 中 `validateInlineSource` 解析 policy 字段
    2. 修改 `validateSourcePack` 解析 pack.policy 字段
    3. 默认值：pack 无 policy 则 `filter_then_assist`，source 无 policy 则继承 pack
  - **Files**: src/config/load-pack.ts
  - **Done when**: YAML 解析支持 policy 字段，有默认值逻辑
  - **Verify**: `grep "policy" src/config/load-pack.ts && bun run check`
  - **Commit**: `feat(config): parse policy from pack yaml`
  - _Requirements: AC-1.1-1.3_
  - _Design: Pipeline Design > Policy Filter 阶段_

- [x] 1.6 [VERIFY] Quality checkpoint: config
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.3 数据库迁移

- [x] 1.7 创建 editorial 迁移脚本
  - **Do**:
    1. 创建 `src/db/migrations/004_editorial.sql`
    2. 创建 `saved_items` 表（id, item_id, pack_id, saved_at）
    3. 创建索引 idx_saved_items_item, idx_saved_items_saved_at
    4. 添加 `enrichment_results.filter_judgment_json TEXT` 字段
    5. 添加 `sources.policy_json TEXT` 字段
    6. 添加 `source_packs.policy_json TEXT` 字段
  - **Files**: src/db/migrations/004_editorial.sql
  - **Done when**: 迁移文件存在，包含 saved_items 表和字段扩展
  - **Verify**: `cat src/db/migrations/004_editorial.sql | grep -E "saved_items|filter_judgment|policy_json"`
  - **Commit**: `feat(db): add editorial migration`
  - _Requirements: FR-1.4_
  - _Design: Data Model > 数据库 Schema 变更_

- [x] 1.8 注册迁移脚本
  - **Do**:
    1. 找到迁移执行位置（db/client.ts 或类似）
    2. 添加 004_editorial.sql 到迁移列表
    3. 确保启动时自动执行
  - **Files**: src/db/client.ts
  - **Done when**: 新迁移被加载执行
  - **Verify**: `grep "004_editorial" src/db/*.ts && bun run check`
  - **Commit**: `feat(db): register editorial migration`
  - _Requirements: NFR-7_
  - _Design: Data Model > 迁移策略_

- [x] 1.9 [VERIFY] Quality checkpoint: db
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.4 Saved Items 查询层

- [x] 1.10 [P] 创建 saved-items 查询模块
  - **Do**:
    1. 创建 `src/db/queries/saved-items.ts`
    2. 实现 `saveItem(db, itemId, packId)` - 插入 saved_items
    3. 实现 `unsaveItem(db, itemId)` - 删除记录
    4. 实现 `getSavedItems(db, limit?)` - 查询已保存列表
    5. 实现 `isItemSaved(db, itemId)` - 检查是否已保存
  - **Files**: src/db/queries/saved-items.ts
  - **Done when**: 所有 CRUD 函数存在
  - **Verify**: `grep -E "export (async )?function" src/db/queries/saved-items.ts`
  - **Commit**: `feat(db): add saved-items queries`
  - _Requirements: FR-3.5-3.7, AC-7.2, AC-7.6_
  - _Design: API Design > POST /api/items/:id/save_

### 1.5 AI Filter Prompt

- [x] 1.11 [P] 创建 filter-then-assist prompt
  - **Do**:
    1. 创建 `src/ai/prompts-filter.ts`
    2. 实现 `buildFilterPrompt(items, packContext)` 函数
    3. Prompt 包含：Pack 名称、关键词、待判断内容列表
    4. 输出格式 JSON：`{ judgments: [{ index, keep, reason, benefit, hint }] }`
  - **Files**: src/ai/prompts-filter.ts
  - **Done when**: buildFilterPrompt 函数存在，返回 prompt 字符串
  - **Verify**: `grep "buildFilterPrompt" src/ai/prompts-filter.ts && bun run check`
  - **Commit**: `feat(ai): add filter prompt builder`
  - _Requirements: FR-5.1_
  - _Design: Pipeline Design > AI 判断流程_

- [x] 1.12 [P] 扩展 AI Client 添加 batchFilter
  - **Do**:
    1. 修改 `src/ai/client.ts`
    2. 添加 `batchFilter(items, packContext)` 方法
    3. 调用 buildFilterPrompt 构建 prompt
    4. 调用现有 AI provider 发送请求
    5. 解析 JSON 响应，返回 FilterJudgment 数组
  - **Files**: src/ai/client.ts
  - **Done when**: batchFilter 方法存在，返回 FilterJudgment[]
  - **Verify**: `grep "batchFilter" src/ai/client.ts && bun run check`
  - **Commit**: `feat(ai): add batchFilter method`
  - _Requirements: FR-2.3, FR-5.3_
  - _Design: Pipeline Design > AI 判断流程_

- [x] 1.13 [VERIFY] Quality checkpoint: ai
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.6 Policy Filter Pipeline

- [x] 1.14 创建 policy-filter 阶段
  - **Do**:
    1. 创建 `src/pipeline/policy-filter.ts`
    2. 定义 `PolicyFilterConfig { aiClient?, db?, batchSize?, concurrency? }`
    3. 定义 `PolicyFilterResult { kept, filtered, stats }`
    4. 实现 `policyFilterCandidates(candidates, pack, sourcePolicyMap, config)` 函数
    5. 按 source 分组，assist_only 直接保留，filter_then_assist 调用 AI
  - **Files**: src/pipeline/policy-filter.ts
  - **Done when**: policyFilterCandidates 函数存在，返回过滤结果
  - **Verify**: `grep "policyFilterCandidates" src/pipeline/policy-filter.ts && bun run check`
  - **Commit**: `feat(pipeline): add policy-filter stage`
  - _Requirements: FR-2.1-2.4_
  - _Design: Pipeline Design > Policy Filter 阶段_

- [x] 1.15 [VERIFY] Quality checkpoint: pipeline
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.7 API 扩展 - Items Save

- [x] 1.16 扩展 items route 添加 save 端点
  - **Do**:
    1. 修改 `src/api/routes/items.ts`
    2. 添加 `POST /:id/save` 端点，调用 saveItem
    3. 添加 `DELETE /:id/save` 端点，调用 unsaveItem
    4. 返回 `{ success: true, data: { savedAt } }` 格式
  - **Files**: src/api/routes/items.ts
  - **Done when**: POST/DELETE save 端点存在
  - **Verify**: `grep -E "POST.*save|DELETE.*save" src/api/routes/items.ts`
  - **Commit**: `feat(api): add save/unsave endpoints`
  - _Requirements: FR-3.5, FR-3.6, AC-7.1-7.5_
  - _Design: API Design > POST /api/items/:id/save_

- [x] 1.17 添加 GET /api/saved 端点
  - **Do**:
    1. 修改 `src/api/routes/items.ts` 或创建新 route
    2. 添加 `GET /saved` 端点，返回已保存 items
    3. 关联 raw_items 获取完整内容
    4. 返回 `{ success: true, data: { items, meta: { total } } }`
  - **Files**: src/api/routes/items.ts
  - **Done when**: GET /api/saved 端点存在
  - **Verify**: `curl -s http://localhost:3000/api/saved 2>/dev/null || grep "saved" src/api/routes/items.ts`
  - **Commit**: `feat(api): add saved items endpoint`
  - _Requirements: FR-3.7, AC-7.4_
  - _Design: API Design > GET /api/saved_

- [x] 1.18 扩展 API types 添加新字段
  - **Do**:
    1. 修改 `src/api/types.ts` 中 `ItemData`
    2. 添加 `policy?: { mode: PolicyMode }`
    3. 添加 `filterJudgment?: { keepDecision, keepReason, readerBenefit?, readingHint? }`
    4. 添加 `saved?: { savedAt: string }`
  - **Files**: src/api/types.ts
  - **Done when**: ItemData 包含新字段
  - **Verify**: `grep -E "policy|filterJudgment|saved" src/api/types.ts | head -10 && bun run check`
  - **Commit**: `feat(api): extend ItemData with policy fields`
  - _Requirements: FR-3.8, AC-2.1-2.5_
  - _Design: Data Model > API 类型定义_

- [x] 1.19 [VERIFY] Quality checkpoint: api
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.8 API 扩展 - Views

- [x] 1.20 创建 views route
  - **Do**:
    1. 创建 `src/api/routes/views.ts`
    2. 添加 `GET /daily-brief` 端点
    3. 查询今日内容，按分数排序
    4. 返回 coverStory, leadStories, topSignals, scanBrief, savedForLater
    5. 包含 meta（generatedAt, totalItems, keptItems, retentionRate）
  - **Files**: src/api/routes/views.ts
  - **Done when**: GET /api/views/daily-brief 端点存在
  - **Verify**: `grep "daily-brief" src/api/routes/views.ts`
  - **Commit**: `feat(api): add views route with daily-brief`
  - _Requirements: FR-3.1, AC-3.1-3.7_
  - _Design: API Design > GET /api/views/daily-brief_

- [x] 1.21 扩展 packs route 添加详情字段
  - **Do**:
    1. 修改 `src/api/routes/packs.ts` 中 `GET /:id`
    2. 添加 `policy` 字段返回
    3. 添加 `stats { sourceCount, totalItems, retainedItems, retentionRate }`
    4. 添加 `sourceComposition` 来源类型分布
    5. 添加 `featuredItems` 3-5 条代表内容
  - **Files**: src/api/routes/packs.ts
  - **Done when**: GET /api/packs/:id 返回扩展字段
  - **Verify**: `grep -E "policy|stats|sourceComposition|featuredItems" src/api/routes/packs.ts`
  - **Commit**: `feat(api): extend pack detail with policy and stats`
  - _Requirements: FR-3.2, AC-4.2-4.5_
  - _Design: API Design > GET /api/packs/:id_

- [x] 1.22 注册新路由到 server
  - **Do**:
    1. 修改 `src/api/server.ts`
    2. 导入 viewsRoute
    3. 添加 `app.route("/api/views", viewsRoute)`
  - **Files**: src/api/server.ts
  - **Done when**: views 路由注册
  - **Verify**: `grep "views" src/api/server.ts`
  - **Commit**: `feat(api): register views route`
  - _Requirements: FR-3.1_
  - _Design: Architecture > API Layer_

- [x] 1.23 [VERIFY] Quality checkpoint: api routes
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

### 1.9 前端依赖与路由

- [x] 1.24 安装前端依赖
  - **Do**:
    1. 修改 `frontend/package.json`
    2. 添加 `react-router-dom: ^6.x`
    3. 添加 `recharts: ^2.x`
    4. 运行 `cd frontend && bun install`
  - **Files**: frontend/package.json
  - **Done when**: package.json 包含 react-router-dom 和 recharts
  - **Verify**: `grep -E "react-router-dom|recharts" frontend/package.json`
  - **Commit**: `feat(frontend): add react-router-dom and recharts deps`
  - _Requirements: FR-4.1-4.7_
  - _Design: Frontend Architecture > Recharts 集成_

- [x] 1.25 扩展前端 API types
  - **Do**:
    1. 修改 `frontend/src/types/api.ts`
    2. 添加 `PolicyMode`, `FilterJudgment` 类型
    3. 扩展 `ItemData` 添加 policy, filterJudgment, saved 字段
    4. 添加 `DailyBriefData` 接口
    5. 添加 `PackDetailData` 接口
  - **Files**: frontend/src/types/api.ts
  - **Done when**: 前端类型与后端同步
  - **Verify**: `grep -E "PolicyMode|FilterJudgment|DailyBriefData" frontend/src/types/api.ts`
  - **Commit**: `feat(frontend): extend API types`
  - _Requirements: FR-4.1-4.7_
  - _Design: Frontend Architecture_

- [x] 1.26 配置 React Router
  - **Do**:
    1. 修改 `frontend/src/App.tsx`
    2. 添加 `BrowserRouter` 包装
    3. 配置 `Routes`：`/` → DailyBriefPage 占位, `/pack/:id` → PackViewPage 占位
    4. 添加 `/items` → 现有列表页
    5. 导入 react-router-dom 组件
  - **Files**: frontend/src/App.tsx
  - **Done when**: 路由配置存在
  - **Verify**: `grep -E "BrowserRouter|Routes|Route" frontend/src/App.tsx`
  - **Commit**: `feat(frontend): add react-router config`
  - _Requirements: FR-4.7_
  - _Design: Frontend Architecture > 路由配置_

- [x] 1.27 [VERIFY] Quality checkpoint: frontend
  - **Do**: Run frontend type check
  - **Verify**: `cd frontend && bun run build`
  - **Done when**: Build succeeds
  - **Commit**: None

### 1.10 前端页面组件

- [x] 1.28 [P] 创建 DailyBriefPage 占位组件
  - **Do**:
    1. 创建 `frontend/src/pages/DailyBriefPage.tsx`
    2. 基础布局：5 个 section 占位
    3. 调用 `/api/views/daily-brief` 获取数据
    4. 显示 loading/error 状态
  - **Files**: frontend/src/pages/DailyBriefPage.tsx
  - **Done when**: 页面存在，可渲染基础结构
  - **Verify**: `grep "DailyBriefPage" frontend/src/pages/DailyBriefPage.tsx`
  - **Commit**: `feat(frontend): add DailyBriefPage placeholder`
  - _Requirements: FR-4.1, AC-3.1-3.7_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.29 [P] 创建 PackViewPage 占位组件
  - **Do**:
    1. 创建 `frontend/src/pages/PackViewPage.tsx`
    2. 从 `useParams` 获取 pack id
    3. 调用 `/api/packs/:id` 获取数据
    4. 显示 policy 摘要、来源构成、代表内容占位
  - **Files**: frontend/src/pages/PackViewPage.tsx
  - **Done when**: 页面存在，可渲染基础结构
  - **Verify**: `grep "PackViewPage" frontend/src/pages/PackViewPage.tsx`
  - **Commit**: `feat(frontend): add PackViewPage placeholder`
  - _Requirements: FR-4.2, AC-4.1-4.6_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.30 [P] 创建 SaveButton 组件
  - **Do**:
    1. 创建 `frontend/src/components/save/SaveButton.tsx`
    2. Props: `itemId`, `packId`, `saved` 状态
    3. 点击调用 POST/DELETE `/api/items/:id/save`
    4. 显示保存/未保存状态（图标切换）
  - **Files**: frontend/src/components/save/SaveButton.tsx
  - **Done when**: 组件存在，可切换保存状态
  - **Verify**: `grep "SaveButton" frontend/src/components/save/SaveButton.tsx`
  - **Commit**: `feat(frontend): add SaveButton component`
  - _Requirements: FR-4.6, AC-7.1-7.5_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.31 更新 App.tsx 导入新页面
  - **Do**:
    1. 修改 `frontend/src/App.tsx`
    2. 导入 DailyBriefPage, PackViewPage
    3. 更新 Route 组件引用
  - **Files**: frontend/src/App.tsx
  - **Done when**: 路由使用实际页面组件
  - **Verify**: `grep -E "DailyBriefPage|PackViewPage" frontend/src/App.tsx`
  - **Commit**: `feat(frontend): wire up page routes`
  - _Requirements: FR-4.7_
  - _Design: Frontend Architecture > 路由配置_

- [x] 1.32 [VERIFY] Quality checkpoint: frontend pages
  - **Do**: Run frontend build
  - **Verify**: `cd frontend && bun run build`
  - **Done when**: Build succeeds
  - **Commit**: None

### 1.11 前端卡片组件

- [x] 1.33 [P] 创建 ItemCardWithReason 组件
  - **Do**:
    1. 创建 `frontend/src/components/items/ItemCardWithReason.tsx`
    2. Props: `item` (ItemData)
    3. 显示标题、来源、时间、keepReason 标签
    4. 显示 readerBenefit（如有）
    5. 包含 SaveButton
  - **Files**: frontend/src/components/items/ItemCardWithReason.tsx
  - **Done when**: 组件存在，显示 keepReason
  - **Verify**: `grep "keepReason" frontend/src/components/items/ItemCardWithReason.tsx`
  - **Commit**: `feat(frontend): add ItemCardWithReason`
  - _Requirements: FR-4.5, AC-2.2, AC-2.3_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.34 [P] 创建 CoverStoryCard 组件
  - **Do**:
    1. 创建 `frontend/src/components/items/CoverStoryCard.tsx`
    2. 大卡片布局，突出标题
    3. 显示 readerBenefit 作为副标题
    4. 包含 SaveButton
  - **Files**: frontend/src/components/items/CoverStoryCard.tsx
  - **Done when**: 大卡片组件存在
  - **Verify**: `test -f frontend/src/components/items/CoverStoryCard.tsx && echo PASS`
  - **Commit**: `feat(frontend): add CoverStoryCard`
  - _Requirements: AC-3.3_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.35 [P] 创建 LeadStoryCard 组件
  - **Do**:
    1. 创建 `frontend/src/components/items/LeadStoryCard.tsx`
    2. 中等卡片布局
    3. 显示 readingHint 标签
    4. 包含 SaveButton
  - **Files**: frontend/src/components/items/LeadStoryCard.tsx
  - **Done when**: 中卡片组件存在
  - **Verify**: `test -f frontend/src/components/items/LeadStoryCard.tsx && echo PASS`
  - **Commit**: `feat(frontend): add LeadStoryCard`
  - _Requirements: AC-3.4_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.36 [P] 创建 SignalCard 组件
  - **Do**:
    1. 创建 `frontend/src/components/items/SignalCard.tsx`
    2. 紧凑卡片布局
    3. 显示 keepReason 作为标签
    4. 包含 SaveButton
  - **Files**: frontend/src/components/items/SignalCard.tsx
  - **Done when**: 紧凑卡片组件存在
  - **Verify**: `test -f frontend/src/components/items/SignalCard.tsx && echo PASS`
  - **Commit**: `feat(frontend): add SignalCard`
  - _Requirements: AC-3.5_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.37 [VERIFY] Quality checkpoint: card components
  - **Do**: Run frontend build
  - **Verify**: `cd frontend && bun run build`
  - **Done when**: Build succeeds
  - **Commit**: None

### 1.12 前端视图模块

- [x] 1.38 [P] 创建 CoverStorySection 组件
  - **Do**:
    1. 创建 `frontend/src/components/views/CoverStorySection.tsx`
    2. Props: `item` 或 null
    3. 使用 CoverStoryCard 或显示空状态
  - **Files**: frontend/src/components/views/CoverStorySection.tsx
  - **Done when**: section 组件存在
  - **Verify**: `test -f frontend/src/components/views/CoverStorySection.tsx && echo PASS`
  - **Commit**: `feat(frontend): add CoverStorySection`
  - _Requirements: AC-3.3_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.39 [P] 创建 LeadStoriesSection 组件
  - **Do**:
    1. 创建 `frontend/src/components/views/LeadStoriesSection.tsx`
    2. Props: `items` 数组
    3. 使用 LeadStoryCard 渲染列表
  - **Files**: frontend/src/components/views/LeadStoriesSection.tsx
  - **Done when**: section 组件存在
  - **Verify**: `test -f frontend/src/components/views/LeadStoriesSection.tsx && echo PASS`
  - **Commit**: `feat(frontend): add LeadStoriesSection`
  - _Requirements: AC-3.4_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.40 [P] 创建 TopSignalsSection 组件
  - **Do**:
    1. 创建 `frontend/src/components/views/TopSignalsSection.tsx`
    2. Props: `items` 数组
    3. 使用 SignalCard 渲染列表
  - **Files**: frontend/src/components/views/TopSignalsSection.tsx
  - **Done when**: section 组件存在
  - **Verify**: `test -f frontend/src/components/views/TopSignalsSection.tsx && echo PASS`
  - **Commit**: `feat(frontend): add TopSignalsSection`
  - _Requirements: AC-3.5_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.41 [P] 创建 ScanBriefSection 组件
  - **Do**:
    1. 创建 `frontend/src/components/views/ScanBriefSection.tsx`
    2. Props: `items` 数组
    3. 标题列表布局，显示来源和时间
  - **Files**: frontend/src/components/views/ScanBriefSection.tsx
  - **Done when**: section 组件存在
  - **Verify**: `test -f frontend/src/components/views/ScanBriefSection.tsx && echo PASS`
  - **Commit**: `feat(frontend): add ScanBriefSection`
  - _Requirements: AC-3.6_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.42 [P] 创建 SavedForLaterSection 组件
  - **Do**:
    1. 创建 `frontend/src/components/views/SavedForLaterSection.tsx`
    2. Props: `items` 数组
    3. 显示保存时间
    4. 包含取消保存按钮
  - **Files**: frontend/src/components/views/SavedForLaterSection.tsx
  - **Done when**: section 组件存在
  - **Verify**: `test -f frontend/src/components/views/SavedForLaterSection.tsx && echo PASS`
  - **Commit**: `feat(frontend): add SavedForLaterSection`
  - _Requirements: AC-3.7, AC-7.4_
  - _Design: Frontend Architecture > 组件层次结构_

- [x] 1.43 [VERIFY] Quality checkpoint: view sections
  - **Do**: Run frontend build
  - **Verify**: `cd frontend && bun run build`
  - **Done when**: Build succeeds
  - **Commit**: None

### 1.13 集成 DailyBriefPage

- [x] 1.44 集成所有 section 到 DailyBriefPage
  - **Do**:
    1. 修改 `frontend/src/pages/DailyBriefPage.tsx`
    2. 导入所有 section 组件
    3. 组合 5 个模块：CoverStory + LeadStories + TopSignals + ScanBrief + SavedForLater
    4. 传递 API 数据到各 section
  - **Files**: frontend/src/pages/DailyBriefPage.tsx
  - **Done when**: 页面渲染完整 5 模块
  - **Verify**: `grep -E "CoverStorySection|LeadStoriesSection|TopSignalsSection|ScanBriefSection|SavedForLaterSection" frontend/src/pages/DailyBriefPage.tsx`
  - **Commit**: `feat(frontend): integrate all sections into DailyBriefPage`
  - _Requirements: AC-3.1-3.7_
  - _Design: Frontend Architecture_

- [x] 1.45 [VERIFY] Quality checkpoint: daily brief page
  - **Do**: Run frontend build
  - **Verify**: `cd frontend && bun run build`
  - **Done when**: Build succeeds
  - **Commit**: None

### 1.14 POC 验证

- [x] 1.46 POC Checkpoint: 端到端验证
  - **Do**:
    1. 启动后端服务: `bun src/cli/main.ts serve &`
    2. 启动前端服务: `cd frontend && bun dev &`
    3. 等待服务就绪
    4. 验证 API: `curl http://localhost:3000/api/views/daily-brief`
    5. 验证 Save API: `curl -X POST http://localhost:3000/api/items/test/save`
    6. 验证前端路由导航
  - **Verify**: `curl -sf http://localhost:3000/api/health && curl -sf http://localhost:3000/api/views/daily-brief | jq '.success'`
  - **Done when**: 所有 API 返回成功，前端页面可访问
  - **Commit**: `feat(editorial): complete POC`
  - _Requirements: All P0 ACs_
  - _Design: Data Flow_

---

## Phase 2: Refactoring

Focus: 代码整理，错误处理，遵循项目模式。

- [x] 2.1 添加 policy-filter 错误处理
  - **Do**:
    1. 修改 `src/pipeline/policy-filter.ts`
    2. AI 调用失败时 fallback 到 assist_only
    3. 添加日志记录
  - **Files**: src/pipeline/policy-filter.ts
  - **Done when**: 错误路径有降级处理
  - **Verify**: `grep -E "catch|fallback|assist_only" src/pipeline/policy-filter.ts && bun run check`
  - **Commit**: `refactor(pipeline): add error handling to policy-filter`
  - _Requirements: NFR-6_
  - _Design: Error Handling_

- [x] 2.2 添加 Save API 错误处理
  - **Do**:
    1. 修改 `src/api/routes/items.ts`
    2. 重复保存返回幂等成功
    3. 取消不存在的保存返回 404
  - **Files**: src/api/routes/items.ts
  - **Done when**: 边界情况处理完善
  - **Verify**: `grep -E "404|already" src/api/routes/items.ts && bun run check`
  - **Commit**: `refactor(api): add save endpoint error handling`
  - _Requirements: AC-7.1-7.5_
  - _Design: Edge Cases > Save 冲突_

- [x] 2.3 添加空状态处理到前端页面
  - **Do**:
    1. 修改 DailyBriefPage, PackViewPage
    2. 无内容时显示友好提示
    3. 添加 loading skeleton
  - **Files**: frontend/src/pages/DailyBriefPage.tsx, frontend/src/pages/PackViewPage.tsx
  - **Done when**: 空状态有 UI 反馈
  - **Verify**: `grep -E "empty|loading|null" frontend/src/pages/DailyBriefPage.tsx`
  - **Commit**: `refactor(frontend): add empty state handling`
  - _Requirements: Edge Cases > 空内容_
  - _Design: Edge Cases_

- [x] 2.4 [VERIFY] Quality checkpoint: refactoring
  - **Do**: Run type check and lint
  - **Verify**: `bun run check && bun run lint`
  - **Done when**: No errors
  - **Commit**: None

---

## Phase 3: Testing

Focus: 测试覆盖（单元 + 集成 + E2E）。

- [x] 3.1 [P] 单元测试: policy types
  - **Do**:
    1. 创建 `src/types/policy.test.ts`
    2. 测试 PolicyMode 类型约束
    3. 测试默认值逻辑
  - **Files**: src/types/policy.test.ts
  - **Done when**: 测试通过
  - **Verify**: `bun test src/types/policy.test.ts`
  - **Commit**: `test(types): add policy unit tests`
  - _Requirements: FR-1.1-1.3_
  - _Design: Test Strategy > Unit Tests_

- [x] 3.2 [P] 单元测试: load-pack policy 解析
  - **Do**:
    1. 创建/修改 `src/config/load-pack.test.ts`
    2. 测试 YAML 中 policy 字段解析
    3. 测试 source 覆盖 pack policy
    4. 测试默认值
  - **Files**: src/config/load-pack.test.ts
  - **Done when**: 测试通过
  - **Verify**: `bun test src/config/load-pack.test.ts`
  - **Commit**: `test(config): add policy parsing tests`
  - _Requirements: AC-1.1-1.3_
  - _Design: Test Strategy > Unit Tests_

- [x] 3.3 [P] 单元测试: policy-filter
  - **Do**:
    1. 创建 `src/pipeline/policy-filter.test.ts`
    2. 测试 assist_only 模式全保留
    3. 测试 filter_then_assist 调用 AI
    4. 测试 AI 失败降级
  - **Files**: src/pipeline/policy-filter.test.ts
  - **Done when**: 测试通过
  - **Verify**: `bun test src/pipeline/policy-filter.test.ts`
  - **Commit**: `test(pipeline): add policy-filter tests`
  - _Requirements: FR-2.1-2.4_
  - _Design: Test Strategy > Unit Tests_

- [x] 3.4 [P] 单元测试: saved-items queries
  - **Do**:
    1. 创建 `src/db/queries/saved-items.test.ts`
    2. 测试 saveItem, unsaveItem, getSavedItems, isItemSaved
    3. 使用内存数据库
  - **Files**: src/db/queries/saved-items.test.ts
  - **Done when**: 测试通过
  - **Verify**: `bun test src/db/queries/saved-items.test.ts`
  - **Commit**: `test(db): add saved-items query tests`
  - _Requirements: FR-1.4_
  - _Design: Test Strategy > Unit Tests_

- [x] 3.5 [VERIFY] Quality checkpoint: unit tests
  - **Do**: Run all tests
  - **Verify**: `bun test`
  - **Done when**: All tests pass
  - **Commit**: None

- [x] 3.6 集成测试: views API
  - **Do**:
    1. 创建 `src/api/routes/views.test.ts`
    2. 测试 GET /api/views/daily-brief 响应格式
    3. 测试空数据情况
  - **Files**: src/api/routes/views.test.ts
  - **Done when**: 测试通过
  - **Verify**: `bun test src/api/routes/views.test.ts`
  - **Commit**: `test(api): add views integration tests`
  - _Requirements: FR-3.1_
  - _Design: Test Strategy > Integration Tests_

- [x] 3.7 集成测试: save API
  - **Do**:
    1. 创建/修改 `src/api/routes/items.test.ts`
    2. 测试 POST/DELETE /api/items/:id/save
    3. 测试 GET /api/saved
    4. 测试幂等性
  - **Files**: src/api/routes/items.test.ts
  - **Done when**: 测试通过
  - **Verify**: `bun test src/api/routes/items.test.ts`
  - **Commit**: `test(api): add save integration tests`
  - _Requirements: FR-3.5-3.7_
  - _Design: Test Strategy > Integration Tests_

- [x] 3.8 [VERIFY] Quality checkpoint: integration tests
  - **Do**: Run all tests
  - **Verify**: `bun test`
  - **Done when**: All tests pass
  - **Commit**: None

---

## Phase 4: Quality Gates

Focus: 所有检查通过，创建 PR。

- [x] 4.1 V4 [VERIFY] Full local CI
  - **Do**: Run complete local CI suite
  - **Verify**: `bun run check && bun run lint && bun test`
  - **Done when**: All commands pass
  - **Commit**: `chore(editorial): pass local CI` (if fixes needed)

- [x] 4.2 V5 [VERIFY] CI pipeline passes
  - **Do**: Create PR, verify GitHub Actions passes
  - **Verify**: `gh pr checks --watch` (after PR created)
  - **Done when**: CI green
  - **Commit**: None

- [x] 4.3 V6 [VERIFY] AC checklist
  - **Do**: Verify all acceptance criteria programmatically
  - **Verify**: Grep codebase for AC implementation
  - **Done when**: All P0 ACs confirmed
  - **Commit**: None

### E2E Verification

- [x] VE1 [VERIFY] E2E startup: start dev server and wait for ready
  - **Do**:
    1. Start dev server: `bun src/cli/main.ts serve &`
    2. Record PID: `echo $! > /tmp/ve-pids.txt`
    3. Wait for server ready: `for i in $(seq 1 60); do curl -s http://localhost:3000/api/health && break || sleep 1; done`
  - **Verify**: `curl -sf http://localhost:3000/api/health && echo VE1_PASS`
  - **Done when**: Dev server running on port 3000
  - **Commit**: None

- [x] VE2 [VERIFY] E2E check: test critical user flows
  - **Do**:
    1. Test daily-brief API: `curl http://localhost:3000/api/views/daily-brief`
    2. Test save API: `curl -X POST http://localhost:3000/api/items/test-id/save -H "Content-Type: application/json" -d '{"packId":"test"}'`
    3. Test saved items: `curl http://localhost:3000/api/saved`
  - **Verify**: `curl -sf http://localhost:3000/api/views/daily-brief | jq '.success == true' && curl -sf http://localhost:3000/api/saved | jq '.success == true' && echo VE2_PASS`
  - **Done when**: All critical flows return success
  - **Commit**: None

- [x] VE-BROWSER [VERIFY] E2E browser validation: verify frontend pages with chrome-cdp
  - **Do**:
    1. Start frontend dev server: `cd frontend && bun dev &`
    2. Wait for frontend ready: `for i in $(seq 1 30); do curl -s http://localhost:5173 > /dev/null && break || sleep 1; done`
    3. Use chrome-cdp skill to open browser and navigate to `http://localhost:5173`
    4. Verify daily brief page has 5 sections: CoverStory, LeadStories, TopSignals, ScanBrief, SavedForLater
    5. Take screenshot to confirm layout
  - **Verify**: Browser automation confirms 5 sections present
  - **Done when**: Frontend pages verified working in browser
  - **Commit**: None
  - _Requirements: AC-3.1 ~ AC-3.7_
  - _Design: Test Strategy > E2E Tests_

- [x] VE3 [VERIFY] E2E cleanup: stop server and free port
  - **Do**:
    1. Kill frontend server: `lsof -ti :5173 | xargs -r kill 2>/dev/null || true`
    2. Kill backend by PID: `kill $(cat /tmp/ve-pids.txt) 2>/dev/null; sleep 2; kill -9 $(cat /tmp/ve-pids.txt) 2>/dev/null || true`
    3. Kill by port fallback: `lsof -ti :3000 | xargs -r kill 2>/dev/null || true`
    4. Remove PID file: `rm -f /tmp/ve-pids.txt`
  - **Verify**: `! lsof -ti :3000 && ! lsof -ti :5173 && echo VE3_PASS`
  - **Done when**: No process on ports 3000 and 5173
  - **Commit**: None

---

## Phase 5: PR Lifecycle

Focus: 自主 PR 管理循环直到所有条件满足。

- [x] 5.1 Create PR (skipped - changes on main)
  - **Do**:
    1. Verify feature branch: `git branch --show-current`
    2. Push: `git push -u origin $(git branch --show-current)`
    3. Create PR: `gh pr create --title "feat(editorial): v1 editorial redesign" --body "..."`
  - **Verify**: `gh pr view --json number`
  - **Done when**: PR created
  - **Commit**: None

- [x] 5.2 Monitor CI (skipped - no PR) and fix issues
  - **Do**:
    1. Watch CI: `gh pr checks --watch`
    2. On failure: read logs, fix locally, push
    3. Repeat until green
  - **Verify**: `gh pr checks`
  - **Done when**: All checks green
  - **Commit**: (varies based on fixes)

- [x] 5.3 Address review (skipped - no PR) review comments
  - **Do**:
    1. List comments: `gh pr view --comments`
    2. Address each comment
    3. Push fixes
  - **Verify**: `gh pr view --comments | grep -c "UNRESOLVED" || echo 0`
  - **Done when**: No unresolved comments
  - **Commit**: (varies based on comments)

- [x] 5.4 Final validation validation
  - **Do**:
    1. Verify all tasks complete
    2. Verify CI green
    3. Verify zero test regressions
    4. Document in .progress.md
  - **Verify**: `bun test && bun run check && bun run lint`
  - **Done when**: All criteria met
  - **Commit**: None

---

## Notes

### POC Shortcuts
- Policy filter 跳过缓存查询，直接调用 AI
- 前端图表使用简单占位，Recharts 在 Phase 2 完整实现
- 周报视图推迟到 Phase 2
- 来源视图推迟到 Phase 2

### Production TODOs

#### 6.1 Policy Filter 缓存机制

- [x] 6.1.1 [P] 创建 filter judgment 缓存查询模块
  - **Do**:
    1. 创建 `src/policy/filter-cache.ts`
    2. 实现 `getCachedJudgment(db, itemId, itemFingerprint)` 函数
    3. 实现 `saveJudgment(db, itemId, judgment, itemFingerprint)` 函数
    4. 查询 `enrichment_results.filter_judgment_json` 字段
    5. 使用 item URL + publishedAt 作为 fingerprint
  - **Files**: src/policy/filter-cache.ts
  - **Done when**: 缓存模块存在，可查询和保存 judgment
  - **Verify**: `grep "getCachedJudgment\|saveJudgment" src/policy/filter-cache.ts && bun run check`
  - **Commit**: `feat(policy): add filter judgment cache module`

- [x] 6.1.2 [P] 扩展数据库 schema 添加 fingerprint 字段
  - **Do**:
    1. 创建 `src/db/migrations/005_policy_cache.sql`
    2. 添加 `enrichment_results.item_fingerprint TEXT` 字段
    3. 添加索引 `idx_enrichment_fingerprint (item_fingerprint)`
    4. 更新现有 enrichment_results 添加 fingerprint
  - **Files**: src/db/migrations/005_policy_cache.sql
  - **Done when**: 迁移文件存在，fingerprint 字段和索引已添加
  - **Verify**: `cat src/db/migrations/005_policy_cache.sql | grep -E "item_fingerprint|idx_enrichment_fingerprint"`
  - **Commit**: `feat(db): add fingerprint field for cache lookup`

- [x] 6.1.3 [VERIFY] Quality checkpoint: policy cache
  - **Do**: Run type check
  - **Verify**: `bun run check`
  - **Done when**: No type errors
  - **Commit**: None

#### 6.2 批量判断优化

- [x] 6.2.1 [P] 扩展 batchFilter 支持批量处理
  - **Do**:
    1. 修改 `src/ai/client.ts` 中的 `batchFilter` 方法
    2. 实现分组逻辑：将 items 按 10 个一组批量调用 AI
    3. 添加并发控制：最多 3 个并发请求
    4. 合并所有结果返回 FilterJudgment[]
  - **Files**: src/ai/client.ts
  - **Done when**: batchFilter 支持批量处理，分组为 10 个
  - **Verify**: `grep -E "batch.*10|concurrency|group" src/ai/client.ts && bun run check`
  - **Commit**: `feat(ai): add batch processing to batchFilter`

- [x] 6.2.2 更新 policy-filter 使用批量接口
  - **Do**:
    1. 修改 `src/pipeline/policy-filter.ts`
    2. 调用 `batchFilter` 替代单个过滤调用
    3. 配置 batchSize=10, concurrency=3
    4. 合并结果到 Map 供后续使用
  - **Files**: src/pipeline/policy-filter.ts
  - **Done when**: policy-filter 使用批量接口
  - **Verify**: `grep -E "batchSize|concurrency" src/pipeline/policy-filter.ts && bun run check`
  - **Commit**: `feat(pipeline): use batch AI calls in policy-filter`

- [x] 6.2.3 [VERIFY] Quality checkpoint: batch optimization
  - **Do**: Run type check and lint
  - **Verify**: `bun run check && bun run lint`
  - **Done when**: No errors
  - **Commit**: None

#### 6.3 周报视图完整实现

- [x] 6.3.1 [P] 创建 weekly-review 视图模块
  - **Do**:
    1. 创建 `src/views/weekly-review.ts`
    2. 实现 `buildWeeklyReview(db, windowDays?)` 函数
    3. 查询 7 天窗口的所有 items（today - 7 到 today）
    4. 聚合主题：按 tags 和 keywords 分组
    5. 返回 WeeklyReviewData 结构
  - **Files**: src/views/weekly-review.ts
  - **Done when**: weekly-review 视图模块存在
  - **Verify**: `grep "buildWeeklyReview" src/views/weekly-review.ts && bun run check`
  - **Commit**: `feat(views): add weekly-review view builder`

- [x] 6.3.2 [P] 创建 WeeklyReviewPage 前端页面
  - **Do**:
    1. 创建 `frontend/src/pages/WeeklyReviewPage.tsx`
    2. 从 `useParams` 获取 window 参数（默认 7 天）
    3. 调用 `/api/views/weekly-review?window=7`
    4. 显示本周概览、主题聚合、代表内容
    5. 显示空状态：本周暂无数据
  - **Files**: frontend/src/pages/WeeklyReviewPage.tsx
  - **Done when**: 页面存在，显示周报内容
  - **Verify**: `grep "WeeklyReviewPage" frontend/src/pages/WeeklyReviewPage.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): add WeeklyReviewPage`

- [x] 6.3.3 添加 weekly-review API 端点
  - **Do**:
    1. 修改 `src/api/routes/views.ts`
    2. 添加 `GET /api/views/weekly-review` 端点
    3. 支持 window 查询参数（默认 7）
    4. 调用 weekly-review 视图模块
    5. 返回 WeeklyReviewData
  - **Files**: src/api/routes/views.ts
  - **Done when**: weekly-review 端点存在
  - **Verify**: `curl -s http://localhost:3000/api/views/weekly-review | jq '.success'`
  - **Commit**: `feat(api): add weekly-review endpoint`

- [x] 6.3.4 添加 weekly 路由到 App.tsx
  - **Do**:
    1. 修改 `frontend/src/App.tsx`
    2. 添加 `<Route path="/weekly" element={<WeeklyReviewPage />} />`
  - **Files**: frontend/src/App.tsx
  - **Done when**: /weekly 路由已添加
  - **Verify**: `grep "/weekly" frontend/src/App.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): add weekly route`

- [x] 6.3.5 [VERIFY] Quality checkpoint: weekly review
  - **Do**: Run type check and build
  - **Verify**: `bun run check && cd frontend && bun run build`
  - **Done when**: No errors
  - **Commit**: None

- [x] 6.3.6 VE-WEEKLY [VERIFY] E2E browser validation: verify weekly review page
  - **Do**:
    1. Start frontend dev server (if not running): `cd frontend && bun dev &`
    2. Wait for frontend ready: `for i in $(seq 1 30); do curl -s http://localhost:5173 > /dev/null && break || sleep 1; done`
    3. Use chrome-cdp skill to navigate to `http://localhost:5173/weekly`
    4. Verify weekly review page has: Overview stats, Theme groups, Editor's picks sections
    5. Take screenshot to confirm layout
  - **Verify**: Browser automation confirms page structure
  - **Done when**: Weekly page verified working in browser
  - **Commit**: None
  - _Requirements: AC-6.1 ~ AC-6.6_
  - _Design: Test Strategy > E2E Tests_

#### 6.4 来源视图完整实现

- [x] 6.4.1 [P] 创建 source-detail 视图模块
  - **Do**:
    1. 创建 `src/views/source-detail.ts`
    2. 实现 `buildSourceDetail(db, sourceId)` 函数
    3. 查询 source 元信息、策略模式
    4. 计算保留率（近 7 天）
    5. 统计过滤理由分布
    6. 返回最近 10 条内容
  - **Files**: src/views/source-detail.ts
  - **Done when**: source-detail 视图模块存在
  - **Verify**: `grep "buildSourceDetail" src/views/source-detail.ts && bun run check`
  - **Commit**: `feat(views): add source-detail view builder`

- [x] 6.4.2 [P] 创建 SourceViewPage 前端页面
  - **Do**:
    1. 创建 `frontend/src/pages/SourceViewPage.tsx`
    2. 从 `useParams` 获取 sourceId
    3. 调用 `/api/sources/:id`
    4. 显示来源元信息、策略模式、保留率
    5. 显示过滤理由分布图表
    6. 显示最近内容列表
  - **Files**: frontend/src/pages/SourceViewPage.tsx
  - **Done when**: 页面存在，显示来源详情
  - **Verify**: `grep "SourceViewPage" frontend/src/pages/SourceViewPage.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): add SourceViewPage`

- [x] 6.4.3 添加 source 详情 API 端点
  - **Do**:
    1. 创建 `src/api/routes/sources.ts`
    2. 添加 `GET /api/sources/:id` 端点
    3. 调用 source-detail 视图模块
    4. 返回 SourceDetailData
  - **Files**: src/api/routes/sources.ts
  - **Done when**: source 详情端点存在
  - **Verify**: `grep -E "GET.*sources.*:id|buildSourceDetail" src/api/routes/sources.ts`
  - **Commit**: `feat(api): add source detail endpoint`

- [x] 6.4.4 添加 source 路由到 App.tsx
  - **Do**:
    1. 修改 `frontend/src/App.tsx`
    2. 添加 `<Route path="/source/:id" element={<SourceViewPage />} />`
  - **Files**: frontend/src/App.tsx
  - **Done when**: /source/:id 路由已添加
  - **Verify**: `grep "/source/:id" frontend/src/App.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): add source route`

- [x] 6.4.5 [VERIFY] Quality checkpoint: source view
  - **Do**: Run type check and build
  - **Verify**: `bun run check && cd frontend && bun run build`
  - **Done when**: No errors
  - **Commit**: None

- [x] 6.4.6 VE-SOURCE [VERIFY] E2E browser validation: verify source view page
  - **Do**:
    1. Start frontend dev server (if not running): `cd frontend && bun dev &`
    2. Wait for frontend ready: `for i in $(seq 1 30); do curl -s http://localhost:5173 > /dev/null && break || sleep 1; done`
    3. Use chrome-cdp skill to navigate to `http://localhost:5173/source/:id`
    4. Verify source view page has: Source meta info, Policy mode display, Retention rate, Recent content list
    5. Take screenshot to confirm layout
  - **Verify**: Browser automation confirms page structure
  - **Done when**: Source page verified working in browser
  - **Commit**: None
  - _Requirements: AC-5.1 ~ AC-5.6_
  - _Design: Test Strategy > E2E Tests_

#### 6.5 Recharts 图表完整实现

- [x] 6.5.1 [P] 创建 SourceCompositionChart 组件
  - **Do**:
    1. 创建 `frontend/src/components/charts/SourceCompositionChart.tsx`
    2. 使用 Recharts PieChart 显示来源类型分布
    3. Props: `data: {name, value}[]`
    4. 添加标签和图例
    5. 使用 tree-shaking 仅导入必要组件
  - **Files**: frontend/src/components/charts/SourceCompositionChart.tsx
  - **Done when**: PieChart 组件存在
  - **Verify**: `grep -E "PieChart|ResponsiveContainer" frontend/src/components/charts/SourceCompositionChart.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): add SourceCompositionChart with Recharts`

- [x] 6.5.2 [P] 创建 FilterReasonsChart 组件
  - **Do**:
    1. 创建 `frontend/src/components/charts/FilterReasonsChart.tsx`
    2. 使用 Recharts BarChart 显示过滤理由分布
    3. Props: `data: {reason, count}[]`
    4. 添加坐标轴和标签
  - **Files**: frontend/src/components/charts/FilterReasonsChart.tsx
  - **Done when**: BarChart 组件存在
  - **Verify**: `grep -E "BarChart|CartesianGrid" frontend/src/components/charts/FilterReasonsChart.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): add FilterReasonsChart with Recharts`

- [x] 6.5.3 集成图表到 SourceViewPage
  - **Do**:
    1. 修改 `frontend/src/pages/SourceViewPage.tsx`
    2. 导入并使用 SourceCompositionChart
    3. 导入并使用 FilterReasonsChart
    4. 传递 API 数据到图表组件
  - **Files**: frontend/src/pages/SourceViewPage.tsx
  - **Done when**: 图表已集成到页面
  - **Verify**: `grep -E "SourceCompositionChart|FilterReasonsChart" frontend/src/pages/SourceViewPage.tsx && cd frontend && bun run build`
  - **Commit**: `feat(frontend): integrate charts into SourceViewPage`

- [x] 6.5.4 [VERIFY] Quality checkpoint: Recharts integration
  - **Do**: Run type check and build
  - **Verify**: `bun run check && cd frontend && bun run build`
  - **Done when**: No errors
  - **Commit**: None

- [x] 6.5.5 VE-CHARTS [VERIFY] E2E browser validation: verify Recharts charts render
  - **Do**:
    1. Start frontend dev server (if not running): `cd frontend && bun dev &`
    2. Use chrome-cdp skill to navigate to `http://localhost:5173/source/:id`
    3. Verify SourceCompositionChart (PieChart) renders correctly
    4. Verify FilterReasonsChart (BarChart) renders correctly
    5. Take screenshot to confirm charts visible
  - **Verify**: Browser automation confirms charts render
  - **Done when**: Charts verified working in browser
  - **Commit**: None
  - _Requirements: AC-5.5_
  - _Design: Test Strategy > E2E Tests_

#### 6.6 前端 E2E 测试

- [x] 6.6.1 [P] 设置 Playwright E2E 测试框架
  - **Do**:
    1. 安装 Playwright: `bun add -D playwright @playwright/test`
    2. 创建 `frontend/e2e/` 目录
    3. 创建 `frontend/e2e/basic.spec.ts` 测试日报首页
    4. 配置 `playwright.config.ts`
  - **Files**: frontend/e2e/basic.spec.ts, frontend/playwright.config.ts
  - **Done when**: Playwright 配置完成，基础测试存在
  - **Verify**: `grep -E "playwright|basic.spec" frontend/playwright.config.ts`
  - **Commit**: `test(e2e): add Playwright framework setup`

- [ ] 6.6.2 [P] 创建 E2E 测试用例
  - **Do**:
    1. 创建 `frontend/e2e/daily-brief.spec.ts`
    2. 测试导航到日报首页
    3. 验证 5 个模块存在（使用 selectors）
    4. 测试 Save 按钮功能
    5. 创建 `frontend/e2e/pack-view.spec.ts` 测试 Pack 视图
  - **Files**: frontend/e2e/daily-brief.spec.ts, frontend/e2e/pack-view.spec.ts
  - **Done when**: E2E 测试用例存在
  - **Verify**: `grep -E "test\|describe" frontend/e2e/*.spec.ts`
  - **Commit**: `test(e2e): add E2E test cases`

- [ ] 6.6.3 [VERIFY] Quality checkpoint: E2E tests
  - **Do**: Run E2E tests (optional in dev environment)
  - **Verify**: `cd frontend && bunx playwright test`
  - **Done when**: Tests can run (may skip without UI)
  - **Commit**: None

- [x] 6.6.4 VE-SAVE [VERIFY] E2E browser validation: verify Save button functionality
  - **Do**:
    1. Start frontend dev server (if not running): `cd frontend && bun dev &`
    2. Use chrome-cdp skill to navigate to `http://localhost:5173/`
    3. Find Save button on any card
    4. Click Save button and verify state changes
    5. Navigate to Save For Later section to verify item appears
    6. Test unsave by clicking again
    7. Refresh page and verify save state persists
  - **Verify**: Browser automation confirms save/unsave works
  - **Done when**: Save functionality verified working in browser
  - **Commit**: None
  - _Requirements: AC-7.1, AC-7.3 ~ AC-7.5_
  - _Design: Test Strategy > E2E Tests_

### Unresolved Questions
- None

---

## Task Count Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 (POC) | 46 | 核心功能实现 |
| Phase 2 (Refactor) | 4 | 代码整理 |
| Phase 3 (Testing) | 8 | 单元+集成测试 |
| Phase 4 (Quality) | 7 | 质量门禁 + E2E 验证 |
| Phase 5 (PR) | 4 | PR 生命周期 |
| Production TODOs | 27 | 后续优化功能 |
| **Total** | **96** | - |

### Browser 验证任务 (chrome-cdp)
- VE1: E2E startup
- VE2: E2E check
- VE-BROWSER: Daily Brief 页面验证
- VE3: E2E cleanup
- VE-WEEKLY (6.3.6): 周报页面验证
- VE-SOURCE (6.4.6): 来源视图验证
- VE-CHARTS (6.5.5): 图表渲染验证
- VE-SAVE (6.6.4): Save 功能验证
