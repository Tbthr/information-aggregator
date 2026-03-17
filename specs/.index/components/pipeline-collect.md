# Component: pipeline/collect

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/pipeline/collect.ts` |
| 类别 | pipeline |
| 索引时间 | 2026-03-17 |

## 概述

数据收集管道模块，负责从多个数据源并发收集原始数据项。支持顺序和并行两种执行模式，提供事件回调用于监控收集状态。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `CollectSourceEvent` | interface | 收集事件结构 |
| `AdapterFn` | type | 适配器函数类型 |
| `CollectDependencies` | interface | 收集依赖配置 |
| `collectSources` | function | 收集数据源的主函数 |

## 内部函数

- `defaultProviderForSourceType` - 获取数据源类型的默认 provider
- `defaultContentTypeForSourceType` - 获取默认内容类型
- `buildCanonicalHints` - 构建规范 URL 提示
- `normalizeCollectedItem` - 标准化收集的项目
- `collectSourcesSequential` - 顺序收集实现

## 特性

- 支持并发收集（可配置并发数）
- 事件回调监控收集状态
- 自动标准化收集项的元数据

## 依赖

- `../types/index` - 类型定义
- `../utils/metadata` - 元数据解析
- `../ai/concurrency` - 并发控制
- `../utils/logger` - 日志

## 关键词

`collect`, `pipeline`, `adapter`, `concurrency`, `source`

## 相关文件

- `src/adapters/registry.ts`
- `src/adapters/rss.ts`
- `src/adapters/json-feed.ts`
- `src/ai/concurrency.ts`
