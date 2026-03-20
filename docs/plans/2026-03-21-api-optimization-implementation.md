# API 请求优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 SWR 优化前端数据获取，减少重复 API 请求，提升页面加载速度。

**Architecture:** 引入 SWR 库实现请求缓存和去重，统一在 `hooks/use-api.ts` 中管理所有 API hooks，重构 Sidebar/DailyPage/useSaved 使用 SWR hooks。

**Tech Stack:** Next.js 16, React 19, SWR 2.x, TypeScript

---

## Task 1: 安装 SWR 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装 SWR**

Run: `pnpm add swr`

Expected: `+ swr 2.x.x` 成功安装

**Step 2: 验证安装**

Run: `cat package.json | grep swr`

Expected: `"swr": "^2.x.x"` 出现在 dependencies

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add swr dependency for API caching"
```

---

## Task 2: 创建 SWR hooks 文件

**Files:**
- Create: `hooks/use-api.ts`

**Step 1: 创建 use-api.ts 文件**

```typescript
"use client"

import useSWR, { SWRConfiguration } from "swr"
import type { Article, NewsFlash, DailyOverview } from "@/lib/types"

// ============ Types ============

interface Pack {
  id: string
  name: string
  description?: string | null
}

interface CustomView {
  id: string
  name: string
  icon: string
  description?: string
  packs?: Array<{ packId: string; pack?: { id: string; name: string } }>
}

interface DailyData {
  overview: DailyOverview | null
  articles: Article[]
  newsFlashes: NewsFlash[]
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============ Fetcher ============

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json: ApiResponse<T> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }

  return json.data as T
}

// ============ Default SWR Config ============

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,    // 窗口聚焦不重新验证
  revalidateOnReconnect: true, // 网络重连时重新验证
  dedupingInterval: 5000,      // 5秒内相同请求去重
}

// ============ Hooks ============

interface PacksResponse {
  packs: Pack[]
}

export function usePacks() {
  return useSWR<Pack[]>("/api/packs", (url) => fetcher<PacksResponse>(url).then((d) => d.packs), defaultConfig)
}

interface CustomViewsResponse {
  views: CustomView[]
}

export function useCustomViews() {
  return useSWR<CustomView[]>("/api/custom-views", (url) => fetcher<CustomViewsResponse>(url).then((d) => d.views), defaultConfig)
}

interface BookmarksResponse {
  items: Article[]
  total: number
}

export function useBookmarks() {
  return useSWR<Article[]>("/api/bookmarks", (url) => fetcher<BookmarksResponse>(url).then((d) => d.items), defaultConfig)
}

export function useDaily() {
  return useSWR<DailyData>("/api/daily", fetcher<DailyData>, defaultConfig)
}
```

**Step 2: 验证 TypeScript 编译**

Run: `pnpm build`

Expected: 无 TypeScript 错误

**Step 3: Commit**

```bash
git add hooks/use-api.ts
git commit -m "feat: add SWR hooks for API caching and deduplication"
```

---

## Task 3: 重构 DailyPage 使用 SWR

**Files:**
- Modify: `components/daily-page.tsx`

**Step 1: 更新 imports**

找到文件顶部的 imports，修改为：

```typescript
"use client"

