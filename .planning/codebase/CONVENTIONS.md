# Coding Conventions

**Analysis Date:** 2026-03-30

## TypeScript Strict Mode

**Status:** Enabled (strict: true in `tsconfig.json`)

**Key Settings:**
- `strict: true` - Enables all strict type-checking options
- `noEmit: true` - TypeScript only checks, does not emit
- `skipLibCheck: true` - Skips type checking of declaration files
- `moduleResolution: Bundler` - Uses bundler-style module resolution
- `paths` - Path aliases configured for `@/*`, `@/components/*`, `@/hooks/*`, `@/lib/*`

**Type Safety Rules:**
- All code must pass TypeScript check (`pnpm check`)
- `any` type is forbidden unless absolutely necessary
- Shared types live in `lib/types.ts` or `src/types/`
- Module-level types use `type` exports only

## Naming Conventions

**Files:**
- PascalCase for components: `TweetCard.tsx`, `Sidebar.tsx`
- kebab-case for utilities and non-component modules: `date-utils.ts`, `social-post.ts`
- co-located tests: `*.test.ts` suffix, e.g., `rank.test.ts`

**Functions/Variables:**
- camelCase for functions and variables: `useDaily()`, `fetchContent()`
- PascalCase for types, interfaces, and classes: `ApiResponse<T>`, `ContentKind`

**Types:**
- Suffix non-null assertions with `!` (non-null assertion operator)
- Use `Record<string, unknown>` for arbitrary object maps, not `object`
- Prisma models accessed via `prisma.modelName.findMany()`

## Code Formatting

**Tool:** Prettier

**Config (`.prettierrc`):**
```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Run formatting:**
```bash
pnpm format        # Format and write
pnpm format:check  # Check without writing
```

## Component Patterns (shadcn/ui)

**Base Pattern:**
Components use Radix UI primitives wrapped with class-variance-authority (CVA) for variants.

**Example from `components/ui/button.tsx`:**
```typescript
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm...",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border bg-background shadow-xs hover:bg-accent...',
        // ...more variants
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3...',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
```

**Usage:**
```typescript
import { Button } from "@/components/ui/button"
// Variants via props
<Button variant="destructive" size="sm">Delete</Button>
```

**Styling:**
- Use Tailwind CSS with `cn()` (clsx + tailwind-merge) for conditional classes
- CVA for component-level variant switching
- shadcn/ui components in `components/ui/`

**Shared Utilities:**
- `cn()` from `lib/utils` for merging Tailwind classes
- `components/ui/skeleton.tsx` for loading placeholders
- `components/loading-skeletons.tsx` for page-level skeletons

## API Route Patterns

**Required Imports:**
```typescript
import { NextRequest } from "next/server"
import { success, error, parseBody, validateBody, handlePrismaError, startTimer, timing } from "@/lib/api-response"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
```

**Standard Route Structure:**
```typescript
export const runtime = "nodejs"
export const dynamic = "force-dynamic"  // Opt out of static caching

export async function GET(request: NextRequest) {
  const startTime = startTimer()
  // ... logic
  return success(data, { timing: timing(startTime) })
}

