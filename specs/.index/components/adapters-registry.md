# Component: adapters/registry

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/adapters/registry.ts` |
| 类别 | adapters |
| 索引时间 | 2026-03-17 |

## 概述

适配器注册表模块，提供适配器家族的注册和管理功能。支持批量注册共享相同 collect 函数和 auth 配置的适配器。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `AdapterFamily` | interface | 适配器家族定义接口 |
| `registerAdapterFamily` | function | 注册单个适配器家族 |
| `registerAdapterFamilies` | function | 批量注册多个适配器家族 |
| `getAdapterFamily` | function | 获取已注册的适配器信息 |
| `hasAdapter` | function | 检查适配器是否已注册 |

## 依赖

- `../types/index` - 类型定义
- `../config/load-auth` - Auth 配置合并

## 关键词

`adapter`, `registry`, `family`, `collect`, `auth`

## 相关文件

- `src/adapters/rss.ts`
- `src/adapters/json-feed.ts`
- `src/adapters/github-trending.ts`
- `src/adapters/x-bird.ts`
- `src/config/load-auth.ts`
