# Pipeline 端到端验证脚本

## 目标

创建独立 TS 脚本，手动触发数据收集 pipeline，仅测试 2 个 source（infoq RSS + x bookmarks），验证从收集到落库全流程。

## 方案

独立 TS 脚本 `scripts/verify-pipeline.ts`，用 `LOG_LEVEL=DEBUG npx tsx scripts/verify-pipeline.ts` 运行。

## 数据清理

按外键依赖顺序清理，保留配置表：

| 清理 | 保留 |
|------|------|
| TimelineEvent, WeeklyReport, Bookmark, NewsFlash, DailyOverview, Item, SourceHealth | Settings, ProviderConfig, AuthConfig, Pack, Source, CustomView, CustomViewPack, SchedulerJob, DailyReportConfig, WeeklyReportConfig |

## 执行流程

```
清理数据 → 加载 packs/sources → 筛选目标 2 个 → 构建 adapters
  → collect → normalize → dedupeExact → dedupeNear → archive → enrich → 验证 DB
```

## Source 筛选

按 URL 匹配：
- `https://www.infoq.cn/feed` → rss
- `https://x.com/i/bookmarks` → x-bookmarks

## 日志格式

每个阶段输出：阶段标题 + 耗时 + 统计摘要 + 条目表格（# | source | title | url）

## 前置依赖

- `bird` CLI 已安装，X 认证已配置（AuthConfig 表）
- `DATABASE_URL` 环境变量
- AI provider 配置（Settings + ProviderConfig）
