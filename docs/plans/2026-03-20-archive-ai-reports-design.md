# AI 增强与报告生成设计方案

## 概述

为 `archive collect` 增加 AI 增强流程，并新增 `daily generate` 和 `weekly generate` 命令，实现完整的数据处理链路。

## CLI 命令

```bash
# 数据收集 + AI 增强
pnpm archive collect                    # 仅处理新数据
pnpm archive collect --backfill         # 补全历史空字段
pnpm archive collect --force            # 强制覆盖所有

# 日报生成
pnpm daily generate [--date YYYY-MM-DD] # 默认今天

# 周报生成
pnpm weekly generate [--date YYYY-MM-DD] # 默认本周
```

### 参数说明

| 命令 | 参数 | 作用 |
|------|------|------|
| `archive collect` | (无) | 仅对本次新抓取的 Item 做 AI 增强 |
| `archive collect` | `--backfill` | 对历史数据中空字段的 Item 补全 |
| `archive collect` | `--force` | 强制对所有 Item 重新做 AI 增强 |
| `daily generate` | `--date` | 指定日期，默认今天 |
| `weekly generate` | `--date` | 指定周，默认本周 |

## 数据流程

### archive collect

```
1. 加载 Packs 和 Sources
   ↓
2. 抓取数据 (RSS/JSON Feed/X 等)
   ↓
3. 写入 Item 表（基础字段：title, url, snippet...）
   ↓
4. 确定需要 AI 增强的 Item:
   - 默认：本次新增的 Item
   - --backfill：summary IS NULL 的 Item
   - --force：所有 Item
   ↓
5. AI 增强流程（对每个待增强 Item）:
   a) 提取正文内容 → Item.content, Item.imageUrl
   b) AI 生成 summary → Item.summary
   c) AI 生成 bullets → Item.bullets[]
   d) AI 生成 categories → Item.categories[]
   e) AI 评分 score → Item.score
   ↓
6. 更新 Item 表（AI 字段）
   ↓
7. 更新 SourceHealth
```

### daily generate

```
1. 查询当日 Item（publishedAt 在指定日期）
   - publishedAt >= 00:00 AND < 23:59:59
   - 按 score DESC 排序
   - 取 top maxItems (20)
   ↓
2. 选 spotlight（top maxSpotlight = 3）
   ↓
3. AI 生成日报概览（基于 spotlight + top items）
   - summary: 整体摘要
   - dayLabel: "X月X日"
   ↓
4. 写入 DailyOverview 表
   - date, dayLabel, summary
   - itemIds[], spotlightIds[]
```

### weekly generate

```
1. 计算周范围（默认本周一 ~ 今天）
   - weekNumber: "2026-W12"
   ↓
2. 按日期分组查询 Item
   - 7 天内按 score 排序
   - 每天取 top 5
   ↓
3. AI 生成周报内容
   - headline: 周标题
   - subheadline: 周副标题
   - editorial: 编辑评述
   ↓
4. 生成 TimelineEvent（每天一个）
   - date, dayLabel, title, summary
   - itemIds[]
   ↓
5. 写入 WeeklyReport + TimelineEvent
```

## 更新字段清单

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| content | @db.Text | 内容提取 | 正文内容 |
| imageUrl | String? | 内容提取 | 封面图 |
| summary | @db.Text | AI 生成 | 摘要 |
| bullets | String[] | AI 生成 | 关键要点 |
| categories | String[] | AI 生成 | 分类标签 |
| score | Float | AI 评分 | 质量评分 (1-10) |

## 文件结构

```
src/
├── cli/
│   ├── commands/
│   │   ├── archive.ts      # 修改：增加 AI 增强
│   │   ├── daily.ts        # 新增：日报生成
│   │   └── weekly.ts       # 新增：周报生成
│   ├── index.ts            # 修改：增加命令解析
│   └── main.ts             # 修改：增加命令路由
│
├── archive/
│   ├── upsert-prisma.ts    # 现有：基础写入
│   └── enrich-prisma.ts    # 新增：AI 增强逻辑
│
├── reports/
│   ├── daily.ts            # 新增：日报生成逻辑
│   └── weekly.ts           # 新增：周报生成逻辑
│
└── ai/
    └── prompts-reports.ts  # 新增：日报/周报 AI prompts
```

## 改动清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/cli/commands/archive.ts` | 修改 | 增加 AI 增强调用 + 参数 |
| `src/cli/commands/daily.ts` | 新增 | 日报命令 |
| `src/cli/commands/weekly.ts` | 新增 | 周报命令 |
| `src/cli/index.ts` | 修改 | 增加命令解析 |
| `src/cli/main.ts` | 修改 | 增加命令路由 |
| `src/archive/enrich-prisma.ts` | 新增 | Prisma 版 AI 增强 |
| `src/reports/daily.ts` | 新增 | 日报生成逻辑 |
| `src/reports/weekly.ts` | 新增 | 周报生成逻辑 |
| `src/ai/prompts-reports.ts` | 新增 | 报告相关 prompts |

## 并发控制

复用 `settings.yaml` 配置：
- 内容提取：concurrency=3, batchSize=5
- AI 调用：concurrency=2, batchSize=5

## 错误处理

- 单个 Item 增强失败 → 跳过，记录日志，继续处理其他
- AI 服务不可用 → 命令失败，提示用户检查配置

## 命令依赖

```
daily generate  → 需要 Item 有 score/summary（先 archive collect）
weekly generate → 需要 DailyOverview（先 daily generate）
```

## 测试计划

| 测试项 | 方法 |
|--------|------|
| AI 增强流程 | 单个 Item 端到端测试 |
| 增量处理 | 验证 --backfill/--force 参数 |
| 日报生成 | 验证 publishedAt 过滤 + AI summary |
| 周报生成 | 验证基于 DailyOverview 聚合 |
| 并发安全 | 多 Item 并发增强 |
