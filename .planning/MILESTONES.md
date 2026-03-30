# Milestones

## v1.0 MVP (Shipped: 2026-03-30)

**Phases completed:** 4 phases, 8 plans, 13 tasks

**Key accomplishments:**

- Frontend ReportSettingsPage aligned with backend: packs renamed to topicIds, "数据源 Topic" label
- Unified /settings page with Daily/Weekly/Sources tabs, deprecated URL redirects, and tab-aware sidebar navigation
- X/Bird adapter now implements 24h window filtering with per-item discard logging and per-source discard summary; RSS and JSON Feed adapters emit top-level author/content fields
- Plan:
- Retry utility wrapper and tx-aware batch functions for the collection pipeline.
- Wire transaction wrapping, retry logic, and structured error logging into runCollectJob.

---
