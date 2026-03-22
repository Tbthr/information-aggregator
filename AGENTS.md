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
| `pnpm typecheck` | TypeScript 类型检查 (或 `tsc --noEmit`) |

### Pre-commit Checklist

**每次提交前必须执行：**

1. `pnpm typecheck` - 确保无 TypeScript 错误
2. `pnpm build` - 确保构建成功
3. 修复所有错误后再 push

## Code Standards

1. **Type Safety**: 所有代码必须通过 TypeScript 检查，禁止使用 `any` 除非必要
2. **Component Pattern**: 优先使用 shadcn/ui 组件
3. **API Client**: 使用 `@/lib/api-client` 进行所有 API 调用
4. **TypeScript Strict**: 所有代码必须正确类型化，变更后运行 `pnpm typecheck`

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

## Database

### Schema 变更约定

| 场景 | 命令 |
|------|------|
| 开发迭代 | `prisma db push` |
| 生产就绪 | `prisma migrate dev --name <migration_name>` |

**注意：** 修改 schema 后立即执行相应命令，避免 database drift。

## Testing & Verification

### Build Verification

```bash
pnpm build
```

Expected: Build succeeds with no errors.
