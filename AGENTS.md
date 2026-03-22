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
├── hooks/            # Custom React hooks
├── lib/              # Utilities (api-client, prisma, types)
├── src/              # Backend pipeline code
├── prisma/           # Database schema
└── config/           # YAML configuration files
```

## Development Workflow

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build + TypeScript check |
| `pnpm lint` | ESLint check |
| `pnpm check` | TypeScript 类型检查 (`tsc --noEmit`) |

### Pre-commit Checklist

**每次提交前必须执行：**

1. `pnpm check` - 确保无 TypeScript 错误
2. `pnpm build` - 确保构建成功
3. 修复所有错误后再 push

## Code Standards

1. **Type Safety**: 所有代码必须通过 TypeScript 检查，禁止使用 `any` 除非必要
2. **Component Pattern**: 优先使用 shadcn/ui 组件
3. **API Client**: 使用 `@/lib/api-client` 进行所有 API 调用
4. **TypeScript Strict**: 所有代码必须正确类型化，变更后运行 `pnpm check`

### Time & Timezone

**核心原则：数据库存 UTC，后端用 UTC 方法，前端转本地时间展示。**

1. **Database**: Prisma schema 中所有 DateTime 字段必须标注 `@db.Timestamptz`
2. **Backend**: 禁止使用 `setHours()`/`getHours()`/`getDay()`/`setDate()` 等 local time 方法，统一使用 `setUTCHours()`/`getUTCHours()`/`getUTCDay()`/`setUTCDate()` 等 UTC 方法。工具函数见 `lib/date-utils.ts`
3. **API**: 所有时间字段以 ISO 8601 字符串（带 `Z` 后缀）传递给前端，使用 `.toISOString()`
4. **Frontend**: 禁止直接展示原始 ISO 时间字符串，必须使用 `lib/format-date.ts` 中的格式化函数（基于 `Intl.DateTimeFormat`，零依赖）
5. **日报/周报**: "某一天"按北京时间（UTC+8）界定，使用 `beijingDayRange()` / `beijingWeekRange()` 计算查询范围
6. **Cron**: Vercel Cron 使用 UTC 时间，配置时需转换为北京时间（UTC+8）

## Frontend Development

### 组件修改前验证

修改 UI 组件前，**先确认目标文件**：

1. 使用 `grep` 查找组件使用位置
2. 检查组件层级关系
3. 确认修改的是正确文件后再编辑

```
# 示例：查找组件使用位置
grep -r "ComponentName" components/ app/
```

### 样式和交互验证

**前端样式和交互验证必须使用 `playwriter` skill 进行验证，启动subAgent执行**

```
/playwriter
```

验证场景：
- UI 组件样式变更后验证视觉效果
- 交互动画/行为验证
- 页面渲染结果确认

**每次使用完 playwriter skill 后，必须清理当前会话创建的 session：**

```bash
playwriter session delete <id>   # 删除 session 并释放资源（session list 查看当前 session）
```

## Database

### Schema 变更约定

| 场景 | 命令 |
|------|------|
| 开发迭代 | `pnpm exec prisma db push` |
| 生产就绪 | `pnpm exec prisma migrate dev --name <migration_name>` |

**注意：** 修改 schema 后立即执行相应命令，避免 database drift。使用 `pnpm exec` 而非 `npx`，避免 rtk hook 拦截问题。

## Testing & Verification

### Build Verification

```bash
pnpm build
```

Expected: Build succeeds with no errors.

## API Route Standards

### 共享工具库

API 路由**必须**使用 `lib/api-response.ts` 中的共享工具，禁止重复编写以下模式：

```typescript
import { parseBody, validateBody, success, error, startTimer, timing, handlePrismaError } from "@/lib/api-response"
```

| 模式 | 使用方式 |
|------|----------|
| JSON body 解析 | `parseBody(request)` — 失败抛 `ParseError` |
| Zod 校验 | `validateBody(body, schema)` — 返回 `ValidationResult<T>` |
| 成功响应 | `success(data)` 或 `success(data, { timing: timing(startTime) })` |
| 错误响应 | `error("message")` 或 `error("message", status)` |
| Prisma 错误 | `handlePrismaError(err, { p2002: "...", p2003: "...", p2025: "..." })` |

### 共享 Mapper 和工具

- `app/api/_lib/mappers.ts` — 跨路由共享的数据转换函数（如 `toArticle()`）
- `app/api/_lib/json-utils.ts` — 跨路由共享的 JSON 工具函数（如 `safeJsonParse()`）

新增共享工具时，放入 `_lib/` 目录并同步更新本节。

## Data Fetching Standards

### 统一使用 SWR

所有数据获取 hook **必须**使用 SWR（`import useSWR from "swr"`），禁止手动 `useState` + `useEffect` + `isMountedRef` 模式。

```typescript
// 正确
const { data, isLoading, error, mutate } = useSWR(key, fetcher, { revalidateOnFocus: false, dedupingInterval: 5000 })

// 错误 — 禁止
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
const isMountedRef = useRef(true)
useEffect(() => { ... }, [])
```

SWR 配置统一：`revalidateOnFocus: false, dedupingInterval: 5000`。需要 revalidate 时使用 `revalidateOnReconnect: true`。

### 共享 SWR Hooks

优先复用 `hooks/use-api.ts` 中已有的 hook（`usePacks`, `useCustomViews`, `useBookmarks`, `useDaily`），不要重复实现。

## UI Standards

### 用户通知

**禁止使用 `alert()`。** 所有用户通知必须使用 toast：

```typescript
import { toast } from "@/hooks/use-toast"
toast({ title: "操作失败", variant: "destructive" })
```

### 加载状态

**禁止使用纯文本 "加载中..."。** 使用 `components/loading-skeletons.tsx` 中的共享 Skeleton 组件：

- `ArticleListSkeleton` — 文章列表加载占位
- `TweetListSkeleton` — 推文列表加载占位
- `PageSkeleton` — 页面级加载占位

### 类型定义规范

- **共享类型**: 跨文件使用的类型定义在 `lib/types.ts`（前端/后端通用）或 `components/<module>/types.ts`（模块内共享）
- **内联类型**: 仅在单文件内使用的类型可以内联定义
- **禁止重复**: 同一类型禁止在多个文件中重复定义，发现重复时提取到共享位置
- **禁止 `success: true` 窄化**: `ApiResponse<T>` 的 `success` 字段必须是 `boolean`，不能窄化为 `true`（否则错误响应无法通过类型校验）

## Component Architecture

### 组件文件大小限制

单文件超过 **300 行** 时应考虑拆分。拆分原则：

- 按职责拆分（导航、CRUD、拖拽排序等）
- 类型定义放入 `types.ts`
- 常量/映射放入独立文件
- 子组件通过 props 传递数据，不直接访问兄弟组件状态

### 拆分后的目录结构

```
components/
├── sidebar/              # sidebar 模块
│   ├── types.ts
│   ├── icon-map.tsx
│   ├── nav-button.tsx
│   ├── sortable-view-item.tsx
│   └── view-edit-drawer.tsx
├── config/              # config 模块
│   ├── types.ts
│   ├── source-type-categories.ts
│   ├── pack-list-panel.tsx
│   ├── pack-detail-panel.tsx
│   └── add-source-dialog.tsx
└── sidebar.tsx           # 主组件（仅保留导航布局和状态协调）
```
