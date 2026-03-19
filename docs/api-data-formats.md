# API Data Formats Reference

This document describes the data formats and response structures for all API endpoints in the Information Aggregator application.

## Common Response Structure

All API endpoints follow a consistent response structure:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    query?: QueryMeta
    timing: TimingMeta
    pagination?: PaginationMeta
  }
  warnings?: string[]
}
```

### Meta Types

```typescript
// Query parameters metadata
interface QueryMeta {
  packIds: string[]
  window: "today" | "week" | "month"
  sourceIds?: string[]
  sourceTypes?: string[]
  page: number
  pageSize: number
  sort: "ranked" | "recent"
  search?: string
}

// Timing metadata
interface TimingMeta {
  generatedAt: string      // ISO 8601 timestamp
  latencyMs: number        // Request processing time in milliseconds
}

// Pagination metadata
interface PaginationMeta {
  total: number            // Total number of items
  page: number             // Current page (1-indexed)
  pageSize: number         // Items per page
  totalPages: number       // Total number of pages
}
```

### Error Response

When an error occurs:

```typescript
interface ErrorResponse {
  success: false
  error: string
}
```

---

## Items API

### GET /api/items

Fetches a paginated list of content items with filtering and sorting options.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `packs` | string | - | Comma-separated pack IDs to filter by |
| `sources` | string | - | Comma-separated source IDs to filter by |
| `sourceTypes` | string | - | Comma-separated source types to filter by |
| `window` | `"today"` \| `"week"` \| `"month"` | `"week"` | Time window for filtering |
| `page` | number | `1` | Page number (1-indexed) |
| `pageSize` | number | `20` | Items per page (max 100) |
| `sort` | `"ranked"` \| `"recent"` | `"ranked"` | Sort order |
| `search` | string | - | Search query for title, snippet, summary, content, or source name |

#### Response

```typescript
interface ItemsResponse {
  success: true
  data: {
    items: ItemData[]
    sources: SourceInfo[]
  }
  meta: {
    query: QueryMeta
    timing: TimingMeta
    pagination: PaginationMeta
  }
  warnings?: string[]
}
```

#### ItemData Type

```typescript
interface ItemData {
  id: string
  title: string
  url: string
  canonicalUrl: string
  source: {
    id: string
    type: string
    packId: string
  }
  sourceName: string
  publishedAt: string | null
  fetchedAt: string
  firstSeenAt: string
  lastSeenAt: string
  snippet: string | null
  author: string | null
  score: number
  scores: {
    sourceWeight: number
    freshness: number
    engagement: number
    contentQuality: number
  }
  isBookmarked: boolean
  saved?: {
    savedAt: string
  }
  metadata: Record<string, unknown>
  // Enrichment fields
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
}
```

#### SourceInfo Type

```typescript
interface SourceInfo {
  id: string
  type: string
  packId: string
  itemCount: number
  health: {
    lastSuccessAt: string | null
    lastFailureAt: string | null
    consecutiveFailures: number
  }
}
```

---

## Daily API

### GET /api/daily

Fetches the daily digest with overview, spotlight articles, recommendations, and news flashes.

#### Response

```typescript
interface DailyResponse {
  success: true
  data: {
    overview: {
      date: Date
      summary: string
    } | null
    spotlightArticles: Article[]
    recommendedArticles: Article[]
    newsFlashes: NewsFlash[]
  }
  meta: {
    timing: TimingMeta
  }
}
```

#### Article Type

```typescript
interface Article {
  id: string
  title: string
  source: string           // Source name
  sourceUrl: string        // Original article URL
  publishedAt: string
  summary: string
  bullets: string[]
  content: string
  imageUrl?: string
  category?: string
  aiScore: number
}
```

#### NewsFlash Type

```typescript
interface NewsFlash {
  id: string
  time: string
  text: string
}
```

---

## Weekly API

### GET /api/weekly

Fetches the weekly report with hero section, timeline events, and deep dive articles.

#### Response

```typescript
interface WeeklyResponse {
  success: true
  data: {
    hero: {
      weekNumber: number
      headline: string
      subheadline: string
      editorial: string
    } | null
    timelineEvents: TimelineEvent[]
    deepDives: Article[]
  }
  meta: {
    timing: TimingMeta
  }
}
```

#### TimelineEvent Type

```typescript
interface TimelineEvent {
  id: string
  date: Date
  dayLabel: string
  title: string
  summary: string
  itemIds: string[]
}
```

---

## Bookmarks API

### GET /api/bookmarks

Fetches all bookmarked items.

#### Response

```typescript
interface BookmarksResponse {
  success: true
  data: {
    items: ItemData[]
    meta: {
      total: number
    }
  }
}
```

### POST /api/bookmarks/:id

Adds an item to bookmarks.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Item ID to bookmark |

#### Response

```typescript
// Success
{
  success: true
  data: {
    bookmarkedAt: string
    already?: true  // Present if already bookmarked
  }
}

// Error - Item not found
{
  success: false
  error: "Item not found"
}
```

### DELETE /api/bookmarks/:id

Removes an item from bookmarks.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Item ID to remove from bookmarks |

#### Response

```typescript
// Success
{
  success: true
  data: {
    bookmarkedAt: null
  }
}

// Error - Not bookmarked
{
  success: false
  error: "Item not bookmarked"
}
```

---

## Item Detail API

### GET /api/items/:id

Fetches a single item by ID.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Item ID |

#### Response

Returns `ItemData` or 404 if not found.

---

## Field Reference

### Score Components

The `score` field is a composite score (0-1) calculated from:

| Component | Description |
|-----------|-------------|
| `sourceWeight` | Weight assigned to the source |
| `freshness` | How recent the content is |
| `engagement` | Engagement metrics (if available) |
| `contentQuality` | AI-assessed content quality |

### Timestamps

All timestamps are in ISO 8601 format (e.g., `"2024-01-15T10:30:00.000Z"`).

| Field | Description |
|-------|-------------|
| `publishedAt` | Original publication date from source |
| `fetchedAt` | When the item was fetched by the system |
| `firstSeenAt` | When the item was first seen (same as fetchedAt) |
| `lastSeenAt` | When the item was last seen (same as fetchedAt) |
| `savedAt` | When the item was bookmarked |

### Window Filters

The `window` parameter filters items by fetch time:

| Value | Time Range |
|-------|------------|
| `today` | Since midnight of the current day |
| `week` | Last 7 days |
| `month` | Last 30 days |

---

## HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid query parameters |
| 404 | Not Found - Resource does not exist |
| 500 | Internal Server Error |
