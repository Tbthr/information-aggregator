---
name: AI Client
description: AI 客户端 - 多提供商支持
category: services
source_path: src/ai/client.ts
content_hash: q7r8s9t0
timestamp: 2026-03-18
---

# AI Client

## 概述

AI 客户端入口点，提供统一的 AI 服务接口，支持多个提供商 (Anthropic, OpenAI, Gemini)。

## 导出类型

| 类型 | 描述 |
|------|------|
| `AiProviderConfig` | 提供商配置 |
| `AnthropicConfig` | Anthropic 配置 |
| `GeminiConfig` | Gemini 配置 |
| `AiClient` | 客户端接口 |
| `FilterItem` | 过滤项 |
| `PackContext` | Pack 上下文 |
| `FilterJudgment` | 过滤判断 |

## 导出函数

| 函数 | 描述 |
|------|------|
| `createAiClient` | 创建 AI 客户端 |
| `loadSettings` | 加载设置 |
| `clearSettingsCache` | 清除设置缓存 |
| `ProviderAiClient` | 提供商客户端基类 |
| `AnthropicClient` | Anthropic 客户端 |
| `GeminiClient` | Gemini 客户端 |

## AI 功能模块

- `prompts.ts` - 通用提示词
- `prompts-filter.ts` - 过滤提示词
- `prompts-enrichment.ts` - 增强提示词
- `prompts-highlights.ts` - 摘要提示词
- `prompts-daily-brief.ts` - 日报提示词
- `prompts-x-analysis.ts` - X 分析提示词

## 依赖关系

- `./types` - AI 类型定义
- `./config/schema` - 配置 Schema
- `./providers` - 提供商实现

## 关键词

ai, client, llm, anthropic, gemini, openai, prompts

## 相关文件

- [src/ai/providers/index.ts](src/ai/providers/index.ts)
- [src/ai/providers/anthropic.ts](src/ai/providers/anthropic.ts)
- [src/ai/providers/gemini.ts](src/ai/providers/gemini.ts)
- [src/ai/config/load.ts](src/ai/config/load.ts)
