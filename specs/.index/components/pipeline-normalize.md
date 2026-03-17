# Component: pipeline/normalize

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/pipeline/normalize.ts` |
| 类别 | pipeline |
| 索引时间 | 2026-03-17 |

## 概述

数据标准化管道模块，负责将原始数据项 (RawItem) 转换为标准化数据项 (NormalizedItem)。处理 URL 规范化、标题/摘要文本标准化、参与度评分计算等。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `normalizeItems` | function | 批量标准化原始数据项 |

## 内部函数

- `toBoundedEngagementScore` - 计算有界的参与度评分
- `resolveRelationship` - 解析内容与规范 URL 的关系

## 依赖

- `../types/index` - 类型定义
- `../utils/metadata` - 元数据解析
- `./normalize-text` - 文本标准化
- `./normalize-url` - URL 标准化

## 关键词

`normalize`, `pipeline`, `canonical`, `engagement`, `dedup`

## 相关文件

- `src/pipeline/normalize-text.ts`
- `src/pipeline/normalize-url.ts`
- `src/pipeline/dedupe-exact.ts`
- `src/pipeline/dedupe-near.ts`
