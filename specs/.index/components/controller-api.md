---
name: API Server
description: API 服务器 - Hono 框架 REST API
category: controllers
source_path: src/api/server.ts
content_hash: i9j0k1l2
timestamp: 2026-03-18
---

# API Server

## 概述

基于 Hono 框架的 REST API 服务器，提供数据查询和前端静态文件服务。

## 路由端点

| 路由 | 描述 |
|------|------|
| `GET /api/items` | 获取内容项列表 |
| `GET /api/items/:id` | 获取单个内容项 |
| `GET /api/packs` | 获取 Pack 列表 |
| `GET /api/packs/:id` | 获取 Pack 详情 |
| `GET /api/views/*` | 视图相关接口 |
| `GET /api/sources/*` | 数据源接口 |
| `GET /api/health` | 健康检查 |

## 中间件

- `cors()` - 跨域支持
- `logger()` - 请求日志

## 静态文件服务

- `/assets/*` → `./frontend/dist/assets/`
- `/*` → `./frontend/dist/`

## 依赖关系

- `hono` - Web 框架
- `./routes/items` - Items 路由
- `./routes/packs` - Packs 路由
- `./routes/views` - Views 路由
- `./routes/sources` - Sources 路由

## 关键词

api, server, hono, rest, routes, http

## 相关文件

- [src/api/routes/items.ts](src/api/routes/items.ts)
- [src/api/routes/packs.ts](src/api/routes/packs.ts)
- [src/api/routes/views.ts](src/api/routes/views.ts)
- [src/api/routes/sources.ts](src/api/routes/sources.ts)
