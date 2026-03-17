# Component: types/index

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/types/index.ts` |
| 类别 | types |
| 索引时间 | 2026-03-17 |

## 概述

核心类型定义模块，定义整个系统的数据结构和接口契约。包含数据源、数据项、管道处理、评分系统等所有核心类型。

## 主要类型

### 数据源相关
- `Source` - 数据源定义
- `SourcePack` - 数据源包
- `SourceType` - 数据源类型枚举
- `InlineSource` - 内联数据源
- `AdapterFn` - 适配器函数签名

### 数据项相关
- `RawItem` - 原始数据项
- `NormalizedItem` - 标准化数据项
- `RankedCandidate` - 排名候选项
- `Cluster` - 聚类结果

### 元数据相关
- `RawItemMetadata` - 原始项元数据
- `RawItemEngagement` - 参与度数据
- `RawItemCanonicalHints` - 规范 URL 提示

### 评分系统
- `ExtractedContent` - 提取的正文内容
- `AiEnrichmentResult` - AI 增强结果
- `MultiDimensionalScore` - 多维评分
- `HighlightsResult` - 趋势洞察结果

### 配置相关
- `ParsedRunArgs` - CLI 运行参数
- `EnrichmentConfig` - enrichment 配置
- `AuthConfig` - 授权配置
- `TopicRule` - 主题规则

## 常量

- `CANONICAL_SOURCE_TYPES` - 支持的数据源类型列表
- `BUILTIN_VIEWS` - 内置视图列表

## 关键词

`types`, `interface`, `source`, `item`, `score`, `metadata`

## 相关文件

- 所有 src/ 下的模块都依赖此类型定义
