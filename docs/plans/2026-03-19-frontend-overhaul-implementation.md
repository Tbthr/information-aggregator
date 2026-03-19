# 前端改造实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 v0 生成的 RSS Reader UI 整合到 information-aggregator 项目，实现 Next.js + Prisma + Supabase + Vercel 的完整架构。

**Architecture:** 采用 Next.js App Router 架构，前端使用 shadcn/ui 组件库，后端使用 Next.js API Routes + Prisma ORM，数据库使用 Supabase PostgreSQL。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Prisma, Supabase (PostgreSQL), TypeScript

---

## Phase 1: 项目基础设施设置

### Task 1.1: 初始化 Next.js 项目

**Files:**
- Modify: `package.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`

**Step 1: 安装 Next.js 依赖**

```bash
pnpm add next@16 react@19 react-dom@19
pnpm add -D @types/react @types/react-dom @tailwindcss/postcss tailwindcss@4 typescript
```

**Step 2: 创建 next.config.mjs**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
```

**Step 3: 创建 tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

**Step 4: 创建 postcss.config.mjs**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**Step 5: 更新 package.json scripts**

添加以下 scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.mjs tailwind.config.ts postcss.config.mjs
git commit -m "chore: initialize Next.js project"
```

---

### Task 1.2: 创建 App Router 目录结构

**Files:**
- Create: `app/app/layout.tsx`
- Create: `app/app/page.tsx`
- Create: `app/app/globals.css`

**Step 1: 创建 app/app/globals.css**

```css
@import "tailwindcss";

:root {
  --background: oklch(0.99 0.005 260);
  --foreground: oklch(0.2 0.02 260);
  --card: oklch(0.99 0.005 260);
  --card-foreground: oklch(0.2 0.02 260);
  --primary: oklch(0.55 0.25 260);
  --primary-foreground: oklch(0.99 0.005 260);
  --muted: oklch(0.96 0.01 260);
  --muted-foreground: oklch(0.5 0.02 260);
  --border: oklch(0.9 0.01 260);
  --sidebar: oklch(0.98 0.005 260);
  --sidebar-foreground: oklch(0.2 0.02 260);
  --sidebar-accent: oklch(0.95 0.01 260);
  --sidebar-border: oklch(0.9 0.01 260);
  --overview-bg: oklch(0.55 0.25 260);
  --overview-foreground: oklch(0.99 0.005 260);
  --spotlight-accent: oklch(0.75 0.2 80);
  --bullet-bg: oklch(0.96 0.01 260);
  --accent-foreground: oklch(0.35 0.02 260);
  --save-active: oklch(0.65 0.2 30);
}

* { border-color: var(--border); }
body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, sans-serif;
}
```

**Step 2: 创建 app/app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lens - 信息聚合器',
  description: 'AI 驱动的 RSS/JSON 信息聚合器',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

**Step 3: 创建 app/app/page.tsx**

```typescript
export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Lens 信息聚合器</h1>
    </div>
  )
}
```

**Step 4: 验证启动**

```bash
pnpm dev
```

**Step 5: Commit**

```bash
git add app/
git commit -m "feat: create Next.js App Router structure"
```

---

## Phase 2: Prisma + Supabase 设置

### Task 2.1: 初始化 Prisma

**Files:**
- Create: `prisma/schema.prisma`
- Create: `app/lib/prisma.ts`

**Step 1: 安装依赖**

```bash
pnpm add @prisma/client
pnpm add -D prisma
npx prisma init
```

**Step 2: 创建 app/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 3: Commit**

```bash
git add prisma/ app/lib/prisma.ts package.json
git commit -m "chore: initialize Prisma"
```

---

### Task 2.2: 创建 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 编写完整 Schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Item {
  id            String   @id @default(cuid())
  title         String
  url           String
  canonicalUrl  String
  snippet       String?  @db.Text
  sourceId      String
  sourceName    String
  sourceType    String
  packId        String?
  publishedAt   DateTime?
  fetchedAt     DateTime @default(now())
  author        String?
  summary       String?  @db.Text
  bullets       String[]
  content       String?  @db.Text
  imageUrl      String?
  category      String?
  score         Float    @default(5.0)
  scoresJson    String?  @db.Text
  metadataJson  String?  @db.Text

  source        Source        @relation(fields: [sourceId], references: [id])
  savedItems    SavedItem[]
  newsFlashes   NewsFlash[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([sourceId])
  @@index([fetchedAt])
  @@index([score])
}

