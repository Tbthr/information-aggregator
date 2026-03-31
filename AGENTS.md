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
│   ├── pipeline/     # Collection: adapters -> normalize -> filter -> dedupe -> persist
│   ├── reports/      # Daily/weekly report generation & runtime candidate scoring
│   ├── archive/      # AI enrichment & DB persistence
│   ├── ai/           # AI client & prompt engineering
│   └── types/        # Shared TypeScript types (RawItem, ReportCandidate, etc.)
├── prisma/           # Database schema (Prisma)
└── config/packs/     # Pack seed data (YAML, loaded into DB at setup)
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

## Environment

Required in `.env`:
- `DATABASE_URL` / `DIRECT_URL` — PostgreSQL 连接（Supabase）
- `AI_DEFAULT_PROVIDER` — AI provider（anthropic / gemini / openai）
- `SUPABASE_*` — Supabase 项目配置
- `ANTHROPIC_API_KEY` / `GOOGLEAI_API_KEY` / `OPENAI_API_KEY` — AI API keys

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
| 开发迭代 | `npx prisma db push` |
| 生产就绪 | `npx prisma migrate dev --name <migration_name>` |

**注意：** 修改 schema 后立即执行相应命令，避免 database drift。

## Testing & Verification

### Build Verification

```bash
pnpm build
```

Expected: Build succeeds with no errors.

### Reports Pipeline E2E Verification

**适用场景：** 修改了 `src/reports/`、`app/api/cron/`、`app/api/daily/`、`app/api/weekly/`、`app/api/settings/reports/`、`src/pipeline/`、`src/archive/` 或 `prisma/schema.prisma` 中报表相关模型后，必须执行全流程验收。

#### 前置条件

1. `pnpm dev` 运行中（dev server 在 `http://localhost:3000`）
2. `.env` 中 `DATABASE_URL` / `DIRECT_URL` 已配置
3. 外部 RSS 源和 X/Twitter 可访问（收集阶段需要）

#### 验收级别

| 级别 | 触发条件 | 命令 | 预期耗时 |
|------|----------|------|----------|
| L1 快速 | 仅改前端/类型/UI | `pnpm check && pnpm build` | ~30s |
| L2 配置 | 改了配置 API/Schema | `npx tsx scripts/diagnostics.ts reports --config-only` | ~10s |
| L3 日报 | 改了日报生成逻辑 | `npx tsx scripts/diagnostics.ts reports --daily-only` | ~5min |
| L4 周报 | 改了周报生成逻辑 | `npx tsx scripts/diagnostics.ts reports --weekly-only` | ~5min |
| L5 全量 | 改了收集管道/AI 逻辑 | `npx tsx scripts/diagnostics.ts full --run-collection --cleanup` | ~15min |

#### 验收脚本参数

| 参数 | 说明 |
|------|------|
| `collection` | 运行收集诊断（guards, health, inventory） |
| `reports` | 运行报表诊断（config, daily, weekly, integrity） |
| `full` | 运行全量诊断（collection + reports） |
| `--run-collection` | 触发实际收集运行（collection 模式） |
| `--config-only` | 仅验证配置 API，跳过报表生成 |
| `--daily-only` | 仅运行日报断言 |
| `--weekly-only` | 仅运行周报断言 |
| `--cleanup` | 运行后清理测试数据（危险） |
| `--allow-write` | 在只读模式允许写操作 |
| `--confirm-production` | 确认生产环境风险 |
| `--confirm-cleanup` | 确认数据清理风险 |
| `--api-url <url>` | API 地址，默认 http://localhost:3000 |
| `--json-output <path>` | JSON 结果输出路径 |
| `--verbose` | 详细输出 |
| `--help` | 显示帮助信息 |

#### L5 全量验收步骤（逐项通过标准）

**Step 3: 全流程 E2E**
```bash
npx tsx scripts/diagnostics.ts full --run-collection --cleanup --confirm-cleanup --verbose
```
- 通过：脚本 exit 0，Summary 中 FAIL 数 = 0
- 详细测试项见 `npx tsx scripts/diagnostics.ts --verbose --help`

**Step 4: 人工抽检（可选）**

打开 `http://localhost:3000/daily` 和 `http://localhost:3000/weekly` 页面：
- 日报页面：主题分类合理、摘要可读、精选有理由
- 周报页面：社论连贯、精选覆盖多天内容

#### 变更影响矩阵

| 变更范围 | 最低验收级别 |
|----------|-------------|
| `app/api/settings/reports/` | L2 |
| `src/reports/daily.ts` | L3 |
| `src/reports/weekly.ts` | L4 |
| `src/pipeline/collect.ts` | L5 |
| `src/archive/enrich*.ts` | L5 |
| `prisma/schema.prisma` (报表模型) | L5 |

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

