---
name: Frontend App
description: 前端应用 - React SPA 路由
category: frontend
source_path: frontend/src/App.tsx
content_hash: u1v2w3x4
timestamp: 2026-03-18
---

# Frontend App

## 概述

React 单页应用入口，使用 React Router 管理页面路由。

## 路由配置

| 路径 | 组件 | 描述 |
|------|------|------|
| `/` | `DailyBriefPage` | 首页 - 日报视图 |
| `/items` | `ItemsPage` | 内容列表页 |
| `/pack/:id` | `PackViewPage` | Pack 详情页 |
| `/weekly` | `WeeklyReviewPage` | 周报视图 |
| `/source/:id` | `SourceViewPage` | 来源详情页 |

## ItemsPage 结构

```
Layout
├── Sidebar (Pack/Source 选择)
├── Main Content
│   ├── FilterBar (时间窗口/排序/搜索)
│   ├── ItemList (内容卡片列表)
│   ├── Pagination (分页)
│   └── Stats Footer (统计)
```

## 依赖关系

- `react-router-dom` - 路由
- `./hooks/useApi` - API Hooks
- `./hooks/useFilters` - 过滤器 Hooks
- `./components/*` - UI 组件

## 关键词

react, frontend, router, spa, components, hooks

## 相关文件

- [frontend/src/hooks/useApi.ts](frontend/src/hooks/useApi.ts)
- [frontend/src/hooks/useFilters.ts](frontend/src/hooks/useFilters.ts)
- [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
- [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx)
