# 调研发现

## 数据库表

### Bookmark
- 表名：`Bookmark`
- 行数：0（空表）
- 字段：`id` (PK), `contentId` (nullable), `bookmarkedAt`
- **注意**：无任何实际数据

### CustomView
- 表名：`CustomView`
- 行数：0（空表）
- 字段：`id`, `name`, `icon`, `description`, `createdAt`, `filterJson`, `updatedAt`, `order`
- 关联：`CustomViewTopic[]`（1 对多）
- **注意**：无任何实际数据

### CustomViewTopic
- 表名：`CustomViewTopic`
- 行数：0（空表）
- 字段：`id`, `viewId` (FK→CustomView), `topicId`
- 关联：被 `CustomView.customViewTopics` 引用

## API Routes

### Bookmark APIs
| 文件 | 方法 | 功能 |
|------|------|------|
| `app/api/bookmarks/route.ts` | GET | 获取所有书签（返回 Article[]） |
| `app/api/bookmarks/[id]/route.ts` | POST/DELETE | 添加/删除单个书签 |

### CustomView APIs
| 文件 | 方法 | 功能 |
|------|------|------|
| `app/api/custom-views/route.ts` | GET/POST | 获取列表/创建视图 |
| `app/api/custom-views/[id]/route.ts` | GET/PUT/DELETE | 获取/更新/删除单个视图 |
| `app/api/custom-views/reorder/route.ts` | PUT | 批量更新视图顺序 |

## 前端依赖关系

### CustomView 依赖链
```
sidebar.tsx
  ├── useCustomViews() [hooks/use-api.ts]
  ├── SortableViewItem [sidebar/sortable-view-item.tsx]
  ├── ViewEditDrawer [sidebar/view-edit-drawer.tsx]
  ├── SortableContext / DndContext [dnd-kit]
  └── NavButton (我的视图 section)

app-layout.tsx
  ├── useCustomViews() [hooks/use-api.ts]
  ├── useSaved() [hooks/use-saved.ts]
  ├── SaveToast [save-toast.tsx]
  └── savedIds / toggleSave / isSaved

app/view/[id]/page.tsx
  ├── CustomViewPage [custom-view-page.tsx]
  └── fetchCustomViews / fetchCustomViewItems [lib/api-client.ts]
```

### Bookmark 依赖链
```
sidebar.tsx
  └── NavButton (我的收藏夹 section, savedCount badge)

app/saved/page.tsx
  ├── SavedPage [saved-page.tsx]
  └── useBookmarks() [hooks/use-api.ts]

hooks/use-saved.ts
  ├── useSWR('/api/bookmarks')
  ├── addBookmark / removeBookmark [lib/api-client.ts]
  └── savedIds / toggleSave / isSaved

components/save-button.tsx
  └── 收藏按钮（ArticleCard 等处使用）

components/save-toast.tsx
  └── 收藏提示 toast
```

## Tweet Bookmark 特殊说明

在 `lib/api-client.ts` 中发现 `fetchTweetBookmarks`、`addTweetBookmark`、`removeTweetBookmark` 函数，这些是 X/Twitter 专用的书签功能：
- 调用 `/api/tweet-bookmarks` 和 `/api/tweet-bookmarks/[id]`
- 但搜索 `app/api/tweet-bookmarks/` 无结果（API 路由不存在）
- **结论**：Tweet bookmark API 路由从未创建，这些函数是死代码

## Sidebar 中的"我的视图"功能

- 使用 DnD Kit 实现拖拽排序
- `ViewEditDrawer` 使用 `Drawer` 组件（来自 shadcn/ui）
- `SortableViewItem` 使用 `useSortable` hook
- 支持创建/编辑/删除/重排序自定义视图
- 视图关联 Topic（通过 `CustomViewTopic` 连接表）

## 需要确认的问题

1. **Sidebar 收藏入口**：是否保留"我的收藏夹"NavButton？当前它有 `savedCount` badge
2. **ReadingPanel**：`components/reading-panel.tsx` 需要检查是否依赖 bookmark 相关 props
3. **Tweet bookmark**：X 专用书签（`fetchTweetBookmarks` 等）是否一起删除？
4. **Pack 类型**：`sidebar/types.ts` 中的 `Pack` 类型是否仅用于 CustomView？
