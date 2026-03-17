# Component: frontend/hooks

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `frontend/src/hooks/` |
| 类别 | frontend |
| 索引时间 | 2026-03-17 |

## 概述

前端自定义 React Hooks 模块，封装数据获取和状态管理逻辑。

## Hooks

### useApi.ts

| Hook | 说明 |
|------|------|
| `useItems` | 获取数据项列表（带缓存） |
| `usePacks` | 获取数据源包列表 |

### useFilters.ts

| Hook | 说明 |
|------|------|
| `useFilters` | 管理过滤状态（packs、sources、window、sort、search、page） |

## 状态管理

- URL 参数同步
- 本地状态缓存
- 防抖请求

## 关键词

`react`, `hooks`, `api`, `filters`, `state`

## 相关文件

- `frontend/src/lib/api.ts`
- `frontend/src/types/api.ts`
