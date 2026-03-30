# 废弃 CustomView & Bookmark 功能规划

## 目标

完全废弃 CustomView（自定义视图）和 Bookmark（书签）相关的数据表定义和代码，包括前端页面、API 路由、组件、Hooks 等。

## 影响范围概览

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Prisma Schema | 1 | 3 个模型 |
| API Routes | 5 | bookmarks × 2, custom-views × 3 |
| Frontend Pages | 2 | view/[id], saved |
| Components | 6 | custom-view-page, saved-page, save-button, save-toast, sortable-view-item, view-edit-drawer |
| Hooks | 2 | use-saved, use-api (部分) |
| lib | 1 | api-client (部分) |
| types | 1 | types.ts (部分) |
| Sidebar | 1 | sidebar.tsx (重大重构) |
| AppLayout | 1 | app-layout.tsx (部分) |

---

## 阶段计划

### 阶段 1：数据库迁移（Prisma Schema）

- [ ] 从 `prisma/schema.prisma` 删除 `Bookmark` 模型
- [ ] 从 `prisma/schema.prisma` 删除 `CustomView` 模型
- [ ] 从 `prisma/schema.prisma` 删除 `CustomViewTopic` 模型
- [ ] 执行 `npx prisma db push` 同步到本地数据库
- [ ] 执行 `npx prisma migrate dev --name remove_customview_bookmark` 创建正式迁移

### 阶段 2：删除 API Routes

- [ ] 删除 `app/api/bookmarks/route.ts`
- [ ] 删除 `app/api/bookmarks/[id]/route.ts`
- [ ] 删除 `app/api/custom-views/route.ts`
- [ ] 删除 `app/api/custom-views/[id]/route.ts`
- [ ] 删除 `app/api/custom-views/reorder/route.ts`

### 阶段 3：删除前端页面

- [ ] 删除 `app/view/[id]/page.tsx`（CustomView 渲染页）
- [ ] 删除 `app/saved/page.tsx`（Bookmark 收藏页）

### 阶段 4：删除 Components

- [ ] 删除 `components/custom-view-page.tsx`
- [ ] 删除 `components/saved-page.tsx`
- [ ] 删除 `components/save-button.tsx`
- [ ] 删除 `components/save-toast.tsx`
- [ ] 删除 `components/sidebar/sortable-view-item.tsx`
- [ ] 删除 `components/sidebar/view-edit-drawer.tsx`

### 阶段 5：清理 lib/hooks/types

- [ ] 从 `lib/types.ts` 删除 `CustomView` 类型，删除 `Article.isBookmarked`，删除 `Tweet.isBookmarked`
- [ ] 从 `hooks/use-api.ts` 删除 `useCustomViews`、`useBookmarks`
- [ ] 从 `hooks/use-api.ts` 删除 `CustomViewsResponse`、`BookmarksResponse` 接口
- [ ] 从 `lib/api-client.ts` 删除 `fetchBookmarks`、`addBookmark`、`removeBookmark`、`fetchCustomViews`、`fetchCustomViewItems`、`fetchTweetBookmarks`、`addTweetBookmark`、`removeTweetBookmark`
- [ ] 从 `lib/api-client.ts` 删除 `CustomViewsData`、`BookmarksData` 接口
- [ ] 删除 `hooks/use-saved.ts`

### 阶段 6：重构 Sidebar

- [ ] 重构 `components/sidebar.tsx`：
  - 删除 `useCustomViews` 导入和使用
  - 删除"我的视图"整个 section
  - 删除 DnD（Drag and Drop）相关代码
  - 删除 `ViewEditDrawer` 组件
  - 删除所有 CustomView 状态（`localViews`、`editingView`、`drawerOpen` 等）
  - 删除所有视图操作函数（`openCreateDrawer`、`openEditDrawer`、`saveView`、`deleteView`、`handleDragEnd`）
  - 简化导入（删除 DnD、Drawer 等无用导入）

### 阶段 7：重构 AppLayout

- [ ] 重构 `components/app-layout.tsx`：
  - 删除 `useCustomViews`、`useSaved`、`SaveToast` 导入
  - 删除 `useSaved` hook 调用和 `savedIds`、`toggleSave`、`isSaved` 状态
  - 删除 `viewInfo` useMemo（依赖 customViews）
  - 删除 `handleToggleSave`、`isSaved` 回调（不再需要收藏功能）
  - 删除 `SaveToast` 组件渲染
  - 删除 `ReadingPanel` 的 `isSaved`/`onToggleSave` props（如果适用）
  - 删除 `AppLayout` 中传给 children 的 `isSaved`/`onToggleSave`/`onOpenArticle` props

### 阶段 8：清理 Sidebar Types & Icon Map

- [ ] 从 `components/sidebar/types.ts` 删除 `CustomView`、`Pack`、`ViewFilter` 接口
- [ ] 保留 `NavId`、`SidebarProps`
- [ ] 从 `components/sidebar/icon-map.tsx` 删除无用图标（仅保留 sidebar.tsx 和其他地方使用的图标）

### 阶段 9：构建验证

- [ ] `pnpm check` — 确保无 TypeScript 错误
- [ ] `pnpm build` — 确保构建成功
- [ ] `pnpm lint` — 确保无 ESLint 错误
- [ ] 检查是否有遗漏的 CustomView/Bookmark 引用

---

## 关键注意事项

1. **Sidebar 导航**: Sidebar 中"我的收藏夹"入口（savedCount badge）依赖 `savedIds`，需确认是否保留该入口还是一起删除
2. **ReadingPanel**: 需要检查 `ReadingPanel` 是否依赖 `isSaved`/`onToggleSave` props
3. **Tweet Bookmark**: `lib/api-client.ts` 中有 `fetchTweetBookmarks` 等函数，需要确认是否属于 Bookmark 废弃范围（看起来是 X/Twitter 专用书签，可能也需要一起删除）
4. **Saved 路由**: `app/saved/page.tsx` 被 `sidebar.tsx` 中"我的收藏夹"按钮引用，删除后 Sidebar 需要调整
5. **View 路由**: `app/view/[id]/page.tsx` 被 Sidebar 中自定义视图按钮动态路由，删除后 Sidebar 需要调整