import { cn } from "@/lib/utils"
import { SaveButton } from "@/components/save-button"
import type { Article, NewsFlash, DailyOverview } from "@/lib/types"
import { useDaily } from "@/hooks/use-api"
```

**Step 2: 重构 DailyPage 组件**

找到 `DailyPage` 函数，替换整个组件体：

```typescript
export function DailyPage({ isSaved, onToggleSave, onOpenArticle }: DailyPageProps) {
  const { data, isLoading, error } = useDaily()

  // 从 SWR 数据中提取
  const overview = data?.overview ?? null
  const articles = data?.articles ?? []
  const newsFlashes = data?.newsFlashes ?? []

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-muted-foreground font-sans text-sm">加载中...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-destructive font-sans text-sm">{error.message}</div>
        </div>
      </div>
    )
  }

  // 保持原有的 JSX 渲染逻辑不变...
  return (
    // ... 现有的 JSX ...
  )
}
```

**Step 3: 删除不再需要的 state 和 useEffect**

删除以下代码：
- `const [loading, setLoading] = useState(true)`
- `const [error, setError] = useState<string | null>(null)`
- `const [overview, setOverview] = useState<DailyOverview | null>(null)`
- `const [articles, setArticles] = useState<Article[]>([])`
- `const [newsFlashes, setNewsFlashes] = useState<NewsFlash[]>([])`
- 整个 `useEffect` 块
- `import { useState, useEffect } from "react"` 中的 `useState, useEffect`

**Step 4: 验证编译**

Run: `pnpm build`

Expected: 无错误

**Step 5: Commit**

```bash
git add components/daily-page.tsx
git commit -m "refactor: use SWR hook in DailyPage, remove redundant news-flashes call"
```

---

## Task 4: 重构 Sidebar 使用 SWR

**Files:**
- Modify: `components/sidebar.tsx`

**Step 1: 更新 imports**

在文件顶部添加：

```typescript
import { usePacks, useCustomViews } from "@/hooks/use-api"
```

**Step 2: 替换 state 和 useEffect**

找到 Sidebar 组件中的以下代码并删除：
- `const [customViews, setCustomViews] = useState<CustomView[]>([])`
- `const [viewsLoading, setViewsLoading] = useState(true)`
- `const [packs, setPacks] = useState<Pack[]>([])`
- 整个 `useEffect(() => { async function loadData() ... }, [])`

**Step 3: 添加 SWR hooks**

在 Sidebar 组件开头添加：

```typescript
export function Sidebar({ activeNav, onNav, savedCount, collapsed, onToggleCollapse }: SidebarProps) {
  // SWR hooks
  const { data: customViews = [], isLoading: viewsLoading } = useCustomViews()
  const { data: packs = [] } = usePacks()

  // ... 其他 state 保持不变 ...
```

**Step 4: 更新 viewsLoading 使用**

`viewsLoading` 现在来自 SWR，确保代码中使用 `viewsLoading` 的地方仍然正常工作。

**Step 5: 验证编译**

Run: `pnpm build`

Expected: 无错误

**Step 6: Commit**

```bash
git add components/sidebar.tsx
git commit -m "refactor: use SWR hooks in Sidebar for packs and custom-views"
```

---

## Task 5: 重构 useSaved hook 使用 SWR

**Files:**
- Modify: `hooks/use-saved.ts`

**Step 1: 更新 imports**

```typescript
"use client"

import { useCallback } from "react"
import useSWR, { mutate } from "swr"
import { addBookmark, removeBookmark } from "@/lib/api-client"
```

**Step 2: 重构 useSaved 函数**

```typescript
export function useSaved() {
  const { data: savedIds = new Set<string>(), mutate: mutateSavedIds } = useSWR(
    "/api/bookmarks",
    async (url) => {
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && json.data?.items) {
        return new Set(json.data.items.map((item: { id: string }) => item.id))
      }
      return new Set<string>()
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const toggleSave = useCallback(
    async (id: string) => {
      const currentlySaved = savedIds.has(id)
      try {
        if (currentlySaved) {
          const result = await removeBookmark(id)
          if (result.success) {
            mutateSavedIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            }, false)
          }
        } else {
          const result = await addBookmark(id)
          if (result.success) {
            mutateSavedIds((prev) => {
              const next = new Set(prev)
              next.add(id)
              return next
            }, false)
          }
        }
      } catch (error) {
        console.error("Failed to toggle bookmark:", error)
      }
    },
    [savedIds, mutateSavedIds]
  )

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds])

  return { savedIds, toggleSave, isSaved }
}
```

**Step 3: 验证编译**

Run: `pnpm build`

Expected: 无错误

**Step 4: Commit**

```bash
git add hooks/use-saved.ts
git commit -m "refactor: use SWR in useSaved hook for bookmarks caching"
```

---

## Task 6: 优化 /api/daily API

**Files:**
- Modify: `app/api/daily/route.ts`

**Step 1: 并行化查询**

找到 `GET()` 函数中的查询代码，将串行查询改为并行：

```typescript
export async function GET() {
  try {
    const startTime = Date.now()

    // 并行查询 overview 和 newsFlashes
    const overview = await prisma.dailyOverview.findFirst({
      orderBy: { date: "desc" },
    })

    if (!overview) {
      const items = await prisma.item.findMany({
        orderBy: [{ score: "desc" }, { fetchedAt: "desc" }],
        take: 6,
      })

      return NextResponse.json({
        success: true,
        data: {
          overview: null,
          articles: items.map(toArticle),
          newsFlashes: [],
        },
      })
    }

    // 并行查询 items 和 newsFlashes
    const [items, newsFlashes] = await Promise.all([
      prisma.item.findMany({
        where: { id: { in: overview.itemIds } },
      }),
      prisma.newsFlash.findMany({
        where: { dailyDate: overview.date },
        orderBy: [{ createdAt: "desc" }, { time: "desc" }],
        take: 12,
      }),
    ])

    const itemMap = new Map(items.map((i) => [i.id, i]))
    const articles = overview.itemIds
      .map((id) => itemMap.get(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .map(toArticle)

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          date: overview.date,
          summary: overview.summary,
        },
        articles,
        newsFlashes: newsFlashes.map((f) => ({
          id: f.id,
          time: f.time,
          text: f.text,
        })),
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

**Step 2: 验证编译**

Run: `pnpm build`

Expected: 无错误

**Step 3: Commit**

```bash
git add app/api/daily/route.ts
git commit -m "perf: parallelize database queries in /api/daily"
```

---

## Task 7: 验证优化效果

**Files:**
- 无文件改动

**Step 1: 启动开发服务器**

Run: `pnpm dev`

**Step 2: 打开浏览器 Network 面板**

1. 打开 Chrome DevTools (F12)
2. 切换到 Network 面板
3. 勾选 "Preserve log"
4. 在 Filter 中输入 `/api/`

**Step 3: 刷新首页**

访问 `http://localhost:3000`，观察 Network 面板

**Expected:**
- 只有 3 个 API 请求：`/api/daily`, `/api/packs`, `/api/custom-views`
- `/api/bookmarks` 和 `/api/news-flashes` 不再单独请求
- 每个请求只出现 1 次（SWR 去重）

**Step 4: 记录结果**

对比优化前后的 API 请求数量和响应时间。

---

## Rollback Plan

如果出现问题，可以按顺序回滚：

```bash
# 回滚单个 commit
git revert HEAD

# 或者回滚到优化前
git checkout <优化前的-commit-hash>
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Install SWR | package.json |
| 2 | Create SWR hooks | hooks/use-api.ts |
| 3 | Refactor DailyPage | components/daily-page.tsx |
| 4 | Refactor Sidebar | components/sidebar.tsx |
| 5 | Refactor useSaved | hooks/use-saved.ts |
| 6 | Optimize /api/daily | app/api/daily/route.ts |
| 7 | Verify | - |
