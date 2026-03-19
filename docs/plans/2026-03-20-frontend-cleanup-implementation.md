# Frontend Cleanup & Documentation Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix nested `app/app/` directory structure, remove mock data fallbacks, and update outdated documentation.

**Architecture:** Move Next.js app to root `app/` directory, convert API routes to pure real data mode, rewrite README/AGENTS/TEST docs.

**Tech Stack:** Next.js 16 App Router, Prisma, Supabase, pnpm

---

## Phase 1: Directory Restructure

### Task 1.1: Update tsconfig.json paths

**Files:**
- Modify: `tsconfig.json`

**Step 1: Update paths configuration**

Change `@/*` from `./app/*` to `./*` to support root-level imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Step 2: Verify TypeScript still resolves imports**

```bash
pnpm tsc --noEmit
```

Expected: No new errors (existing errors from src/ are unrelated)

**Step 3: Commit**

```bash
git add tsconfig.json && git commit -m "chore: update tsconfig paths for root-level imports"
```

---

### Task 1.2: Move app/app/* to app/ (App Router)

**Files:**
- Move: `app/app/api/` → `app/api/`
- Move: `app/app/layout.tsx` → `app/layout.tsx`
- Move: `app/app/page.tsx` → `app/page.tsx`
- Move: `app/app/globals.css` → `app/globals.css`
- Delete: `app/app/` directory (after move)

**Step 1: Move App Router files**

```bash
# Move app router files to root app/
mv app/app/api app/api
mv app/app/layout.tsx app/layout.tsx
mv app/app/page.tsx app/page.tsx
mv app/app/globals.css app/globals.css

# Remove empty app/app directory
rmdir app/app
```

**Step 2: Verify build**

```bash
pnpm build
```

