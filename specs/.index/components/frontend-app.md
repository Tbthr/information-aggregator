# Component: frontend/App

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `frontend/src/App.tsx` |
| 类别 | frontend |
| 索引时间 | 2026-03-17 |

## 概述

前端主应用组件，React 单页应用的入口点。组织整体布局结构，包含侧边栏、过滤器、内容列表和分页。

## 组件结构

```
Layout
├── Sidebar (数据源选择)
│   ├── Packs 列表
│   └── Sources 列表
└── Main Content
    ├── FilterBar (过滤选项)
    ├── ItemList (数据项列表)
    └── Pagination (分页控件)
```

## 使用的 Hooks

| Hook | 说明 |
|------|------|
| `useFilters` | 管理过滤状态 |
| `useItems` | 获取数据项 |
| `usePacks` | 获取数据源包 |

## 依赖

- `./components/Layout`
- `./components/Sidebar`
- `./components/FilterBar`
- `./components/ItemList`
- `./components/Pagination`
- `./hooks/useFilters`
- `./hooks/useApi`

## 关键词

`react`, `app`, `frontend`, `layout`, `main`

## 相关文件

- `frontend/src/components/*.tsx`
- `frontend/src/hooks/useFilters.ts`
- `frontend/src/hooks/useApi.ts`
