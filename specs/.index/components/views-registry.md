# Component: views/registry

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/views/registry.ts` |
| 类别 | views |
| 索引时间 | 2026-03-17 |

## 概述

视图注册与路由模块，根据视图 ID 选择对应的视图构建器和渲染器。支持 `daily-brief` 和 `x-analysis` 两种内置视图。

## 导出

| 名称 | 类型 | 说明 |
|------|------|------|
| `ViewModel` | interface | 视图模型结构定义 |
| `ViewModelSection` | interface | 视图章节结构 |
| `ViewModelItem` | interface | 视图项目结构 |
| `BuildViewDependencies` | interface | 视图构建依赖项 |
| `buildViewModel` | function | 构建视图模型 |
| `renderViewMarkdown` | function | 渲染 Markdown 输出 |
| `DailyBriefViewModel` | type | 每日简报视图类型 |
| `XAnalysisViewModel` | type | X 分析视图类型 |

## 依赖

- `../ai/client` - AI 客户端类型
- `../types/index` - 通用类型
- `../query/run-query` - 查询结果类型
- `./daily-brief` - 每日简报视图
- `./x-analysis` - X 分析视图
- `./render` - 渲染模块

## 关键词

`view`, `registry`, `render`, `daily-brief`, `x-analysis`

## 相关文件

- `src/views/daily-brief.ts`
- `src/views/x-analysis/index.ts`
- `src/views/render/index.ts`