Expected: Build succeeds with routes at `/`, `/api/*`, etc.

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor: move Next.js App Router to root app/ directory"
```

---

### Task 1.3: Move components, hooks, lib to root

**Files:**
- Move: `app/components/` → `components/`
- Move: `app/hooks/` → `hooks/`
- Move: `app/lib/` → `lib/`
- Delete: `app/next-env.d.ts` (use root next-env.d.ts)

**Step 1: Move directories**

```bash
mv app/components components
mv app/hooks hooks
mv app/lib lib
rm app/next-env.d.ts app/tsconfig.json 2>/dev/null || true
```

**Step 2: Verify build**

```bash
pnpm build
```

Expected: Build succeeds, all `@/components/*`, `@/hooks/*`, `@/lib/*` imports resolve correctly.

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor: move components, hooks, lib to root level"
```

---

### Task 1.4: Update root next-env.d.ts

**Files:**
- Modify: `next-env.d.ts`

**Step 1: Ensure next-env.d.ts references correct location**

The root `next-env.d.ts` should already exist. Verify it contains:

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.
```

**Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit (if changes)**

```bash
git add next-env.d.ts && git commit -m "chore: update next-env.d.ts" || echo "No changes needed"
```

---

### Task 1.5: Verify final structure and build

**Files:**
- N/A (verification task)

**Step 1: List final structure**

```bash
ls -la app/ components/ hooks/ lib/
```

Expected output:
```
app/:
api/  globals.css  layout.tsx  page.tsx

components/:
article-card.tsx  config-page.tsx  custom-view-page.tsx  ...
```

**Step 2: Full build verification**

```bash
pnpm build
```

Expected: All routes compile successfully, URL paths are now `/`, `/api/*`, `/daily`, etc.

**Step 3: Commit (if any cleanup needed)**

```bash
git add -A && git commit -m "chore: cleanup after directory restructure" || echo "Clean"
```

---

## Phase 2: Data Mode - Remove Mock Fallbacks

### Task 2.1: Create API data formats documentation

**Files:**
- Create: `docs/api-data-formats.md`

**Step 1: Create documentation file**

```markdown
# API Data Formats Reference

This document describes the response formats for all API endpoints.

## Common Response Structure

All API endpoints follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    timing?: {
      generatedAt: string
      latencyMs: number
    }
    pagination?: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  }
}
```

## Items API

### GET /api/items

Query parameters:
- `packs`: Comma-separated pack IDs
- `sources`: Comma-separated source IDs
- `sourceTypes`: Comma-separated source types
- `window`: "today" | "week" | "month" (default: "week")
- `page`: number (default: 1)
- `pageSize`: number (default: 20, max: 100)
- `sort`: "ranked" | "recent" (default: "ranked")
- `search`: string (optional)

Response:
```typescript
{
  success: true,
  data: {
    items: Array<{
      id: string
      title: string
      url: string
      canonicalUrl: string
      source: { id: string, type: string, packId: string }
      publishedAt: string | null
      fetchedAt: string
      snippet: string | null
      author: string | null
      score: number
      scores: {
        sourceWeight: number
        freshness: number
        engagement: number
        contentQuality: number
      }
      saved?: { savedAt: string }
    }>,
    sources: Array<{
      id: string
      type: string
      packId: string
      itemCount: number
    }>
  },
  meta: { ... }
}
```

## Daily API

### GET /api/daily

Response:
```typescript
{
  success: true,
  data: {
    overview: {
      date: string
      summary: string
    } | null,
    spotlightArticles: Array<Article>,
    recommendedArticles: Array<Article>,
    newsFlashes: Array<{
      id: string
      time: string
      text: string
    }>
  }
}
```

Article structure:
```typescript
interface Article {
  id: string
  title: string
  source: string
  sourceUrl: string
  publishedAt: string
  summary: string
  bullets: string[]
  content: string
  imageUrl?: string
  category?: string
  aiScore: number
}
```

## Weekly API

### GET /api/weekly

Response:
```typescript
{
  success: true,
  data: {
    hero: {
      weekNumber: string
      headline: string
      subheadline: string
      editorial: string
    } | null,
    timelineEvents: Array<{
      id: string
      date: string
      dayLabel: string
      title: string
      summary: string
    }>,
    deepDives: Array<Article>
  }
}
```

## News Flashes API

### GET /api/news-flashes

Response:
```typescript
{
  success: true,
  data: {
    newsFlashes: Array<{
      id: string
      time: string
      text: string
      itemId?: string
    }>
  }
}
```

## Packs API

### GET /api/packs

Response:
```typescript
{
  success: true,
  data: {
    packs: Array<{
      id: string
      name: string
      description: string | null
      sourceCount: number
    }>
  }
}
```

## Sources API

### GET /api/sources

Response:
```typescript
{
  success: true,
  data: {
    sources: Array<{
      id: string
      type: string
      packId: string
      config: Record<string, unknown>
    }>,
    configSources: Array<{
      id: string
      type: string
      packId: string
    }>
  }
}
```

## Views API

### GET /api/views

Response:
```typescript
{
  success: true,
  data: {
    views: Array<{
      id: string
      name: string
      icon: string
      description: string
      itemCount: number
    }>
  }
}
```

## Saved Items API

### GET /api/items/saved

Response: Same structure as `/api/items`

### POST /api/items/[id]/save

Response:
```typescript
{
  success: true,
  data: { savedAt: string }
}
```

### DELETE /api/items/[id]/save

Response:
```typescript
{
  success: true,
  data: { message: string }
}
```
```

**Step 2: Commit**

```bash
git add docs/api-data-formats.md && git commit -m "docs: add API data formats reference"
```

---

### Task 2.2: Remove mock fallback from daily route

**Files:**
- Modify: `app/api/daily/route.ts`

**Step 1: Remove mock imports and fallback logic**

Update the file to use only database data:

```typescript
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toArticle(item: {
  id: string
  title: string
  sourceName: string
  url: string
  publishedAt: Date | null
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  category: string | null
  score: number
}) {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName,
    sourceUrl: item.url,
    publishedAt: item.publishedAt?.toISOString() ?? "",
    summary: item.summary ?? "",
    bullets: item.bullets,
    content: item.content ?? "",
    imageUrl: item.imageUrl ?? undefined,
    category: item.category ?? undefined,
    aiScore: item.score,
  }
}

export async function GET() {
  try {
    const startTime = Date.now()
    const [overview, items, flashes] = await Promise.all([
      prisma.dailyOverview.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.item.findMany({
        orderBy: [{ score: "desc" }, { fetchedAt: "desc" }],
        take: 6,
      }),
      prisma.newsFlash.findMany({
        orderBy: [{ createdAt: "desc" }, { time: "desc" }],
        take: 12,
      }),
    ])

    const spotlight = items.slice(0, 2).map(toArticle)
    const recommended = items.slice(2).map(toArticle)

    return NextResponse.json({
      success: true,
      data: {
        overview: overview
          ? {
              date: overview.date,
              summary: overview.summary,
            }
          : null,
        spotlightArticles: spotlight,
        recommendedArticles: recommended,
        newsFlashes: flashes.map((flash) => ({
          id: flash.id,
          time: flash.time,
          text: flash.text,
        })),
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/daily:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load daily data" },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add app/api/daily/route.ts && git commit -m "refactor: remove mock fallback from daily API"
```

---

### Task 2.3: Remove mock fallback from weekly route

**Files:**
- Modify: `app/api/weekly/route.ts`

**Step 1: Remove mock imports and fallback logic**

```typescript
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const startTime = Date.now()
    const report = await prisma.weeklyReport.findFirst({
      include: {
        timelineEvents: {
          orderBy: [{ order: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: {
        hero: report
          ? {
              weekNumber: report.weekNumber,
              headline: report.headline,
              subheadline: report.subheadline ?? "",
              editorial: report.editorial ?? "",
            }
          : null,
        timelineEvents: report?.timelineEvents.map((event) => ({
          id: event.id,
          date: event.date,
          dayLabel: event.dayLabel,
          title: event.title,
          summary: event.summary,
        })) ?? [],
        deepDives: [], // Will be populated from database when DeepDive model is added
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/weekly:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load weekly data" },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add app/api/weekly/route.ts && git commit -m "refactor: remove mock fallback from weekly API"
```

---

### Task 2.4: Remove mock fallback from news-flashes route

**Files:**
- Modify: `app/api/news-flashes/route.ts`

**Step 1: Remove mock import and fallback logic**

```typescript
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const startTime = Date.now()
    const flashes = await prisma.newsFlash.findMany({
      orderBy: [{ createdAt: "desc" }, { time: "desc" }],
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: {
        newsFlashes: flashes.map((flash) => ({
          id: flash.id,
          time: flash.time,
          text: flash.text,
          itemId: flash.itemId,
        })),
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/news-flashes:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load news flashes" },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add app/api/news-flashes/route.ts && git commit -m "refactor: remove mock fallback from news-flashes API"
```

---

### Task 2.5: Delete mock-data.ts

**Files:**
- Delete: `lib/mock-data.ts`

**Step 1: Remove mock data file**

```bash
rm lib/mock-data.ts
```

**Step 2: Verify no imports remain**

```bash
grep -r "mock-data" app/ components/ hooks/ lib/ 2>/dev/null || echo "No mock-data imports found"
```

Expected: "No mock-data imports found"

**Step 3: Verify build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: remove mock-data.ts"
```

---

## Phase 3: Documentation Update

### Task 3.1: Rewrite AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**Step 1: Write new AGENTS.md content**

```markdown
# AI Agent Guide — Information Aggregator

## Project Overview

Information Aggregator 是一个基于 Next.js 16 的信息聚合平台，通过 Prisma + Supabase 存储数据，提供日报、周报、收藏等功能。

### Tech Stack

- **Frontend**: Next.js 16 App Router, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Prisma ORM, Supabase PostgreSQL
- **Package Manager**: pnpm

### Directory Structure

```
information-aggregator/
├── app/              # Next.js App Router
│   ├── api/          # API Routes (/api/*)
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page (/)
├── components/       # React components
│   └── ui/           # shadcn/ui components
├── hooks/            # Custom React hooks
├── lib/              # Utilities (api-client, prisma, types)
├── src/              # Backend pipeline code
├── prisma/           # Database schema
├── config/           # YAML configuration files
└── docs/             # Documentation
```

### Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Daily overview |
| `/saved` | Saved articles |
| `/config` | Configuration page |

## Development Workflow

### Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm 9+

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server (localhost:3000) |
| `pnpm build` | Production build + TypeScript check |
| `pnpm lint` | ESLint check |
| `pnpm start` | Start production server |

### Development Guidelines

1. **Type Safety**: All code must pass TypeScript checks
2. **Component Pattern**: Use shadcn/ui components when available
3. **API Client**: Use `@/lib/api-client` for all API calls
4. **Hooks**: Use `@/hooks/use-items` and `@/hooks/use-saved` for data fetching

## Testing & Verification

### Build Verification

Before committing frontend changes:

```bash
pnpm build
```

Expected: Build succeeds with no errors.

### Manual Verification

For UI changes, verify in browser:
1. Home page (`/`) - daily overview structure
2. Saved page (`/saved`) - save/unsave functionality
3. Empty states - when database has no data

### Database Connection

Ensure `.env` contains valid Supabase credentials:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

## API Reference

See `docs/api-data-formats.md` for complete API documentation.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/items` | GET | List items with filters |
| `/api/daily` | GET | Daily overview data |
| `/api/weekly` | GET | Weekly report data |
| `/api/items/saved` | GET | List saved items |
| `/api/items/[id]/save` | POST | Save an item |
| `/api/items/[id]/save` | DELETE | Unsave an item |

## Git Workflow

### Commit Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation update
- `chore:` - Maintenance tasks

### Branch Naming

- `feature/<name>` - New features
- `fix/<name>` - Bug fixes
- `refactor/<name>` - Refactoring

## Known Issues

1. **Empty States**: When database is empty, UI shows empty states (expected behavior)
2. **Deep Dives**: Weekly report deep dives not yet implemented (returns empty array)
```

**Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "docs: rewrite AGENTS.md for current Next.js architecture"
```

---

### Task 3.2: Rewrite README.md

**Files:**
- Modify: `README.md`

**Step 1: Write new README.md content**

```markdown
# Information Aggregator

一个现代化的信息聚合平台，帮助您高效管理和发现有价值的内容。

## 功能特性

- **日报视图** - 每日精选内容概览
- **周报视图** - 本周热点和深度分析
- **收藏功能** - 保存感兴趣的文章
- **自定义视图** - 按需组织内容

## 快速开始

### 环境要求

- Node.js 20.19+ 或 22.12+
- pnpm 9+

### 安装

```bash
# 克隆仓库
git clone <repo-url>
cd information-aggregator

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接信息
```

### 配置

创建 `.env` 文件：

```env
# Supabase PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
```

### 开发

```bash
# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

### 构建

```bash
# 生产构建
pnpm build

# 启动生产服务器
pnpm start
```

## 前端入口

| 路径 | 描述 |
|------|------|
| `/` | 日报首页 |
| `/saved` | 收藏的文章 |
| `/config` | 配置管理 |

## 技术栈

### 前端
- [Next.js 16](https://nextjs.org/) - React 框架
- [Tailwind CSS](https://tailwindcss.com/) - 样式方案
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库

### 后端
- [Prisma](https://www.prisma.io/) - ORM
- [Supabase](https://supabase.com/) - PostgreSQL 数据库

## 部署

### Vercel (推荐)

项目已配置 Vercel 部署，推送代码后自动部署。

```bash
# 或使用 Vercel CLI
vercel
```

### 环境变量

确保在部署平台配置：
- `DATABASE_URL`
- `DIRECT_URL`

## 文档

- [API 数据格式](docs/api-data-formats.md) - API 响应结构参考
- [开发者指南](AGENTS.md) - AI 协作和开发规范

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md && git commit -m "docs: rewrite README.md for users"
```

---

### Task 3.3: Delete TEST.md

**Files:**
- Delete: `TEST.md`

**Step 1: Remove TEST.md**

```bash
rm TEST.md
```

**Step 2: Commit**

```bash
git add -A && git commit -m "docs: remove TEST.md (content merged into AGENTS.md)"
```

---

## Final Verification

### Task 4.1: Final build and verification

**Files:**
- N/A (verification task)

**Step 1: Full build**

```bash
pnpm build
```

Expected: All routes compile successfully.

**Step 2: Verify routes**

```bash
# After build, check .next for compiled routes
ls .next/server/app/
```

Expected: `api/` directory, `page.js`, `layout.js` at root level (no nested app/)

**Step 3: Final commit (if needed)**

```bash
git add -A && git commit -m "chore: final cleanup" || echo "Already clean"
```

**Step 4: Summary**

Report:
- Directory restructure: `app/app/` → `app/` ✓
- Mock removal: All API routes now use real data ✓
- Documentation: README.md, AGENTS.md updated, TEST.md removed ✓
- Build: Passing ✓
