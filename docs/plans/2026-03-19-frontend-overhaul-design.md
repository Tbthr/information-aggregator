# 前端改造设计文档

## 概述

将 v0 生成的 RSS Reader UI 整合到 information-aggregator 项目，实现完整的前后端改造。

## 技术栈

| 层级 | 当前 | 目标 |
|------|------|------|
| 前端 | 无 | Next.js 16 + React 19 + shadcn/ui |
| API | Hono (Bun) | Next.js API Routes |
| ORM | 原生 SQL (bun:sqlite) | Prisma |
| 数据库 | SQLite | Supabase (PostgreSQL) |
| 部署 | 本地 | Vercel |

## 项目结构

```
项目根目录/
├── prisma/
│   └── schema.prisma          # Prisma schema
│
├── src/                       # 核心业务逻辑（保留）
│   ├── adapters/              # 数据获取适配器
│   ├── pipeline/              # 数据处理流水线
│   ├── scoring/               # 评分逻辑
│   ├── ai/                    # AI 服务调用
│   └── lib/                   # 工具函数
│
├── app/                       # Next.js 应用
│   ├── app/
│   │   ├── page.tsx           # 主页
│   │   ├── layout.tsx
│   │   └── api/               # API Routes
│   │       ├── items/route.ts
│   │       ├── packs/route.ts
│   │       ├── views/route.ts
│   │       └── ...
│   ├── components/            # 前端组件
│   │   ├── ui/                # shadcn/ui 基础组件
│   │   ├── daily-page.tsx
│   │   ├── weekly-page.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client
│   │   ├── api-client.ts      # 前端 API 调用
│   │   └── types.ts           # 类型定义
│   └── hooks/
│
├── public/
├── package.json
└── ...
```

## 数据库设计

### 核心表

#### Item（合并 raw_items + normalized_items + enrichment）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| title | String | 标题 |
| url | String | 原始 URL |
| canonicalUrl | String | 规范化 URL |
| snippet | String? | 摘要片段 |
| sourceId | String | 来源 ID |
| sourceName | String | 来源显示名 |
| sourceType | String | 来源类型 |
| packId | String? | Pack ID |
| publishedAt | DateTime? | 发布时间 |
| fetchedAt | DateTime | 抓取时间 |
| author | String? | 作者 |
| summary | String? | AI 摘要 |
| bullets | String[] | AI 要点列表 |
| content | String? | 完整正文 |
| imageUrl | String? | 封面图 |
| category | String? | 分类标签 |
| score | Float | 评分 |
| scoresJson | String? | 评分明细 |
| metadataJson | String? | 原始元数据 |

#### Source

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| type | String | 类型 |
| name | String | 显示名 |
| url | String? | URL |
| description | String? | 描述 |
| enabled | Boolean | 是否启用 |
| configJson | String? | 配置 |
| packId | String? | Pack ID |

#### Pack

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| name | String | 名称 |
| description | String? | 描述 |
| policyJson | String? | 策略配置 |

#### SavedItem

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| itemId | String | Item ID |
| savedAt | DateTime | 保存时间 |

#### NewsFlash

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| time | String | 时间显示（如 "09:30"）|
| text | String | 快讯内容 |
| itemId | String? | 关联 Item |

#### DailyOverview

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| date | String | 日期（唯一）|
| dayLabel | String | 星期 |
| summary | String | AI 概述 |

#### WeeklyReport

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| weekNumber | String | 周数 |
| headline | String | 标题 |
| subheadline | String? | 副标题 |
| editorial | String? | 社论 |

#### TimelineEvent

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| weeklyReportId | String | 周报 ID |
| date | String | 日期 |
| dayLabel | String | 星期 |
| title | String | 标题 |
| summary | String | 摘要 |
| order | Int | 排序 |

#### CustomView

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| name | String | 名称 |
| icon | String | 图标 |
| description | String? | 描述 |

#### CustomViewItem

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| viewId | String | 视图 ID |
| itemId | String | Item ID |
| order | Int | 排序 |

## API 设计

### RESTful API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/items | 查询内容列表 |
| GET | /api/items/:id | 获取单个内容 |
| POST | /api/items/:id/save | 保存内容 |
| DELETE | /api/items/:id/save | 取消保存 |
| GET | /api/items/saved | 获取已保存列表 |
| GET | /api/packs | 获取 Pack 列表 |
| GET | /api/sources | 获取来源列表 |
| GET | /api/views | 获取自定义视图 |
| GET | /api/daily | 获取每日概述 |
| GET | /api/weekly | 获取周报 |
| GET | /api/news-flashes | 获取快讯 |

### 查询参数

`/api/items` 支持以下查询参数：
- `packs`: Pack ID 列表（逗号分隔）
- `sources`: Source ID 列表
- `sourceTypes`: 来源类型列表
- `window`: 时间窗口（today, week, month）
- `page`: 页码
- `pageSize`: 每页数量
- `sort`: 排序方式（ranked, recent）
- `search`: 搜索关键词

## 数据映射

### ItemData → Article 映射

| Article 字段 | ItemData 来源 |
|-------------|--------------|
| id | id |
| title | title |
| source | sourceName ?? source.id |
| sourceUrl | url |
| publishedAt | formatDate(publishedAt) |
| summary | summary ?? snippet |
| bullets | bullets ?? [] |
| content | content ?? '' |
| imageUrl | imageUrl |
| category | category |
| aiScore | score |
| saved | savedAt != null |

## 部署配置

### Vercel 配置

```json
// vercel.json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["hkg1"],
  "env": {
    "DATABASE_URL": "@database_url"
  }
}
```

### 环境变量

- `DATABASE_URL`: Supabase PostgreSQL 连接字符串
- `NEXT_PUBLIC_API_URL`: API 基础 URL（可选）

## 迁移风险

1. **数据迁移**: 现有 SQLite 数据需要迁移到 Supabase
2. **功能对等**: 确保 Hono API 功能在 Next.js API Routes 中完整实现
3. **性能**: PostgreSQL 与 SQLite 的查询性能差异

## 后续扩展

1. 用户认证（Supabase Auth）
2. 实时更新（Supabase Realtime）
3. 全文搜索（PostgreSQL pg_trgm）
