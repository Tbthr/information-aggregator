# Phase 3: Topic Configuration + AI Optimization - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Daily and weekly reports use properly seeded topic configuration with optimized AI calls. This phase covers: (1) keywordBlacklist → Topic.excludeRules migration, (2) Supabase topic seeding with default topics, (3) verifying daily/weekly AI call patterns match the expected batching model.

</domain>

<decisions>
## Implementation Decisions

### keywordBlacklist → Topic.excludeRules migration
- **D-01:** `keywordBlacklist` 字段从 `DailyReportConfig` schema 移除
- **D-02:** `daily.ts` filterContent 步骤改为读取 `Topic.excludeRules`（按 content.topicIds 匹配）
- **D-03:** API schema 和前端配置项移除 `keywordBlacklist`
- **D-04:** 一次性 Prisma migration：读取 DailyReportConfig.keywordBlacklist → 找到对应 Topic → 填充 Topic.excludeRules → 删除 keywordBlacklist 列

### Topic seeding（预设 Topic）
- **D-05:** 在 Supabase 种子数据中创建以下预设 Topic：
  - AI Agent / LLM（大语言模型）/ 地缘冲突 等
  - 具体 topic 名称和 excludeRules 由 researcher/planner 根据项目上下文确定
- **D-06:** `DailyReportConfig.topicIds` 初始化时填充所有预设 Topic 的 ID（显式列表，非空=全部）

### Daily AI batching（确认）
- **D-07:** Clustering（聚类）= 1 次 AI 调用（already done）
- **D-08:** 每个 topic 调用 1 次 AI 生成 summary（N 次调用，PARALLEL_CONCURRENCY=3 并发）
- **D-09:** 逻辑流程确认：clustering 得到 N topics → 每个 content 有 topic 归属 → N 次 AI calls 生成 summary
- **D-10:** 当前实现逻辑正确，无需修改

### Weekly AI batching（确认）
- **D-11:** 近7天 content 汇总生成 editorial（already done，1 次调用）
- **D-12:** 选出 top N content（按 publishedAt 排序取前 N，N = config.pickCount）
- **D-13:** 每个 content 调用 1 次 AI（串行，并发=1），返回"总结概括"+"为什么值得读"
- **D-14:** 当前 for 循环串行逻辑正确，无需修改

### Model version pinning
- **D-15:** AI model version 通过环境变量配置（如 `AI_DEFAULT_MODEL=claude-3-5-sonnet-20241022`）
- **D-16:** 不硬编码 version，确保不同环境可配置不同版本

### Claude's Discretion
- 预设 Topic 的具体名称和数量由 researcher/planner 确定
- 预设 Topic 的 excludeRules 初始值可为空，由 researcher/planner 建议

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 scope
- `.planning/ROADMAP.md` §Phase 3 — Success Criteria (5 items: topicIds seed, filtering, daily batching, weekly batching, model pinning)
- `.planning/REQUIREMENTS.md` — PIPELINE-02 (topic config), PIPELINE-03 (daily AI opt), PIPELINE-04 (weekly AI opt)

### Prior phase context
- `.planning/phases/01-settings-consolidation/01-CONTEXT.md` — D-17: keywordBlacklist → excludeRules defer to Phase 3
- `.planning/phases/02-pipeline-field-quality-audit/02-CONTEXT.md` — Pipeline patterns, discard logging

### Existing code (read before implementing)
- `src/reports/daily.ts` §filterContent — keywordBlacklist filtering (to be replaced with Topic.excludeRules)
- `src/reports/daily.ts` §topicClustering — clustering 1 call (already done, verify in plan)
- `src/reports/daily.ts` §generateTopicSummaries — PARALLEL_CONCURRENCY=3 (to verify logic)
- `src/reports/weekly.ts` §generateWeeklyPicks — for loop serial calls (D-13 confirms correct)
- `src/ai/config/schema.ts` — AiConfig.model is the pinned version string
- `prisma/schema.prisma` — DailyReportConfig.keywordBlacklist (to be removed), Topic.excludeRules (to be used)

### Config and seed
- `config/packs/*.yaml` — Reference for existing seed data format
- `src/config/load-pack-prisma.ts` — How packs/topics are loaded from DB

</canonical_refs>

<codebase_context>
## Existing Code Insights

### Reusable Assets
- `prisma.topic.excludeRules` — already exists on Topic model, ready to use
- `daily.ts filterContent()` — needs refactor to use excludeRules instead of keywordBlacklist
- `weekly.ts generateWeeklyPicks()` — for loop is already serial (concurrent=1), confirmed correct

### Established Patterns
- Topic filtering: `content.topicIds` array matches `config.topicIds` entries
- Migration pattern: Phase 2 did similar one-time field migrations

### Integration Points
- `DailyReportConfig.keywordBlacklist` removal → API schema update → frontend config update
- `Topic.excludeRules` usage in daily.ts filterContent

</codebase_context>

<specifics>
## Specific Ideas

- "预设 Topic：AI Agent、LLM、地缘冲突 等"
- "周报每个 content 调用一次 AI，串行（并发=1），返回总结+为什么值得读"
- "环境变量配置 AI model version"
- "keywordBlacklist 一次性 migration 到 Topic.excludeRules"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 03-topic-configuration-ai-optimization*
*Context gathered: 2026-03-31*
