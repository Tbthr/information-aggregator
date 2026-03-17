---
spec: v1-editorial-redesign
phase: research
created: 2026-03-17
---

# Research: v1-editorial-redesign

## Executive Summary

现有系统具备完整的 pipeline（collect → normalize → dedupe → enrich → rank → cluster）和基础 Web UI。为升级为"编辑部式注意力管理系统"，需新增：**Source Policy 层**（区分 `assist_only` / `filter_then_assist` 模式）、**AI 判断解释字段**（keepDecision/keepReason/readerBenefit）、**全新视图系统**（日报首页、Pack 视图、来源视图、周报视图）。技术可行性高，React+Tailwind 栈可复用，主要工作是数据模型扩展和前端组件重构。

## External Research

### Best Practices: Editorial/Magazine Style UI

| 来源 | 关键发现 |
|------|---------|
| [Google News System Design](https://www.systemdesignhandbook.com/guides/google-news-system-design/) | Feed 分层：Headlines → Personalized → Topic-based |
| [News Website Design Examples](https://www.sliderrevolution.com/design/news-website-design/) | 响应式布局、视觉层次、卡片+列表混合模式 |
| [Publication Design Trends 2024](https://www.walsworth.com/blog/publication-design-trends-2024) | 3D typography、vintage minimalism、editorial grids |

### AI Content Curation UI Patterns

| 来源 | 关键发现 |
|------|---------|
| [Design Patterns for AI Curated Content](https://www.senuriwijenayake.com/papers/2025/khan-2025-design.pdf) | 9 种设计模式：AI generation、exploration、recommendation、aggregation |
| [Beyond Chat: AI UI Patterns](https://artium.ai/insights/beyond-chat-how-ai-is-transforming-ui-design-patterns) | 避免 chat-centric，采用嵌入式 AI 辅助（inline recommendations） |
| [Readwise Reader Ghostreader](https://readwise.io/reader/update-july2024) | AI 作为阅读助手，而非对话界面 |

### AI Reading Assistant Products

| 产品 | 核心设计 |
|------|---------|
| **Readwise Reader** | Ghostreader AI 助手：摘要、关键点提取、问答；保存/阅读/高亮/导出闭环 |
| **Matter** | 视觉优先的阅读体验；个性化推荐；"Save for Later" 功能 |
| **共同点** | AI 作为可选增强层，不强制使用；保留用户控制权 |

## Codebase Analysis

### 现有数据模型（`src/types/index.ts`）

```typescript
// 核心类型
interface SourcePack {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  auth?: string;
  sources: InlineSource[];
  promptTemplate?: string;  // ✅ 已有模板引用
  viewTemplate?: string;    // ✅ 已有视图模板
}

interface InlineSource {
  type: SourceType;  // x_home, x_list, x_bookmarks, rss, etc.
  url: string;
  description?: string;
  enabled?: boolean;
  configJson?: string;
}

interface RankedCandidate {
  // 评分字段
  sourceWeightScore: number;
  freshnessScore: number;
  engagementScore: number;
  topicMatchScore: number;
  contentQualityAi: number;
  finalScore?: number;
  // AI enrichment
  extractedContent?: ExtractedContent;
  aiEnrichment?: AiEnrichmentResult;  // keyPoints, tags, summary, multiScore
}
```

**缺失字段（需新增）**:
- Source Policy: `policyMode: 'assist_only' | 'filter_then_assist'`
- AI 判断: `keepDecision`, `keepReason`, `readerBenefit`, `readingHint`
- 来源统计: `retentionRate`, `filterReasons[]`

### API 结构（`src/api/`）

| 端点 | 当前功能 | 需扩展 |
|------|---------|--------|
| `GET /api/items` | 分页查询、排序、过滤 | + policy 模式过滤、keepReason 返回 |
| `GET /api/packs` | Pack 列表 | + 策略摘要、来源构成、代表内容 |
| `GET /api/packs/:id` | Pack 详情 | + 策略模式、保留率、过滤统计 |
| **新增** | - | `GET /api/daily-brief`, `GET /api/weekly-review` |

### 前端结构（`frontend/src/`）

```
frontend/src/
├── App.tsx           # 主入口，Sidebar + Main layout
├── components/
│   ├── Layout.tsx    # 全局布局
│   ├── Sidebar.tsx   # Pack/Source 选择
│   ├── FilterBar.tsx # 时间窗口、排序
│   ├── ItemList.tsx  # 内容列表
│   ├── ItemCard.tsx  # 内容卡片（含 score bars）
│   └── Pagination.tsx
├── hooks/
│   ├── useApi.ts     # API 请求
│   └── useFilters.ts # 过滤状态管理
└── types/api.ts      # API 类型定义
```

**当前 UI 特点**:
- 单一卡片视图，无分层
- Score bars 显示时效/热度/相关
- Tags/KeyPoints 可选显示
- 无"封面故事"、"Save for Later"概念

### Adapter 实现模式（`src/adapters/`）

```typescript
// 统一接口
type AdapterFn = (source: Source) => Promise<RawItem[]>;

// 已实现 adapters
- rss.ts          // XML → RawItem
- json-feed.ts    // JSON Feed → RawItem
- github-trending.ts
- x-bird.ts       // bird CLI → RawItem（支持 7 种 mode）
```

**X 场景差异化处理**: 当前通过 `configJson.birdMode` 区分，但无策略层概念。

### 配置系统（`config/`）

```
config/
├── packs/           # YAML Pack 配置
├── auth/            # 认证配置
├── prompts/         # AI prompt 模板
├── views/           # 视图模板
└── settings.yaml    # AI 配置
```

**扩展点**: Pack YAML 可新增 `policy` 字段。

### Views 系统（`src/views/`）

```typescript
// 视图构建
buildViewModel(result, viewId) → ViewModel
renderViewMarkdown(model, viewId) → string

// 已实现视图
- daily-brief:  AI 摘要 + Top 10 文章 + 标签云
- x-analysis:   帖子摘要 + 标签 + engagement

// ViewModel 结构
interface ViewModel {
  viewId: string;
  title: string;
  summary?: string;
  highlights?: string[];
  sections: ViewModelSection[];
  aiHighlights?: HighlightsResult;
  tagCloud?: string[];
}
```

**现状**: 视图层仅用于 CLI 输出，未与 Web UI 集成。

## Feasibility Assessment

| 方面 | 评估 | 说明 |
|------|------|------|
| **Source Policy 层** | ✅ 高 | Pack YAML 扩展 + pipeline 增加过滤阶段 |
| **AI 判断字段** | ✅ 高 | AiEnrichmentResult 扩展，复用现有 AI client |
| **日报首页** | ✅ 高 | 新增 API 端点 + 前端组件 |
| **Pack 视图** | ✅ 高 | 扩展现有 `/api/packs/:id` |
| **来源视图** | ✅ 高 | 新增统计聚合逻辑 |
| **周报视图** | 🟡 中 | 需跨日数据聚合 + AI 总结 |
| **前端重构** | 🟡 中 | 保持 React+Tailwind，新增视图组件 |

**技术风险**: 低。现有架构模块化良好，扩展点清晰。

## Recommendations for Requirements

1. **数据模型优先**: 先扩展 `InlineSource` 和 `SourcePack` 类型，新增 `policy` 字段
2. **Pipeline 增强阶段**: 在 `rank` 之前增加 `policy_filter` 阶段，根据 `filter_then_assist` 模式执行 AI 判断
3. **API 分层设计**: 新增 `/api/views/daily-brief`、`/api/views/weekly-review` 独立端点
4. **前端视图路由**: `/` → 日报首页，`/pack/:id` → Pack 视图，`/source/:id` → 来源视图
5. **渐进式实现**: Phase 1 日报首页 + Pack 视图 → Phase 2 来源视图 + 周报

## Open Questions

1. **周报时间范围**: 固定 7 天还是用户可配置？
2. **Save for Later 持久化**: 本地存储还是后端数据库？
3. **AI 判断批量处理**: 是在 collect 阶段还是 rank 阶段？
4. **来源保留率计算**: 滑动窗口还是全量统计？

## Related Specs

无其他相关 specs（当前 specs 目录仅包含本 spec）。

## Quality Commands

| Type | Command | Source |
|------|---------|--------|
| Lint | `bun run lint` | package.json scripts.lint |
| TypeCheck | `bun run check` | package.json scripts.check |
| Unit Test | `bun test` | package.json scripts.test |
| Smoke Test | `bun run smoke` | package.json scripts.smoke |
| E2E Test | `bun run e2e:real` | package.json scripts.e2e:real |
| Format | `bun run format` | package.json scripts.format |
| Format Check | `bun run format:check` | package.json scripts.format:check |
| Frontend Dev | `cd frontend && bun dev` | frontend/package.json scripts.dev |
| Frontend Build | `cd frontend && bun run build` | frontend/package.json scripts.build |

**Local CI**: `bun run lint && bun run check && bun test`

## Verification Tooling

| Tool | Command | Detected From |
|------|---------|---------------|
| Dev Server | `bun src/cli/main.ts serve` | CLI serve command |
| Frontend Dev | `bun --cwd frontend dev` | frontend/package.json |
| Port | `3000` (API), `5173` (Frontend) | CLI default / Vite default |
| Health Endpoint | `/api/health` | src/api/server.ts |
| Database | `data/archive.db` | SQLite |

**Project Type**: Web App (CLI + API + Frontend)
**Verification Strategy**:
1. Start API server: `bun src/cli/main.ts serve`
2. Check health: `curl http://localhost:3000/api/health`
3. Start frontend: `cd frontend && bun dev`
4. Verify UI loads at http://localhost:5173

## Sources

### External
- [Google News System Design](https://www.systemdesignhandbook.com/guides/google-news-system-design/)
- [Design Patterns for AI Curated Content](https://www.senuriwijenayake.com/papers/2025/khan-2025-design.pdf)
- [Readwise Reader Ghostreader](https://readwise.io/reader/update-july2024)
- [Matter vs Readwise Reader Comparison](https://thesweetsetup.com/is-matter-or-readwise-reader-the-read-later-app-for-you/)
- [News Website Design Examples](https://www.sliderrevolution.com/design/news-website-design/)

### Internal
- `/Users/lyq/ai-enhance/information-aggregator/src/types/index.ts` - 核心类型定义
- `/Users/lyq/ai-enhance/information-aggregator/src/api/types.ts` - API 响应类型
- `/Users/lyq/ai-enhance/information-aggregator/src/views/registry.ts` - 视图系统
- `/Users/lyq/ai-enhance/information-aggregator/src/pipeline/enrich.ts` - AI 增强逻辑
- `/Users/lyq/ai-enhance/information-aggregator/src/adapters/x-bird.ts` - X adapter 实现
- `/Users/lyq/ai-enhance/information-aggregator/frontend/src/App.tsx` - 前端入口
- `/Users/lyq/ai-enhance/information-aggregator/config/packs/` - Pack 配置示例
