---
name: Adapter Registry
description: 适配器注册表 - 数据源适配器管理
category: services
source_path: src/adapters/registry.ts
content_hash: e5f6g7h8
timestamp: 2026-03-18
---

# Adapter Registry

## 概述

管理数据源适配器的注册和查找。支持适配器家族批量注册，共享 collect 函数和 auth 配置。

## 关键接口

### AdapterFamily

```typescript
interface AdapterFamily {
  names: readonly string[];  // 适配器名称列表
  collect: AdapterFn;        // collect 函数
  authKey?: string;          // auth 配置的 key
}
```

## 主要函数

| 函数 | 描述 |
|------|------|
| `registerAdapterFamily` | 注册一个适配器家族 |
| `registerAdapterFamilies` | 批量注册多个适配器家族 |
| `getAdapterFamily` | 获取已注册的适配器家族信息 |
| `hasAdapter` | 检查适配器是否已注册 |

## 依赖关系

- `../types/index` - 类型定义
- `../config/load-auth` - Auth 配置合并

## 已实现适配器

- `rss.ts` - RSS/Atom 订阅
- `json-feed.ts` - JSON Feed 订阅
- `github-trending.ts` - GitHub Trending
- `x-bird.ts` - X/Twitter (通过 bird-api)
- `feed-discovery.ts` - Feed 自动发现

## 关键词

adapter, registry, data-source, collector, rss, feed

## 相关文件

- [src/adapters/rss.ts](src/adapters/rss.ts)
- [src/adapters/json-feed.ts](src/adapters/json-feed.ts)
- [src/adapters/github-trending.ts](src/adapters/github-trending.ts)
- [src/adapters/x-bird.ts](src/adapters/x-bird.ts)
