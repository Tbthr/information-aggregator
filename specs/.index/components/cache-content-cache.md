# Component: cache/content-cache

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/cache/content-cache.ts` |
| 类别 | cache |
| 索引时间 | 2026-03-17 |

## 概述

内容缓存模块，用于缓存提取的正文内容和 AI 处理结果。支持 TTL 过期和内存存储。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `ContentCache` | interface | 缓存接口 |
| `createContentCache` | function | 创建缓存实例 |

## 特性

- 内存存储
- TTL 过期控制
- 自动清理过期条目

## 关键词

`cache`, `content`, `ttl`, `memory`

## 相关文件

- `src/pipeline/extract-content.ts`
- `src/pipeline/enrich.ts`
