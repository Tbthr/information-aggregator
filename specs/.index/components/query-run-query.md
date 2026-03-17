# Component: query/run-query

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/query/run-query.ts` |
| 类别 | query |
| 索引时间 | 2026-03-17 |

## 概述

查询执行引擎，协调整个数据处理管道。从配置加载、数据收集、标准化、去重、排名到聚类，完成完整的信息聚合流程。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `RunQueryDependencies` | interface | 查询执行依赖项 |
| `QueryResult` | interface | 查询结果结构 |
| `runQuery` | function | 执行查询的主函数 |

## 处理流程

1. 加载数据源包 (SourcePacks)
2. 加载 Auth 配置
3. 解析数据源选择
4. 收集数据 (collect)
5. 过滤时间窗口
6. 标准化 (normalize)
7. 精确去重 (dedupeExact)
8. 近似去重 (dedupeNear)
9. 增强 & 排名 (enrich + rank)
10. 聚类 (cluster)

## 内部函数

- `buildTopicRule` - 构建主题规则
- `buildDefaultCollectDependencies` - 构建默认收集依赖
- `resolveItemTimestamp` - 解析项目时间戳
- `resolveWindowRange` - 解析时间窗口范围
- `filterItemsToRange` - 按时间窗口过滤
- `toCandidates` - 转换为候选项目

## 依赖

- `../ai/client` - AI 客户端
- `../adapters/*` - 数据适配器
- `../config/*` - 配置加载
- `../pipeline/*` - 数据处理管道
- `./resolve-selection` - 选择解析

## 关键词

`query`, `pipeline`, `collect`, `normalize`, `rank`, `cluster`

## 相关文件

- `src/query/resolve-selection.ts`
- `src/query/parse-cli.ts`
- `src/pipeline/collect.ts`
- `src/pipeline/normalize.ts`
- `src/pipeline/rank.ts`
