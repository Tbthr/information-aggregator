# Diagnostics Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single `scripts/diagnostics.ts` entrypoint backed by a reusable diagnostics framework that covers collection diagnostics, reports verification, environment safety, and exhaustive post-refactor validation on the test database.

**Architecture:** Extract the current collect cron orchestration into a shared pipeline service, then build `src/diagnostics` around a unified result/assertion model and mode-specific runners. Keep the CLI thin, move verification logic out of the legacy script into reusable modules, and finish with a full command-matrix validation pass that treats diagnostics as both framework verification and a business-regression sweep.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma ORM, Supabase PostgreSQL, tsx scripts, existing cron/API routes, existing report generation modules

**Spec 文档:** `docs/superpowers/specs/2026-03-26-diagnostics-framework-design.md`

---

## 文件结构总览

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/pipeline/run-collect-job.ts` | 共享 collect orchestrator，供 cron route 与 diagnostics 共用 |
| `src/diagnostics/core/types.ts` | `DiagnosticsRunResult`、`DiagnosticsStageResult`、`DiagnosticsAssertion` 等统一类型 |
| `src/diagnostics/core/result.ts` | stage/assertion 聚合、最终状态计算、结果构建器 |
| `src/diagnostics/core/guards.ts` | 环境推断、DB host 脱敏、风险级别判定、参数合法性校验 |
| `src/diagnostics/core/format.ts` | 终端输出与 JSON 输出适配 |
| `src/diagnostics/collection/types.ts` | collection section 类型与中间态类型 |
| `src/diagnostics/collection/health.ts` | 源健康汇总 |
| `src/diagnostics/collection/inventory.ts` | persisted inventory / persisted summary |
| `src/diagnostics/collection/run-collection.ts` | 触发共享 collect orchestrator 并映射为 diagnostics 结果 |
| `src/diagnostics/collection/summarize-candidates.ts` | run candidate summary 组装 |
| `src/diagnostics/reports/types.ts` | reports section 类型与 option 类型 |
| `src/diagnostics/reports/config.ts` | 报表配置读取与配置断言 |
| `src/diagnostics/reports/inventory.ts` | reports inventory 与 resolved targets |
| `src/diagnostics/reports/verify-daily.ts` | 日报阶段与断言 |
| `src/diagnostics/reports/verify-weekly.ts` | 周报阶段与断言 |
| `src/diagnostics/reports/verify-integrity.ts` | FK / empty/latest / topicCount / weekly source 等断言 |
| `src/diagnostics/runners/collection.ts` | collection runner |
| `src/diagnostics/runners/reports.ts` | reports runner |
| `src/diagnostics/runners/full.ts` | full runner |
| `scripts/diagnostics.ts` | 统一 CLI 入口 |
| `app/api/diagnostics/preflight/route.ts` | API preflight，返回环境与 DB host 摘要 |
| `src/diagnostics/core/guards.test.ts` | 环境门禁与参数归一化测试 |
| `src/diagnostics/core/result.test.ts` | stage/assertion 聚合测试 |
| `src/diagnostics/collection/*.test.ts` | collection diagnostics 单元/集成测试 |
| `src/diagnostics/reports/*.test.ts` | reports diagnostics 单元/集成测试 |

### 修改的文件

| 文件 | 职责 | 变更内容 |
|------|------|----------|
| `app/api/cron/collect/route.ts` | 现有 collect cron | 改为调用共享 `runCollectJob()` |
| `scripts/verify-reports-pipeline.ts` | 旧 reports 验收脚本 | 删除 |
| `AGENTS.md` | 仓库操作规范 | 全部更新为新 diagnostics 命令 |
| `README.md` | 项目文档 | 新增 diagnostics 用法并移除旧脚本引用 |
| `package.json` | 可选脚本别名 | 如有必要，增加 `pnpm diagnostics` 脚本 |
| `lib/date-utils.ts` | 共享日期工具 | 仅在必要时补测试，不改语义 |

### 可能需要读取但尽量不修改的文件

- `src/reports/daily.ts`
- `src/reports/weekly.ts`
- `app/api/daily/route.ts`
- `app/api/weekly/route.ts`
- `app/api/settings/reports/route.ts`
- `src/archive/upsert-prisma.ts`
- `src/archive/enrich-prisma.ts`

---

## Task 1: 锁定命令模型、结果模型和门禁规则

**Files:**
- Create: `src/diagnostics/core/types.ts`
- Create: `src/diagnostics/core/result.ts`
- Create: `src/diagnostics/core/guards.ts`
- Test: `src/diagnostics/core/result.test.ts`
- Test: `src/diagnostics/core/guards.test.ts`

- [ ] **Step 1: 写 `result` 聚合测试**

在 `src/diagnostics/core/result.test.ts` 添加最小失败测试，覆盖：
- 有任意 `FAIL` 时顶层 `status` 为 `FAIL`
- 无 `FAIL` 但有 `WARN` 时顶层 `status` 为 `WARN`
- `summary` 会正确统计 `pass/warn/fail/skip`

- [ ] **Step 2: 运行结果聚合测试并确认失败**

Run: `pnpm test src/diagnostics/core/result.test.ts`
Expected: FAIL，提示缺少模块或导出

- [ ] **Step 3: 写 `guards` 测试**

在 `src/diagnostics/core/guards.test.ts` 添加失败测试，覆盖：
- `DIAGNOSTICS_ENV=test` + 推断 production host -> 拒绝
- `collection --cleanup` -> 拒绝
- `reports --config-only --cleanup` -> 拒绝
- `reports --config-only` 风险级别是 `read-only`
- `reports --daily-only` 风险级别是 `write`
- `reports --weekly-only` 风险级别是 `write`
- `full` 默认风险级别是 `write`
- `full --run-collection` 风险级别是 `write`

- [ ] **Step 4: 运行 guards 测试并确认失败**

Run: `pnpm test src/diagnostics/core/guards.test.ts`
Expected: FAIL，提示缺少模块或断言不满足

- [ ] **Step 5: 实现 `src/diagnostics/core/types.ts`**

添加最小类型骨架：

```ts
export type DiagnosticsMode = "collection" | "reports" | "full"
export type DiagnosticsStatus = "PASS" | "WARN" | "FAIL" | "SKIP"
export type DiagnosticsRiskLevel = "read-only" | "write" | "high-risk-write"
export type DiagnosticsEnv = "test" | "production"
```

并补齐 spec 中定义的 `DiagnosticsRunResult`、`DiagnosticsStageResult`、`DiagnosticsAssertion`。

- [ ] **Step 6: 实现 `src/diagnostics/core/result.ts`**

至少导出：

```ts
export function summarizeStageStatuses(...)
export function deriveRunStatus(...)
export function createRunResult(...)
```

- [ ] **Step 7: 实现 `src/diagnostics/core/guards.ts`**

至少导出：

```ts
export function inferEnvFromDatabaseUrl(url: string): "test" | "production" | "unknown"
export function redactDatabaseHost(url: string): string
export function normalizeAndValidateArgs(...)
export function deriveRiskLevel(...)
```

- [ ] **Step 8: 运行 core 测试**

Run: `pnpm test src/diagnostics/core/result.test.ts src/diagnostics/core/guards.test.ts`
Expected: PASS

- [ ] **Step 9: 运行类型检查**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/diagnostics/core
git commit -m "feat: add diagnostics core models and guards"
```

---

## Task 2: 抽取共享 collect orchestrator，消除 cron 与 diagnostics 的实现分叉

**Files:**
- Create: `src/pipeline/run-collect-job.ts`
- Modify: `app/api/cron/collect/route.ts`
- Test: `src/pipeline/run-collect-job.test.ts`

- [ ] **Step 1: 写共享 orchestrator 行为测试**

在 `src/pipeline/run-collect-job.test.ts` 添加失败测试，覆盖：
- 会返回 source events
- 会返回 `raw/normalized/afterExactDedup/afterNearDedup`
- 会返回 `archivedNew/archivedUpdated`
- 失败源会进入 failure 结果

- [ ] **Step 2: 运行 orchestrator 测试并确认失败**

Run: `pnpm test src/pipeline/run-collect-job.test.ts`
Expected: FAIL，提示缺少模块

- [ ] **Step 3: 新建 `src/pipeline/run-collect-job.ts`**

把当前 [`app/api/cron/collect/route.ts`](/Users/lyq/ai-enhance/information-aggregator/app/api/cron/collect/route.ts) 中的核心流程抽成可复用函数：

```ts
export async function runCollectJob(options: {
  logger?: ...
  onSourceEvent?: ...
}): Promise<{
  sourceEvents: ...
  counts: ...
  archived: ...
}>
```

实现内容必须包含：
- pack/source 同步
- source 解析
- `collectSources`
- `normalizeItems`
- `dedupeExact`
- `dedupeNear`
- `archiveRawItems`
- `enrichItems`
- `recordSourceFailure`
- `recordSourcesSuccessBatch`

- [ ] **Step 4: 改造 cron route 调用共享 orchestrator**

把 `app/api/cron/collect/route.ts` 中的内联编排替换为：

```ts
await runCollectJob({
  logger,
  onSourceEvent: ...
})
```

route 只保留：
- cron 鉴权
- `runAfterJob`
- HTTP 响应包装

- [ ] **Step 5: 运行 orchestrator 测试**

Run: `pnpm test src/pipeline/run-collect-job.test.ts`
Expected: PASS

- [ ] **Step 6: 运行相关 collect 测试**

Run: `pnpm test src/pipeline/collect.test.ts`
Expected: PASS

- [ ] **Step 7: 运行类型检查**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/pipeline/run-collect-job.ts app/api/cron/collect/route.ts src/pipeline/run-collect-job.test.ts
git commit -m "refactor: extract shared collect orchestrator"
```

---

## Task 3: 建立 collection diagnostics 模块

**Files:**
- Create: `src/diagnostics/collection/types.ts`
- Create: `src/diagnostics/collection/health.ts`
- Create: `src/diagnostics/collection/inventory.ts`
- Create: `src/diagnostics/collection/run-collection.ts`
- Create: `src/diagnostics/collection/summarize-candidates.ts`
- Test: `src/diagnostics/collection/health.test.ts`
- Test: `src/diagnostics/collection/inventory.test.ts`
- Test: `src/diagnostics/collection/run-collection.test.ts`

- [ ] **Step 1: 写 `health` 测试**

覆盖：
- consecutiveFailures = 0 -> `healthy`
- consecutiveFailures > 0 且最近成功较久 -> `warning`
- 最近失败且连续失败高 -> `failing`

- [ ] **Step 2: 运行 `health` 测试并确认失败**

Run: `pnpm test src/diagnostics/collection/health.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/diagnostics/collection/health.ts`**

至少导出：

```ts
export async function loadSourceHealthSummary(...)
export function classifySourceHealth(...)
```

- [ ] **Step 4: 写 `inventory` 测试**

覆盖：
- persisted inventory 会统计 `items/tweets/sourceCount/unhealthySourceCount`
- persisted summary 会按时间和 score 截断 top N

- [ ] **Step 5: 运行 `inventory` 测试并确认失败**

Run: `pnpm test src/diagnostics/collection/inventory.test.ts`
Expected: FAIL

- [ ] **Step 6: 实现 `src/diagnostics/collection/inventory.ts`**

至少导出：

```ts
export async function loadCollectionInventory(...)
export async function buildPersistedSummary(...)
```

- [ ] **Step 7: 写 `run-collection` 测试**

覆盖：
- `--run-collection` 时会调用 `runCollectJob()`
- 会把 orchestrator 返回值映射到 diagnostics `run.counts`
- 会生成 `runCandidateSummary`

- [ ] **Step 8: 运行 `run-collection` 测试并确认失败**

Run: `pnpm test src/diagnostics/collection/run-collection.test.ts`
Expected: FAIL

- [ ] **Step 9: 实现 `run-collection.ts` 和 `summarize-candidates.ts`**

确保只读模式与写入模式使用不同摘要字段：
- `persistedSummary`
- `runCandidateSummary`

- [ ] **Step 10: 运行 collection diagnostics 测试**

Run: `pnpm test src/diagnostics/collection/health.test.ts src/diagnostics/collection/inventory.test.ts src/diagnostics/collection/run-collection.test.ts`
Expected: PASS

- [ ] **Step 11: 运行类型检查**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/diagnostics/collection
git commit -m "feat: add collection diagnostics modules"
```

---

## Task 4: 建立 reports diagnostics 模块并迁移旧验收逻辑

**Files:**
- Create: `src/diagnostics/reports/types.ts`
- Create: `src/diagnostics/reports/config.ts`
- Create: `src/diagnostics/reports/inventory.ts`
- Create: `src/diagnostics/reports/verify-daily.ts`
- Create: `src/diagnostics/reports/verify-weekly.ts`
- Create: `src/diagnostics/reports/verify-integrity.ts`
- Test: `src/diagnostics/reports/config.test.ts`
- Test: `src/diagnostics/reports/verify-daily.test.ts`
- Test: `src/diagnostics/reports/verify-weekly.test.ts`
- Test: `src/diagnostics/reports/verify-integrity.test.ts`
- Read: `scripts/verify-reports-pipeline.ts`

- [ ] **Step 1: 从旧脚本梳理 stage/assertion 映射表**

把以下旧标识整理进测试用例名或 fixture 中：
- `B-04`
- `B-05`
- `B-06`
- `B-08`
- `D-17`
- `E-10`
- `G-05`
- `G-06`
- `F-01`
- `F-03`
- `F-04`
- `F-05`
- `F-06`
- `F-07`

- [ ] **Step 2: 写 `config` 测试**

覆盖：
- `--config-only` 只跑配置相关 assertions
- 非法 body / nullable prompts / weekly days 校验会返回对应 assertion id

- [ ] **Step 3: 运行 `config` 测试并确认失败**

Run: `pnpm test src/diagnostics/reports/config.test.ts`
Expected: FAIL

- [ ] **Step 4: 实现 `config.ts`**

导出函数示例：

```ts
export async function runReportsConfigAssertions(...)
```

要求输出 machine-readable assertions，而不是只拼接字符串。

- [ ] **Step 5: 写 `verify-daily` 测试**

覆盖：
- 北京时间目标日期解析
- 日报 topics 非空校验
- empty daily API / latest daily API

- [ ] **Step 6: 运行 `verify-daily` 测试并确认失败**

Run: `pnpm test src/diagnostics/reports/verify-daily.test.ts`
Expected: FAIL

- [ ] **Step 7: 实现 `inventory.ts` 和 `verify-daily.ts`**

要求：
- resolved target 使用 `beijingDayRange()` 和相关日期工具
- `ReportsDiagnosticsSection.resolvedTargets.dailyDate` 必须被填充

- [ ] **Step 8: 写 `verify-weekly` 测试**

覆盖：
- 北京时间目标周解析
- weekly picks 非空
- empty weekly API / latest weekly API

- [ ] **Step 9: 运行 `verify-weekly` 测试并确认失败**

Run: `pnpm test src/diagnostics/reports/verify-weekly.test.ts`
Expected: FAIL

- [ ] **Step 10: 实现 `verify-weekly.ts`**

要求：
- resolved target 使用 `beijingWeekRange()` 和 `utcWeekNumber()`
- `ReportsDiagnosticsSection.resolvedTargets.weeklyWeekNumber` 必须被填充

- [ ] **Step 11: 写 `verify-integrity` 测试**

覆盖：
- `F-01 DigestTopic FK`
- `F-03 WeeklyPick FK`
- `F-04 topicCount accuracy`
- `F-05 Weekly item source`
- `F-06 Item fields`
- `F-07 Tweet fields`

- [ ] **Step 12: 运行 `verify-integrity` 测试并确认失败**

Run: `pnpm test src/diagnostics/reports/verify-integrity.test.ts`
Expected: FAIL

- [ ] **Step 13: 实现 `verify-integrity.ts`**

导出：

```ts
export async function runIntegrityAssertions(...)
```

- [ ] **Step 14: 运行 reports diagnostics 测试**

Run: `pnpm test src/diagnostics/reports/config.test.ts src/diagnostics/reports/verify-daily.test.ts src/diagnostics/reports/verify-weekly.test.ts src/diagnostics/reports/verify-integrity.test.ts`
Expected: PASS

- [ ] **Step 15: 运行类型检查**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 16: Commit**

```bash
git add src/diagnostics/reports
git commit -m "feat: add reports diagnostics modules"
```

---

## Task 5: 组装 runners、formatter 和统一 CLI 入口

**Files:**
- Create: `src/diagnostics/core/format.ts`
- Create: `src/diagnostics/core/format.test.ts`
- Create: `src/diagnostics/runners/collection.ts`
- Create: `src/diagnostics/runners/reports.ts`
- Create: `src/diagnostics/runners/full.ts`
- Create: `scripts/diagnostics.ts`
- Create: `app/api/diagnostics/preflight/route.ts`
- Test: `src/diagnostics/runners/collection.test.ts`
- Test: `src/diagnostics/runners/reports.test.ts`
- Test: `src/diagnostics/runners/full.test.ts`
- Test: `scripts/diagnostics.test.ts`

- [ ] **Step 1: 写 runner 测试**

覆盖：
- `collection` runner 只读模式
- `reports` runner 在 `--config-only` / `--daily-only` / `--weekly-only` 模式下的阶段裁剪
- `full` 默认是写入型 reports 验收
- `full --run-collection` 会先跑 collection 再跑 reports
- `--api-url` 指向 env/dbHost 不一致的 API 时，CLI 会在任何写阶段前拒绝执行

- [ ] **Step 2: 运行 runner 测试并确认失败**

Run: `pnpm test src/diagnostics/runners/collection.test.ts src/diagnostics/runners/reports.test.ts src/diagnostics/runners/full.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 `format` 与 CLI 输出层失败测试**

至少覆盖：
- formatter 正常输出 mode/env/dbHost/risk banner
- production 写入时会输出额外风险警告
- JSON 输出路径不可写时，主结果仍可打印
- formatter 抛错时，JSON 序列化仍可成功

- [ ] **Step 4: 运行 format/CLI 输出层测试并确认失败**

Run: `pnpm test src/diagnostics/core/format.test.ts scripts/diagnostics.test.ts`
Expected: FAIL

- [ ] **Step 5: 实现 `app/api/diagnostics/preflight/route.ts`**

返回结构示例：

```ts
return success({
  environment: inferredEnv,
  dbHost: redactedDbHost,
})
```

要求复用 `lib/api-response.ts` 共享工具，并确保 CLI 可依赖它做 split-brain 校验。

- [ ] **Step 6: 实现 `format.ts`**

至少导出：

```ts
export function formatDiagnosticsRun(result: DiagnosticsRunResult): string
export function serializeDiagnosticsRun(result: DiagnosticsRunResult): string
```

要求：
- formatter 失败不影响 JSON 输出
- JSON 输出可选加入 `schemaVersion`

- [ ] **Step 7: 实现三个 runner**

确保：
- runner 只做编排，不重写底层业务逻辑
- 所有门禁与参数归一化在进入 runner 前完成

- [ ] **Step 8: 实现 `scripts/diagnostics.ts`**

CLI 至少支持：

```bash
npx tsx scripts/diagnostics.ts collection
npx tsx scripts/diagnostics.ts collection --run-collection --allow-write
npx tsx scripts/diagnostics.ts reports --config-only
npx tsx scripts/diagnostics.ts reports --daily-only
npx tsx scripts/diagnostics.ts reports --weekly-only
npx tsx scripts/diagnostics.ts full
npx tsx scripts/diagnostics.ts full --run-collection --allow-write --cleanup --confirm-cleanup
```

- [ ] **Step 9: 运行 runner/CLI/format 测试**

Run: `pnpm test src/diagnostics/core/format.test.ts scripts/diagnostics.test.ts src/diagnostics/runners/collection.test.ts src/diagnostics/runners/reports.test.ts src/diagnostics/runners/full.test.ts`
Expected: PASS

- [ ] **Step 10: 运行类型检查**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/diagnostics/runners src/diagnostics/core/format.ts src/diagnostics/core/format.test.ts scripts/diagnostics.ts scripts/diagnostics.test.ts app/api/diagnostics/preflight/route.ts
git commit -m "feat: add diagnostics runners and unified cli"
```

---

## Task 6: 清理旧入口并完成仓库级迁移

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: repo-wide references found by `rg`
- Delete: `scripts/verify-reports-pipeline.ts`
- Optional Modify: `package.json`

- [ ] **Step 1: 删除旧脚本**

删除：
- `scripts/verify-reports-pipeline.ts`

- [ ] **Step 2: 用 `rg` 扫描仓库内旧命令与旧脚本引用**

Run:

```bash
rg "verify-reports-pipeline|scripts/diagnostics.ts|L2 配置|L3 日报|L4 周报|L5 全量" .
```

Expected: 列出所有需要迁移或明确豁免的引用位置。

- [ ] **Step 3: 更新 `AGENTS.md`**

把旧命令替换成：
- `diagnostics.ts reports --config-only`
- `diagnostics.ts reports --daily-only`
- `diagnostics.ts reports --weekly-only`
- `diagnostics.ts full --run-collection --cleanup`

- [ ] **Step 4: 更新 `README.md` 与其他扫描结果**

新增 diagnostics 使用说明，并逐一处理 `rg` 扫描出的旧引用。

- [ ] **Step 5: 如有必要更新 `package.json`**

例如增加：

```json
{
  "scripts": {
    "diagnostics": "tsx scripts/diagnostics.ts"
  }
}
```

- [ ] **Step 6: 运行类型检查与构建**

Run: `pnpm check && pnpm build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md README.md package.json scripts/diagnostics.ts
git rm scripts/verify-reports-pipeline.ts
git commit -m "refactor: replace legacy verify script with diagnostics entrypoint"
```

---

## Task 7: 在测试数据库上跑完整命令矩阵并修复发现的问题

**Files:**
- Modify: diagnostics-related files as needed based on failures
- Output: validation notes for final report

- [ ] **Step 1: 配置测试数据库环境**

确保本轮验收使用测试数据库，并显式设置：

```bash
export DIAGNOSTICS_ENV=test
export DATABASE_URL='postgresql://...test...'
export DIRECT_URL='postgresql://...test...'
```

记录脱敏后的 DB host，确认不是生产库。

- [ ] **Step 2: 先跑只读命令组合**

Run:

```bash
npx tsx scripts/diagnostics.ts collection
npx tsx scripts/diagnostics.ts reports --config-only
```

Expected: 只读命令都能完成，不触发写入门禁错误。

- [ ] **Step 3: 确认完整有效命令矩阵**

支持矩阵如下：

| 命令组合 | 风险级别 | 必需确认 |
|----------|----------|----------|
| `collection` | `read-only` | 无 |
| `collection --run-collection` | `write` | `--allow-write` |
| `reports --config-only` | `read-only` | 无 |
| `reports` | `write` | `--allow-write` |
| `reports --daily-only` | `write` | `--allow-write` |
| `reports --weekly-only` | `write` | `--allow-write` |
| `reports --cleanup` | `high-risk-write` | `--allow-write --confirm-cleanup` |
| `reports --daily-only --cleanup` | `high-risk-write` | `--allow-write --confirm-cleanup` |
| `reports --weekly-only --cleanup` | `high-risk-write` | `--allow-write --confirm-cleanup` |
| `full` | `write` | `--allow-write` |
| `full --run-collection` | `write` | `--allow-write` |
| `full --cleanup` | `high-risk-write` | `--allow-write --confirm-cleanup` |
| `full --run-collection --cleanup` | `high-risk-write` | `--allow-write --confirm-cleanup` |

- [ ] **Step 4: 跑所有有效写入命令组合**

Run:

```bash
npx tsx scripts/diagnostics.ts collection --run-collection --allow-write
npx tsx scripts/diagnostics.ts reports --allow-write
npx tsx scripts/diagnostics.ts reports --daily-only --allow-write
npx tsx scripts/diagnostics.ts reports --weekly-only --allow-write
npx tsx scripts/diagnostics.ts reports --cleanup --allow-write --confirm-cleanup
npx tsx scripts/diagnostics.ts reports --daily-only --cleanup --allow-write --confirm-cleanup
npx tsx scripts/diagnostics.ts reports --weekly-only --cleanup --allow-write --confirm-cleanup
npx tsx scripts/diagnostics.ts full --allow-write
npx tsx scripts/diagnostics.ts full --run-collection --allow-write
npx tsx scripts/diagnostics.ts full --cleanup --allow-write --confirm-cleanup
npx tsx scripts/diagnostics.ts full --run-collection --cleanup --allow-write --confirm-cleanup
```

Expected: 写入命令在测试库上可以通过显式确认正常执行。

- [ ] **Step 5: 跑非法组合并验证正确拒绝**

Run:

```bash
npx tsx scripts/diagnostics.ts collection --cleanup
npx tsx scripts/diagnostics.ts reports --config-only --cleanup
npx tsx scripts/diagnostics.ts reports --daily-only --weekly-only
npx tsx scripts/diagnostics.ts full --confirm-cleanup
```

Expected: 全部被拒绝，并返回明确错误。

- [ ] **Step 6: 记录所有有效命令组合的结果**

至少记录：
- 命令
- 目标环境
- 风险级别
- 所需确认参数
- 是否通过
- 若失败，失败在哪个 stage/assertion

- [ ] **Step 7: 若发现 diagnostics 缺陷，先修 diagnostics 再重跑受影响组合**

修复后至少重跑对应命令与 `pnpm check`。

- [ ] **Step 8: 若发现业务代码问题，先用 subagent 做规划再修复**

要求：
- 先 dispatch subagent 梳理问题边界
- 得到修复计划后再改业务代码
- 修复后重跑受影响 diagnostics 组合

- [ ] **Step 9: 运行完整构建验收**

Run:

```bash
pnpm check
pnpm build
```

Expected: PASS

- [ ] **Step 10: 整理最终详细汇报**

汇报必须包含：
- 实现了哪些 diagnostics 能力
- 实际跑了哪些命令组合
- 通过/失败情况
- 发现并修复了哪些业务问题
- 如何验证修复
- 剩余风险与建议

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "test: validate diagnostics command matrix on test database"
```

---

## 执行注意事项

1. **先测后写。** 每个新增模块先写失败测试，再实现最小代码。
2. **共享 orchestrator 是硬边界。** 不允许为 diagnostics 单独复制 collect 主流程。
3. **时间边界必须复用北京时间工具。** 不要在 diagnostics 内部重新发明日期计算。
4. **命令矩阵验收是交付标准的一部分。** 不是“有空再跑”。
5. **发现业务问题不能直接蛮改。** 必须先用 subagent 规划，再实施修复。
6. **频繁提交。** 每完成一个任务就提交，保持可回退。
