# Component: cli/main

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/cli/main.ts` |
| 类别 | cli |
| 索引时间 | 2026-03-17 |

## 概述

CLI 入口模块，处理命令行参数并路由到对应的命令处理器。支持 run、sources、config、auth、archive、serve 等命令。

## 支持的命令

| 命令 | 说明 |
|------|------|
| `version` | 显示版本号 |
| `run` | 执行信息聚合查询 |
| `sources list` | 列出所有数据源包 |
| `config validate` | 验证配置文件 |
| `auth check` | 检查授权配置 |
| `auth status` | 显示授权状态 |
| `archive collect` | 归档收集 |
| `archive stats` | 归档统计 |
| `serve` | 启动 HTTP 服务 |

## 主流程

1. 解析 CLI 参数
2. 路由到对应命令处理器
3. 执行并输出结果

## 依赖

- `../ai/client` - AI 客户端
- `../config/load-pack` - 配置加载
- `../query/run-query` - 查询执行
- `../views/registry` - 视图渲染
- `./auth-commands` - 认证命令
- `./commands/*` - 各命令实现

## 关键词

`cli`, `command`, `main`, `entry`, `run`

## 相关文件

- `src/cli/index.ts`
- `src/cli/auth-commands.ts`
- `src/cli/commands/serve.ts`
- `src/cli/commands/archive.ts`
