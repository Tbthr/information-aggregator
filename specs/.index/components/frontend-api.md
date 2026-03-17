---
name: Frontend API Client
description: 前端 API 客户端 - 与后端通信
category: frontend
source_path: frontend/src/lib/api.ts
content_hash: y5z6a7b8
timestamp: 2026-03-18
---

# Frontend API Client

## 概述

前端与后端 API 通信的客户端封装，提供类型安全的 API 调用。

## API 方法

| 方法 | 端点 | 描述 |
|------|------|------|
| `getItems(params)` | `GET /api/items` | 获取内容列表 |
| `getItem(id)` | `GET /api/items/:id` | 获取单个内容 |
| `getPacks(params)` | `GET /api/packs` | 获取 Pack 列表 |
| `getPack(id)` | `GET /api/packs/:id` | 获取 Pack 详情 |
| `getHealth()` | `GET /api/health` | 健康检查 |

## 查询参数

### getItems

| 参数 | 类型 | 描述 |
|------|------|------|
| `packs` | `string[]` | Pack ID 列表 |
| `window` | `string` | 时间窗口 |
| `sources` | `string[]` | 来源 ID 列表 |
| `sourceTypes` | `string[]` | 来源类型 |
| `sort` | `string` | 排序方式 |
| `page` | `number` | 页码 |
| `pageSize` | `number` | 每页数量 |
| `search` | `string` | 搜索词 |
| `minScore` | `number` | 最低分数 |

## 工具函数

| 函数 | 描述 |
|------|------|
| `formatTimeAgo(dateStr)` | 格式化相对时间 |
| `formatScore(score)` | 格式化分数 |

## 依赖关系

- `../types/api` - API 类型定义

## 关键词

api, client, fetch, http, frontend

## 相关文件

- [frontend/src/types/api.ts](frontend/src/types/api.ts)
- [frontend/src/hooks/useApi.ts](frontend/src/hooks/useApi.ts)
