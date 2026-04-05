# 配置系统重构设计方案

**日期**: 2026-04-05
**状态**: Approved

## 1. 背景与目标

当前配置系统存在以下问题：
- 4 个 YAML 配置文件 + AI env var config + Auth env var config，共 6 个配置来源
- 类型定义散落在 `src/types/index.ts`、`src/config/index.ts`、`src/ai/config/schema.ts`、`lib/types.ts` 多处
- ranking weights、URL、threshold、路径等硬编码值散布各处
- 默认值在加载器和消费者中不一致（如 `weightScore` 0.5 vs 1）
- YAML 加载后无 Schema 验证，错误只能在运行时发现
- `quadrantPrompt` 字段加载但从未使用

**目标**：
1. **规范化 + 简化**（地基）：统一 Schema、类型定义、加载器
2. **灵活性**（功能）：让硬编码值可配置

## 2. 配置文件重组

### 2.1 合并为 2 个配置文件

| 文件 | 说明 |
|------|------|
| `config/sources.yaml` | 保留，数据源定义（RSS、Twitter、GitHub 等，体量大且独立） |
| `config/config.yaml` | 新建，合并原 tags.yaml + reports.yaml + ai-flash-sources.yaml + 新增可配置项 |

### 2.2 config.yaml 结构

```yaml
tags:
  - id: ai-news
    name: AI 资讯
    description: ...
    includeRules: [...]
    excludeRules: [...]
    scoreBoost: 1.0

enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000

aiFlashCategorization:
  enabled: true
  maxCategories: 6
  prompt: |
    你是一个内容分类助手...

ranking:
  sourceWeight: 0.4
  engagement: 0.15

dedupe:
  nearThreshold: 0.75

content:
  truncationMarkers:
    - "[...]"
    - "Read more"
    - "来源："

aiFlashSources:
  - id: hexi-daily
    adapter: hexi-daily
    url: https://r.jina.ai/https://ai.hubtoday.app/{month}/{date}/
    enabled: true
  - id: juya-daily
    adapter: juya-daily
    url: https://imjuya.github.io/juya-ai-daily/rss.xml
    enabled: true
  - id: clawfeed-daily
    adapter: clawfeed-daily
    url: https://clawfeed.kevinhe.io/feed/kevin
    enabled: true
```

## 3. 类型定义统一

新建 `src/types/config.ts`，用 Zod 统一定义所有配置 Schema：

```typescript
// src/types/config.ts
import { z } from 'zod'

export const TagSchema = z.object({...})
export const EnrichSchema = z.object({...})
export const RankingSchema = z.object({
  sourceWeight: z.number().optional().default(0.4),
  engagement: z.number().optional().default(0.15),
})
export const DedupeSchema = z.object({
  nearThreshold: z.number().optional().default(0.75),
})
export const ContentSchema = z.object({
  truncationMarkers: z.array(z.string()).optional().default([...]),
})
export const AiFlashSourceSchema = z.object({
  id: z.string(),
  adapter: z.enum(['hexi-daily', 'juya-daily', 'clawfeed-daily']),
  url: z.string(),
  enabled: z.boolean().optional().default(true),
})
export const AppConfigSchema = z.object({...})

export type AppConfig = z.infer<typeof AppConfigSchema>
```

## 4. 统一加载器

重构 `src/config/index.ts`，单一 `loadConfig()` 函数：
- 加载 `sources.yaml`（保持原有结构，不走 Zod）
- 加载 `config.yaml`（走 Zod 校验）
- 合并后统一导出

## 5. 清理工作

| 清理项 | 说明 |
|--------|------|
| `config/tags.yaml` | 删除，内容合并至 config.yaml |
| `config/reports.yaml` | 删除，内容合并至 config.yaml |
| `config/ai-flash-sources.yaml` | 删除，内容合并至 config.yaml |
| `lib/types.ts` | 清理重复类型定义 |
| `src/config/index.ts` 中旧类型 | 迁移至 `src/types/config.ts` |
| `quadrantPrompt` | 删除，从未使用 |
| `weightScore` 默认值不一致 | 统一为 1 |
| Twitter auth env var 名称 | 统一为 `TWITTER_AUTH_TOKEN`、`TWITTER_CT0` |

## 6. 第二步：灵活性（硬编码值可配置）

第一步完成后，以下硬编码值全部可通过 `config.yaml` 配置：

| 配置项 | config.yaml 路径 | 默认值 |
|--------|-----------------|--------|
| source weight 因子 | `ranking.sourceWeight` | 0.4 |
| engagement 因子 | `ranking.engagement` | 0.15 |
| 近义去重 threshold | `dedupe.nearThreshold` | 0.75 |
| 内容截断标记 | `content.truncationMarkers` | [...] |
| AI flash URLs | `aiFlashSources[].url` | 3个URL |
| enrich 参数 | `enrich.batchSize` 等 | 10/500/20000 |

## 7. 关键文件变更

| 文件 | 操作 |
|------|------|
| `config/sources.yaml` | 保留 |
| `config/config.yaml` | 新建 |
| `config/tags.yaml` | 删除 |
| `config/reports.yaml` | 删除 |
| `config/ai-flash-sources.yaml` | 删除 |
| `src/types/config.ts` | 新建 |
| `src/types/index.ts` | 修改 |
| `src/config/index.ts` | 重写 |
| `lib/types.ts` | 清理 |

## 8. 验证方法

1. `bun run typecheck` — TypeScript 类型检查通过
2. `bun test` — 所有测试通过
3. `bun run src/cli/run.ts -t 1h` — CLI 正常运行，日报生成正确
4. Zod 校验在配置错误时给出清晰错误信息
