# External Integrations

**Analysis Date:** 2026-03-30

## Database

**PostgreSQL (Supabase):**
- Provider: Supabase (PostgreSQL hosted)
- Connection via Prisma ORM
- Connection URL: `DATABASE_URL` env var (with pgbouncer)
- Direct URL: `DIRECT_URL` env var (bypasses pgbouncer)
- Prisma client: `lib/prisma.ts`
- Schema: `prisma/schema.prisma`

**Prisma Models:**
- `Content` - Aggregated content items (articles, tweets)
- `Topic` - Topic/category definitions
- `Source` - RSS/feed source configurations
- `SourceHealth` - Source health tracking
- `DailyOverview` - Daily digest overviews
- `DigestTopic` - Topics within daily digest
- `DailyReportConfig` - Daily report configuration
- `WeeklyReport` - Weekly digest reports
- `WeeklyPick` - Selected items for weekly digest
- `WeeklyReportConfig` - Weekly report configuration
- `XPageConfig` - X/Twitter page configuration

## AI Providers

**Multi-Provider Architecture:**
- Default provider: Configured via `AI_DEFAULT_PROVIDER`
- Supported: `anthropic`, `gemini`, `openai`
- Implementation: `src/ai/providers/`

**Anthropic (Claude):**
- API Keys: `ANTHROPIC_API_KEYS` env var (comma-separated for multiple)
- Model: `ANTHROPIC_MODEL` env var (default: `claude-sonnet-4-20250514`)
- Base URL: `ANTHROPIC_BASE_URLS` env var
- Implementation: `src/ai/providers/anthropic.ts`

**Google Gemini:**
- API Keys: `GEMINI_API_KEYS` env var (comma-separated)
- Model: `GEMINI_MODEL` env var (default: `gemini-2.5-flash`)
- Base URL: `GEMINI_BASE_URLS` env var
- Implementation: `src/ai/providers/gemini.ts`

**OpenAI-Compatible:**
- API Keys: `OPENAI_API_KEYS` env var (comma-separated)
- Model: `OPENAI_MODEL` env var (default: `gpt-4o`)
- Base URL: `OPENAI_BASE_URLS` env var
- Implementation: `src/ai/providers/openai.ts`

**AI Retry Configuration:**
- `AI_MAX_RETRIES` - Max retry attempts (default: 3)
- `AI_INITIAL_DELAY_MS` - Initial retry delay (default: 1000ms)
- `AI_MAX_DELAY_MS` - Max retry delay (default: 30000ms)
- `AI_BACKOFF_FACTOR` - Exponential backoff factor (default: 2)

**AI Batch Configuration:**
- `AI_BATCH_SIZE` - Items per batch (default: 5)
- `AI_CONCURRENCY` - Max concurrent requests (default: 2)

## Content Sources

**RSS Feeds:**
- Parser: Custom implementation in `src/adapters/rss.ts`
- Supports RFC 2822 and ISO 8601 date formats
- Handles CDATA sections and XML entity decoding
- Feed discovery: `src/adapters/feed-discovery.ts`

**JSON Feeds:**
- Parser: `src/adapters/json-feed.ts`
- Alternative to RSS

**Website Content:**
- Extraction: `src/adapters/website.ts`
- Uses Mozilla Readability (`@mozilla/readability`)
- Parsing: `linkedom` for server-side DOM parsing

**GitHub Trending:**
- Source: GitHub trending pages
- Adapter: `src/adapters/github-trending.ts`

## X/Twitter Integration

**Authentication:**
- Auth Token: `X_AUTH_TOKEN` env var
- CT0 Token: `X_CT0` env var
- Direct token authentication for Vercel deployment

**Collection Types:**
- Feed collection: `app/api/cron/collect-x-feed/route.ts`
- Social collection: `app/api/cron/collect-x-social/route.ts`
- X page config stored in `XPageConfig` model

**X Configuration Options:**
- Tab selection
- Bird mode (timeline type)
- Count limit
- Fetch all vs recent
- Filter prompt (AI-based filtering)
- Enrichment settings (scoring, key points, tagging)
- Time window
- Sort order

## Cron Jobs & Scheduling

**Platform:** Vercel Cron

**Schedule Configuration:** `vercel.json`

**Cron Endpoints:**
| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/collect` | `0 */30 * * * *` | Main content collection (every 30 min) |
| `/api/cron/collect-x-feed` | `0 0 */6 * * *` | X feed collection (every 6 hours) |
| `/api/cron/collect-x-social` | `0 0 */12 * * *` | X social collection (every 12 hours) |
| `/api/cron/daily` | `0 0 23 * * *` | Daily report generation (23:00 UTC) |
| `/api/cron/weekly` | `5 0 23 * * 0` | Weekly report generation (Sunday 23:05 UTC) |

**Note:** Cron times are in UTC. For Beijing time (UTC+8), subtract 8 hours.

## Environment Configuration

**Required Environment Variables:**

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection (with pgbouncer) | Yes |
| `DIRECT_URL` | PostgreSQL direct connection | Yes |
| `AI_DEFAULT_PROVIDER` | Default AI provider | Yes |
| `ANTHROPIC_API_KEYS` | Anthropic API keys | If using Anthropic |
| `ANTHROPIC_MODEL` | Anthropic model name | No |
| `GEMINI_API_KEYS` | Gemini API keys | If using Gemini |
| `GEMINI_MODEL` | Gemini model name | No |
| `OPENAI_API_KEYS` | OpenAI API keys | If using OpenAI |
| `OPENAI_MODEL` | OpenAI model name | No |
| `X_AUTH_TOKEN` | X/Twitter auth token | If collecting X |
| `X_CT0` | X/Twitter CT0 token | If collecting X |

**Optional Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MAX_RETRIES` | 3 | Max retry attempts |
| `AI_INITIAL_DELAY_MS` | 1000 | Initial retry delay (ms) |
| `AI_MAX_DELAY_MS` | 30000 | Max retry delay (ms) |
| `AI_BACKOFF_FACTOR` | 2 | Exponential backoff factor |
| `AI_BATCH_SIZE` | 5 | AI batch size |
| `AI_CONCURRENCY` | 2 | AI concurrency |
| `LOG_LEVEL` | - | Logging level (debug/info/warn/error) |
| `LOG_FORMAT` | text | Log format (text/json) |

**Template File:** `.env.example` (committed to repo with placeholder values)

## File Storage

**Local filesystem:**
- No external file storage service
- Images served via Next.js image optimization
- Remote image patterns configured in `next.config.mjs`

## Logging & Observability

**Custom Logger:**
- Implementation: `src/utils/logger.ts`
- Supports multiple log levels
- Text and JSON formats
- Sensitive data masking

**Environment-based:**
- `LOG_LEVEL` env var controls verbosity
- `LOG_FORMAT` env var controls output format

## CI/CD & Deployment

**Hosting Platform:**
- Vercel (primary deployment target)
- Configured in `vercel.json`

**Build Configuration:**
- Build command: `prisma generate && next build`
- Install command: `pnpm install`
- Framework: Next.js
- Region: `hkg1` (Hong Kong)

**Development:**
- Dev server: `pnpm dev` (runs on localhost:3000)
- Type check: `pnpm check`
- Build: `pnpm build`
- Lint: `pnpm lint`

---

*Integration audit: 2026-03-30*
