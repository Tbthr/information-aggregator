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

### Development Guidelines

1. **Type Safety**: All code must pass TypeScript checks
2. **Component Pattern**: Use shadcn/ui components when available
3. **API Client**: Use `@/lib/api-client` for all API calls

## Testing & Verification

### Build Verification

```bash
pnpm build
```

Expected: Build succeeds with no errors.

## API Reference

See `docs/api-data-formats.md` for complete API documentation.