export async function PUT(request: NextRequest) {
  let body: unknown
  try {
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validation = updateSchema.safeParse(body)
  if (!validation.success) {
    return error("参数校验失败", 400, validation.error.flatten())
  }
  // ... logic
  return success(result)
}
```

**Zod Validation Schema Pattern:**
```typescript
const updateSchema = z.object({
  daily: z.object({
    maxItems: z.number().int().min(1).max(200).optional(),
    filterPrompt: z.string().nullable().optional(),
  }).optional(),
  weekly: z.object({
    days: z.number().int().min(7).max(28).refine((v) => v % 7 === 0, { message: "必须为 7 的倍数" }).optional(),
  }).optional(),
})
```

**Prisma Error Handling:**
```typescript
const prismaError = handlePrismaError(err, { p2002: "记录已存在", p2025: "记录不存在" })
if (prismaError) return prismaError
```

**Shared Response Types** (`lib/api-response.ts`):
- `success(data, meta?)` - Returns `{ success: true, data, meta? }`
- `error(message, status, details?)` - Returns `{ success: false, error, details? }`
- `parseBody(request)` - Throws `ParseError` on invalid JSON
- `validateBody(body, schema)` - Returns `ValidationResult<T>`
- `handlePrismaError(err, context)` - Maps Prisma error codes to responses

**Shared Mappers** (`app/api/_lib/mappers.ts`):
- `toArticle()` - Converts Prisma content to Article type

## Error Handling

**API Routes:**
- Use `ParseError` for malformed requests (caught and returned as 400)
- Use `handlePrismaError()` for database errors (P2002, P2003, P2025 mapped to appropriate status codes)
- All other errors should throw and let Next.js handle 500

**Frontend:**
- **NEVER use `alert()`** for user notifications
- Use toast notifications via `useToast()` hook:
```typescript
import { toast } from "@/hooks/use-toast"
toast({ title: "操作失败", variant: "destructive" })
```
- Toast variants: default, destructive

## Time and Timezone Handling

**Core Principle:** Database stores UTC. Backend uses UTC methods. Frontend converts to local for display.

**Backend Rules (`lib/date-utils.ts`):**
- **FORBIDDEN:** `setHours()`, `getHours()`, `getDay()`, `setDate()` (local time methods)
- **REQUIRED:** `setUTCHours()`, `getUTCHours()`, `getUTCDay()`, `setUTCDate()` (UTC methods)
- Use `beijingDayRange()` and `beijingWeekRange()` for report date range queries
- Date format for API: ISO 8601 strings with `Z` suffix via `.toISOString()`

**Key Utilities (`lib/date-utils.ts`):**
```typescript
utcStartOfDay(date)           // Midnight UTC
utcEndOfDay(date)             // 23:59:59.999 UTC
utcDaysAgo(days)              // N days ago at midnight UTC
beijingDayRange(dateStr)     // { start, end } for Beijing date
beijingWeekRange(date)        // { start, end } for Beijing week (Mon-Sun)
utcWeekNumber(monday)         // Returns "2026-W13" format
formatUtcDate(date)           // YYYY-MM-DD string
```

**Frontend Display (`lib/format-date.ts`):**
- **FORBIDDEN:** Display raw ISO strings directly
- **REQUIRED:** Use formatting functions based on `Intl.DateTimeFormat`:
```typescript
formatDateTime(isoString)   // "3月22日 14:30"
formatDate(isoString)       // "3月22日"
formatTime(isoString)       // "14:30"
formatRelative(isoString)   // "今天 14:30" / "昨天 06:30" / "3月20日"
```

## Data Fetching Patterns

**Unified SWR Hooks (`hooks/use-api.ts`):**
- All data fetching MUST use SWR, not `useState` + `useEffect`
- Standard config: `revalidateOnFocus: false, dedupingInterval: 5000`
- Use `revalidateOnReconnect: true` when you need to refetch on network recovery

**Correct Pattern:**
```typescript
const { data, isLoading, error, mutate } = useSWR(key, fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 5000
})
```

**Forbidden Pattern (DO NOT USE):**
```typescript
// WRONG - manual state management
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
const isMountedRef = useRef(true)
useEffect(() => { ... }, [])
```

**Shared Hooks to Reuse:**
- `useTopics()` - GET /api/topics
- `useContent(params)` - GET /api/content with query params
- `useDaily(date?)` - GET /api/daily
- `useWeekly(week?)` - GET /api/weekly
- `useReportSettings()` - GET /api/settings/reports

**Loading States:**
- **NEVER** use plain text "加载中..."
- Use Skeleton components from `components/loading-skeletons.tsx`:
```typescript
import { ArticleListSkeleton, TweetListSkeleton, PageSkeleton } from "@/components/loading-skeletons"
// ArticleListSkeleton, TweetListSkeleton, PageSkeleton available
```

## Type Definitions

**Location Rules:**
- Cross-file shared types: `lib/types.ts` (frontend/backend common) or `src/types/` (backend only)
- Module-local types: inline in the file
- Prisma model types: accessed via `prisma.$ModelName`

**ApiResponse Pattern:**
```typescript
export interface ApiResponse<T = unknown> {
  success: boolean        // Must be boolean, NOT narrowed to true
  data?: T
  error?: string
  details?: unknown
  meta?: {
    timing?: { generatedAt: string; latencyMs: number }
    pagination?: { total: number; page: number; pageSize: number; totalPages: number }
    query?: Record<string, unknown>
  }
}
```

**DO NOT narrow `success: true` in type definitions.** The `success` field must remain `boolean` so error responses can properly type-check.

## Import Organization

**Order:**
1. Node.js built-ins (none usually needed in Next.js)
2. External packages (`next`, `react`, `zod`, etc.)
3. Internal aliases (`@/lib/*`, `@/components/*`, `@/hooks/*`)
4. Relative imports (`./`, `../`)

**Path Aliases (from `tsconfig.json`):**
```json
{
  "@/components/*": ["./components/*"],
  "@/hooks/*": ["./hooks/*"],
  "@/lib/*": ["./lib/*"],
  "@/*": ["./*"]
}
```

## Module Design

**Exports:**
- Use named exports for utilities and hooks
- Avoid barrel files (index.ts re-exports) unless necessary
- Types exported with `export type { TypeName }` syntax

**Component Files:**
- Keep under 300 lines
- Split by responsibility when exceeding limit
- Extract types to `types.ts` in same directory
- Extract constants/mappings to separate files

---

*Convention analysis: 2026-03-30*
