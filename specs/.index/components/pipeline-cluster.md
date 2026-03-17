# Component: pipeline/cluster

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/pipeline/cluster.ts` |
| 类别 | pipeline |
| 索引时间 | 2026-03-17 |

## 概述

聚类管道模块，将相似内容的项目聚合为聚类。基于标题相似度进行分组，减少内容冗余。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `buildClusters` | function | 构建内容聚类 |

## 聚类算法

1. 按最终分数降序排列项目
2. 遍历项目，检查与现有聚类的相似度
3. 相似度超过阈值则加入现有聚类
4. 否则创建新聚类

## 关键词

`cluster`, `group`, `similarity`, `dedupe`

## 相关文件

- `src/pipeline/dedupe-exact.ts`
- `src/pipeline/dedupe-near.ts`
