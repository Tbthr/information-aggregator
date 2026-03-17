---
name: Types (Core Models)
description: 核心类型定义 - 数据模型和接口
category: models
source_path: src/types/index.ts
content_hash: a1b2c3d4
timestamp: 2026-03-18
---

# Types - Core Models

## 概述

定义了信息聚合器的核心数据模型，包括数据源、内容项、处理流水线和 AI 增强结果的类型。

## 关键类型

### 数据源类型

| 类型 | 描述 |
|------|------|
| `SourceType` | 数据源类型 (rss, json-feed, hn, reddit, github_trending, x_* 等) |
| `InlineSource` | 内联数据源定义 |
| `Source` | 完整数据源 (InlineSource + id) |
| `SourcePack` | 数据源包 - 自包含配置单元 |
| `AuthConfig` | 授权配置 |

### 内容类型

| 类型 | 描述 |
|------|------|
| `RawItem` | 原始抓取项 |
| `NormalizedItem` | 标准化后的内容项 |
| `Cluster` | 去重聚类 |
| `RankedCandidate` | 排名候选项 |

### 处理类型

| 类型 | 描述 |
|------|------|
| `RunRecord` | 执行记录 |
| `OutputRecord` | 输出记录 |
| `SourceHealth` | 数据源健康状态 |

### AI 增强类型

| 类型 | 描述 |
|------|------|
| `ExtractedContent` | 正文提取结果 |
| `AiEnrichmentResult` | AI 增强结果 |
| `MultiDimensionalScore` | 多维评分 |
| `HighlightsResult` | 趋势洞察 |

## 依赖关系

- `./policy` - 策略类型

## 关键词

types, models, interfaces, data-structures, source, item, pipeline, ai

## 相关文件

- [src/types/policy.ts](src/types/policy.ts) - 策略定义
- [src/types/validation.ts](src/types/validation.ts) - 验证逻辑
