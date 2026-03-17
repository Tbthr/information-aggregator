# Component: api/server

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/api/server.ts` |
| 类别 | api |
| 索引时间 | 2026-03-17 |

## 概述

HTTP API 服务器模块，基于 Hono 框架实现。提供 RESTful API 端点和前端静态文件服务。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `createServer` | function | 创建 API 服务器实例 |
| `AppType` | type | 应用类型（用于类型推导） |

## API 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/items` | GET | 获取数据项列表 |
| `/api/packs` | GET | 获取数据源包列表 |
| `/api/health` | GET | 健康检查 |

## 中间件

- CORS 跨域支持
- 请求日志记录
- 静态文件服务

## 依赖

- `hono` - Web 框架
- `./routes/items` - Items 路由
- `./routes/packs` - Packs 路由
- `../db/client` - 数据库客户端
- `../cli/index` - CLI 版本信息

## 关键词

`api`, `server`, `hono`, `http`, `rest`

## 相关文件

- `src/api/routes/items.ts`
- `src/api/routes/packs.ts`
- `src/api/schemas/query.ts`
- `src/db/client.ts`
