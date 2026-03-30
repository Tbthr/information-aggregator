# 进度日志

## 2026-03-30

### 废弃 CustomView & Bookmark 功能（已完成）

- [x] 阶段 1：数据库迁移 — 从 schema.prisma 删除 3 个模型
- [x] 阶段 2：删除 API Routes — 删除 5 个文件
- [x] 阶段 3：删除前端页面 — 删除 app/view 和 app/saved
- [x] 阶段 4：删除 Components — 删除 6 个组件文件
- [x] 阶段 5：清理 lib/hooks/types — 清理 api-client、use-api、use-saved、types
- [x] 阶段 6：重构 Sidebar — 删除"我的视图"、DnD、Drawer，重构为简化的导航
- [x] 阶段 7：重构 AppLayout — 删除 useSaved、SaveToast、bookmark 相关状态
- [x] 阶段 8：清理 Sidebar Types — 保留 NavId/SidebarProps，删除 CustomView/Pack/ViewFilter
- [x] 阶段 9：构建验证 — `pnpm check` ✓ `pnpm build` ✓ 通过
- [x] playwriter 页面验证 — /daily ✓ /weekly ✓ /x ✓ 均正常加载

### 数据库状态
- `Bookmark` 表：0 行
- `CustomView` 表：0 行
- `CustomViewTopic` 表：0 行

### 文件统计
- API Routes：5 个（全部删除）
- 前端页面：2 个（全部删除）
- Components：6 个（全部删除）
- Hooks：2 个（1 个删除，1 个部分清理）
- lib/api-client.ts：部分清理
- lib/types.ts：部分清理
- Sidebar：重大重构
- AppLayout：部分重构

### 调研细节

#### 数据库状态
- `Bookmark` 表：0 行
- `CustomView` 表：0 行
- `CustomViewTopic` 表：0 行

#### 文件统计
- API Routes：5 个（全部删除）
- 前端页面：2 个（全部删除）
- Components：6 个（全部删除）
- Hooks：2 个（1 个删除，1 个部分清理）
- lib/api-client.ts：部分清理
- lib/types.ts：部分清理
- Sidebar：重大重构
- AppLayout：部分重构

---

## 2026-03-30

### 调研阶段（完成）

- [x] 分析 Prisma Schema，识别 3 个待删除模型：Bookmark、CustomView、CustomViewTopic
- [x] 扫描所有相关代码文件（25 个 CustomView 文件，28 个 Bookmark 文件）
- [x] 读取关键文件：schema、types、hooks、components、API routes
- [x] 创建 `task_plan.md`、`findings.md`、`progress.md`
- [x] 确认废弃范围和依赖关系
