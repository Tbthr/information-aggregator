# Component: pipeline/rank

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/pipeline/rank.ts` |
| 类别 | pipeline |
| 索引时间 | 2026-03-17 |

## 概述

排名管道模块，对候选项进行综合评分和排序。结合来源权重、时效性、参与度、主题匹配和 AI 质量评分。

## 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| sourceWeight | 15% | 来源权重 |
| freshness | 25% | 时效性 |
| engagement | 20% | 参与度 |
| topicMatch | 20% | 主题匹配 |
| contentQualityAi | 20% | AI 内容质量 |

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `rankCandidates` | function | 对候选项进行排名 |

## 关键词

`rank`, `score`, `pipeline`, `weight`, `sort`

## 相关文件

- `src/pipeline/enrich.ts`
- `src/pipeline/topic-match.ts`
- `src/types/index.ts`
