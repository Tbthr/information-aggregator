# Technology Stack

**Analysis Date:** 2026-03-30

## Languages

**Primary:**
- TypeScript 5.8.2 - All application code (frontend and backend)
- Python 0.6.0 - Mozilla Readability for HTML parsing

**Secondary:**
- CSS - Tailwind CSS 4.2.2 for styling

## Runtime

**Environment:**
- Node.js (via Next.js 16.2.0)
- Bun - Test runner (`bun test`)

**Package Manager:**
- pnpm (project uses pnpm scripts)
- Lockfile: `pnpm-lock.yaml`

## Frameworks

**Core:**
- Next.js 16.2.0 (App Router) - Full-stack framework
- React 19.2.4 - UI library
- React DOM 19.2.4

**UI Components:**
- Tailwind CSS 4.2.2 - Utility-first CSS
- shadcn/ui - Component library built on Radix UI
- Radix UI (multiple packages) - Headless UI primitives
- class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional classnames
- tailwind-merge 3.5.0 - Tailwind class merging

**Backend:**
- Prisma 6.19.2 - ORM for PostgreSQL
- @prisma/client 6.19.2 - Prisma runtime

**Data Fetching:**
- SWR 2.4.1 - Data fetching and caching (frontend)
- Zod 4.3.6 - Runtime type validation

**Forms:**
- react-hook-form 7.54.1 - Form state management
- Zod 4.3.6 - Schema validation (used with react-hook-form)

**Drag & Drop:**
- @dnd-kit/core 6.3.1 - Drag and drop primitives
- @dnd-kit/sortable 10.0.0 - Sortable list primitives
- @dnd-kit/utilities 3.2.2 - DnD utilities

**Markdown:**
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub Flavored Markdown

**Icons:**
- lucide-react 0.577.0 - Icon library

**Animations:**
- tw-animate-css 1.4.0 - Tailwind animation utilities
- embla-carousel-react 8.6.0 - Carousel component
- react-resizable-panels 2.1.7 - Resizable panel layout
- yet-another-react-lightbox 3.29.1 - Lightbox component
- sonner 1.7.1 - Toast notifications (used via hook)

**Charts:**
- recharts 2.15.0 - Chart library

**Date Picker:**
- react-day-picker 9.13.2 - Date picker component

## AI Integration

**Multi-Provider AI Client:**
- Custom AI client implementation at `src/ai/`
- Supports multiple providers with fallback

**AI Providers:**
- Anthropic (Claude) - `src/ai/providers/anthropic.ts`
- Google Gemini - `src/ai/providers/gemini.ts`
- OpenAI-compatible - `src/ai/providers/openai.ts`
- Fallback provider - `src/ai/providers/fallback.ts`

**AI Configuration:**
- Provider selection via `AI_DEFAULT_PROVIDER` env var
- Multiple API keys support (comma-separated)
- Multiple endpoints with automatic fallback
- Config schema at `src/ai/config/schema.ts`
- Config loader at `src/ai/config/load.ts`

**AI Capabilities:**
- Article enrichment (`enrichArticle`)
- Multi-dimensional scoring (`scoreMultiDimensional`)
- Key points extraction (`extractKeyPoints`)
- Tag generation (`generateTags`)
- Content summarization (`summarizeContent`)
- Batch filtering (`batchFilter`)
- Topic suggestions (`suggestTopics`)
- Highlights generation (`generateHighlights`)
- Daily brief overview (`generateDailyBriefOverview`)
- Post summarization (`summarizePost`)

**AI Prompt Engineering:**
- `src/ai/prompts-enrichment.ts` - Enrichment prompts
- `src/ai/prompts-filter.ts` - Content filtering prompts
- `src/ai/prompts-reports.ts` - Report generation prompts
- `src/ai/prompts-highlights.ts` - Highlights prompts
- `src/ai/prompts-daily-brief.ts` - Daily brief prompts
- `src/ai/prompts-x-analysis.ts` - X/Twitter analysis prompts

## Data Pipeline

**Content Adapters:**
- RSS feed parsing - `src/adapters/rss.ts`
- JSON feed parsing - `src/adapters/json-feed.ts`
- Website extraction - `src/adapters/website.ts`
- GitHub trending - `src/adapters/github-trending.ts`
- Feed discovery - `src/adapters/feed-discovery.ts`

**Pipeline Stages:**
- Collection - `src/pipeline/collect.ts`
- URL normalization - `src/pipeline/normalize-url.ts`
- Text normalization - `src/pipeline/normalize-text.ts`
- Content extraction - `src/pipeline/extract-content.ts`
- Exact deduplication - `src/pipeline/dedupe-exact.ts`
- Near deduplication - `src/pipeline/dedupe-near.ts`
- Filtering by pack - `src/pipeline/filter-by-pack.ts`
- Filtering by topic - `src/pipeline/filter-by-topic.ts`
- Ranking/scoring - `src/pipeline/rank.ts`
- AI enrichment - `src/pipeline/enrich.ts`

## Configuration

**Build Configuration:**
- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.mjs` - PostCSS configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration
- `vercel.json` - Vercel deployment config (includes cron schedules)

**Environment:**
- `.env.example` - Environment variable template
- `.env` - Local environment (gitignored)

## Testing

**Test Runner:**
- Bun (`bun test`) - Primary test runner
- Vitest-compatible API (via Bun)

**Test Files:**
- Co-located with source: `*.test.ts`
- Examples:
  - `src/ai/client.test.ts`
  - `src/pipeline/collect.test.ts`
  - `src/adapters/rss.test.ts`

## Development Tools

**Type Checking:**
- TypeScript 5.8.2 (`tsc --noEmit`)
- `pnpm check` - TypeScript check script

**Linting:**
- ESLint 9.22.0
- `pnpm lint` - ESLint check

**Formatting:**
- Prettier 3.5.0
- `pnpm format` - Format code
- `pnpm format:check` - Check formatting

**Code Execution:**
- tsx 4.21.0 - TypeScript execution
- `pnpm diagnostics` - Custom diagnostic script

## Platform Requirements

**Development:**
- Node.js 18+ (implied by Next.js 18+)
- pnpm package manager
- PostgreSQL database (local or Supabase)

**Production:**
- Vercel (configured in `vercel.json`)
- PostgreSQL database (Supabase recommended)
- AI API providers (Anthropic/Gemini/OpenAI)

---

*Stack analysis: 2026-03-30*
