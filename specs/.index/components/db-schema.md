# Component: db/schema

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/db/schema.ts` |
| 类别 | db |
| 索引时间 | 2026-03-17 |

## 概述

数据库 Schema 定义模块，定义核心数据表的名称常量。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `CORE_TABLES` | const | 核心数据表列表 |

## 核心表

| 表名 | 说明 |
|------|------|
| `sources` | 数据源 |
| `source_packs` | 数据源包 |
| `raw_items` | 原始数据项 |
| `normalized_items` | 标准化数据项 |
| `clusters` | 聚类结果 |
| `runs` | 运行记录 |
| `outputs` | 输出记录 |
| `source_health` | 数据源健康状态 |

## 关键词

`db`, `schema`, `table`, `sqlite`

## 相关文件

- `src/db/client.ts`
- `src/db/queries/*.ts`