model Source {
  id          String   @id
  type        String
  name        String
  url         String?
  description String?
  enabled     Boolean  @default(true)
  configJson  String?  @db.Text
  packId      String?

  items       Item[]
  health      SourceHealth?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SourceHealth {
  id                  String   @id @default(cuid())
  sourceId            String   @unique
  lastSuccessAt       DateTime?
  lastFailureAt       DateTime?
  lastError           String?  @db.Text
  consecutiveFailures Int      @default(0)

  source              Source   @relation(fields: [sourceId], references: [id])
  updatedAt           DateTime @updatedAt
}

model Pack {
  id          String   @id
  name        String
  description String?
  policyJson  String?  @db.Text

  sources     Source[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SavedItem {
  id      String   @id @default(cuid())
  itemId  String
  savedAt DateTime @default(now())

  item    Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId])
}

model NewsFlash {
  id        String   @id @default(cuid())
  time      String
  text      String   @db.Text
  itemId    String?

  item      Item?    @relation(fields: [itemId], references: [id])

  createdAt DateTime @default(now())
}

model DailyOverview {
  id        String   @id @default(cuid())
  date      String   @unique
  dayLabel  String
  summary   String   @db.Text

  createdAt DateTime @default(now())
}

model WeeklyReport {
  id            String   @id @default(cuid())
  weekNumber    String
  headline      String
  subheadline   String?  @db.Text
  editorial     String?  @db.Text

  timelineEvents TimelineEvent[]

  createdAt     DateTime @default(now())
}

model TimelineEvent {
  id              String   @id @default(cuid())
  weeklyReportId  String
  date            String
  dayLabel        String
  title           String
  summary         String   @db.Text
  order           Int      @default(0)

  weeklyReport    WeeklyReport @relation(fields: [weeklyReportId], references: [id], onDelete: Cascade)

  @@index([weeklyReportId])
}

model CustomView {
  id          String   @id
  name        String
  icon        String
  description String?

  items       CustomViewItem[]

  createdAt   DateTime @default(now())
}

model CustomViewItem {
  id      String   @id @default(cuid())
  viewId  String
  itemId  String
  order   Int      @default(0)

  view    CustomView @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@unique([viewId, itemId])
  @@index([viewId])
}
```

**Step 2: 验证 Schema**

```bash
npx prisma validate
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: create complete Prisma schema"
```

---

### Task 2.3: 配置 Supabase 并运行迁移

**Prerequisites:** 已创建 Supabase 项目并获取 DATABASE_URL

**Step 1: 配置 .env**

```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
```

**Step 2: 生成 Client 并迁移**

```bash
npx prisma generate
npx prisma db push
```

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: configure Supabase connection"
```

---

## Phase 3: 前端组件迁移

### Task 3.1: 复制 v0 前端代码

**Step 1: 复制组件**

```bash
cp -r /Users/lyq/Downloads/rss-reader/components app/
cp -r /Users/lyq/Downloads/rss-reader/hooks app/
cp -r /Users/lyq/Downloads/rss-reader/lib app/
cp /Users/lyq/Downloads/rss-reader/app/globals.css app/app/
```

**Step 2: 安装依赖**

```bash
pnpm add lucide-react next-themes class-variance-authority clsx tailwind-merge
```

**Step 3: Commit**

```bash
git add app/
git commit -m "feat: copy v0 frontend components"
```

---

### Task 3.2: 更新配置和导入路径

**Step 1: 更新 tsconfig.json 添加路径别名**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./app/*"]
    }
  }
}
```

**Step 2: 创建 app/lib/types.ts（从 mock-data.ts 提取类型）**

```typescript
export type Article = {
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
  aiScore?: number
  saved?: boolean
}

export type NewsFlash = { id: string; time: string; text: string }
export type TimelineEvent = { id: string; date: string; dayLabel: string; title: string; summary: string }
export type CustomView = { id: string; name: string; icon: string; description: string; articles: Article[] }
export type DailyOverview = { date: string; summary: string }
export type WeeklyReport = { weekNumber: string; headline: string; subheadline: string; editorial: string }
```

**Step 3: 更新 app/app/page.tsx**

使用 v0 主页代码，更新导入路径。

**Step 4: Commit**

```bash
git add app/
git commit -m "feat: update import paths and types"
```

---

## Phase 4: API Routes 迁移

### Task 4.1: 创建 Items API

**Files:**
- `app/app/api/items/route.ts` - GET 列表
- `app/app/api/items/[id]/route.ts` - GET 单个
- `app/app/api/items/[id]/save/route.ts` - POST/DELETE 保存
- `app/app/api/items/saved/route.ts` - GET 已保存

（完整代码见设计文档中的 API 设计部分）

**Step 1: 创建各 route 文件**

**Step 2: Commit**

```bash
git add app/app/api/
git commit -m "feat: create Items API routes"
```

---

### Task 4.2: 创建其他 API Routes

**Files:**
- `app/app/api/packs/route.ts`
- `app/app/api/sources/route.ts`
- `app/app/api/views/route.ts`
- `app/app/api/daily/route.ts`
- `app/app/api/weekly/route.ts`
- `app/app/api/news-flashes/route.ts`

**Step 1: 创建各 route 文件**

**Step 2: Commit**

```bash
git add app/app/api/
git commit -m "feat: create remaining API routes"
```

---

## Phase 5: 数据对接

### Task 5.1: 创建 API 客户端

**Files:**
- `app/lib/api-client.ts`

**Step 1: 创建 api-client.ts**

包含：
- fetchItems(params) - 查询内容列表
- fetchSavedItems() - 获取已保存
- saveItem(id) / unsaveItem(id) - 保存/取消
- fetchDailyOverview() - 每日概述
- fetchWeeklyReport() - 周报
- fetchNewsFlashes() - 快讯
- fetchCustomViews() - 自定义视图
- mapItemToArticle() - 数据映射

**Step 2: Commit**

```bash
git add app/lib/api-client.ts
git commit -m "feat: create API client"
```

---

### Task 5.2: 创建 Hooks

**Files:**
- `app/hooks/use-items.ts`
- 更新 `app/hooks/use-saved.ts`

**Step 1: 创建 useItems Hook**

包含状态管理：items, total, loading, error, refetch, toggleSave, isSaved

**Step 2: 更新 useSaved Hook 使用 API**

**Step 3: Commit**

```bash
git add app/hooks/
git commit -m "feat: create useItems hook"
```

---

### Task 5.3: 更新组件使用真实 API

**Files:**
- `app/components/daily-page.tsx`
- `app/components/weekly-page.tsx`
- `app/components/saved-page.tsx`
- `app/components/custom-view-page.tsx`

**Step 1: 更新各页面组件**

将 mock 数据替换为 API 调用，添加 loading 状态。

**Step 2: 验证前端运行**

```bash
pnpm dev
```

**Step 3: Commit**

```bash
git add app/components/
git commit -m "feat: integrate real API in components"
```

---

## Phase 6: Vercel 部署

### Task 6.1: 创建 Vercel 配置

**Files:**
- `vercel.json`
- `.env.example`

**Step 1: 创建 vercel.json**

```json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["hkg1"]
}
```

**Step 2: 创建 .env.example**

**Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore: add Vercel configuration"
```

---

### Task 6.2: 验证生产构建

**Step 1: 运行构建**

```bash
pnpm build
```

**Step 2: 运行生产服务器**

```bash
pnpm start
```

**Step 3: 最终 Commit**

```bash
git add .
git commit -m "feat: complete frontend overhaul"
```

---

## 执行清单

- [ ] Task 1.1: 初始化 Next.js 项目
- [ ] Task 1.2: 创建 App Router 目录结构
- [ ] Task 2.1: 初始化 Prisma
- [ ] Task 2.2: 创建 Prisma Schema
- [ ] Task 2.3: 配置 Supabase 并运行迁移
- [ ] Task 3.1: 复制 v0 前端代码
- [ ] Task 3.2: 更新配置和导入路径
- [ ] Task 4.1: 创建 Items API
- [ ] Task 4.2: 创建其他 API Routes
- [ ] Task 5.1: 创建 API 客户端
- [ ] Task 5.2: 创建 Hooks
- [ ] Task 5.3: 更新组件使用真实 API
- [ ] Task 6.1: 创建 Vercel 配置
- [ ] Task 6.2: 验证生产构建
