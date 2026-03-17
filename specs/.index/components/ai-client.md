# Component: ai/client

## 元数据

| 字段 | 值 |
|------|-----|
| 路径 | `src/ai/client.ts` |
| 类别 | ai |
| 索引时间 | 2026-03-17 |

## 概述

AI 客户端入口模块，重导出所有 AI 相关类型和工厂函数。提供统一的 AI 服务访问接口。

## 导出类型

| 名称 | 说明 |
|------|------|
| `AiProviderConfig` | AI 提供商配置 |
| `AnthropicConfig` | Anthropic 配置 |
| `GeminiConfig` | Gemini 配置 |
| `AiClient` | AI 客户端接口 |
| `AiSettings` | AI 设置 |
| `AiProviderType` | 提供商类型 |

## 导出函数

| 名称 | 说明 |
|------|------|
| `createAiClient` | 创建 AI 客户端实例 |
| `loadSettings` | 加载 AI 设置 |
| `clearSettingsCache` | 清除设置缓存 |

## 依赖

- `./types` - AI 类型定义
- `./config/schema` - 配置 schema
- `./providers` - 提供商实现

## 关键词

`ai`, `client`, `provider`, `anthropic`, `gemini`

## 相关文件

- `src/ai/providers/anthropic.ts`
- `src/ai/providers/gemini.ts`
- `src/ai/providers/openai.ts`
- `src/ai/providers/base.ts`
- `src/ai/config/load.ts`
