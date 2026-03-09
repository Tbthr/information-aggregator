# Digest 24-Hour Filter Design

**Goal:** Make `digest` represent the last 24 hours of content instead of every item fetched during a run.

## Decision

Use content publication time when available, and fall back to fetch time when publication time is missing. Apply the filter only in `runDigest` so `scan` behavior stays unchanged.

## Scope

- Keep the existing `RawItem.publishedAt` field as the primary timestamp.
- Improve adapter parsing where needed so RSS and JSON Feed continue to populate `publishedAt`.
- Treat website fallback items as fetch-time only because they do not represent article-level publication dates.
- Filter collected raw items to the last 24 hours before normalization and ranking.

## Tradeoffs

- This keeps the change small and avoids altering persistence or ranking contracts.
- Items without publication timestamps may still appear based on fetch time, which is a deliberate fallback for MVP sources.
- Website sources remain less precise than feed-based sources, but they no longer force the whole digest to include unlimited historical feed entries.

## Testing

- Add adapter tests for RSS `pubDate` and Atom `published`.
- Add a JSON Feed test for `date_published`.
- Add `runDigest` tests proving that:
  - items older than 24 hours are excluded
  - items within 24 hours remain
  - missing `publishedAt` falls back to `fetchedAt`
