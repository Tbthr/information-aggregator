---
name: Pipeline Collect
description: 数据收集管道 - 多源并发抓取
category: services
source_path: src/pipeline/collect.ts
content_hash: m3n4o5p6
timestamp: 2026-03-18
---

# Pipeline Collect

## 概述

数据收集管道的核心模块，负责从多个数据源并发抓取内容，支持顺序和并行两种执行模式。

## 主要函数

### collectSources

```typescript
async function collectSources(
  sources: Source[],
  dependencies: CollectDependencies
): Promise<RawItem[]>
```

从多个数据源收集内容项。

### CollectDependencies

| 属性 | 类型 | 描述 |
|------|------|------|
| `adapters` | `Record<string, AdapterFn>` | 适配器映射 |
| `onSourceEvent` | `(event) => void` | 事件回调 |
| `concurrency` | `number` | 并发数 (可选) |

## 执行模式

- **顺序执行**: `concurrency` 为 undefined 或 1
- **并行执行**: `concurrency > 1` 时启用

## 事件类型

| 状态 | 描述 |
|------|------|
| `success` | 成功抓取 |
| `failure` | 抓取失败 |
| `zero-items` | 无内容返回 |

## 依赖关系

- `../types/index` - 类型定义
- `../utils/metadata` - 元数据解析
- `../ai/concurrency` - 并发控制

## 关键词

pipeline, collect, fetch, concurrent, adapter, source

## 相关文件

- [src/pipeline/normalize.ts](src/pipeline/normalize.ts)
- [src/pipeline/rank.ts](src/pipeline/rank.ts)
- [src/pipeline/enrich.ts](src/pipeline/enrich.ts)
