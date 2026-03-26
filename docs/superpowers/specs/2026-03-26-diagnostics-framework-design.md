# Diagnostics Framework 重构设计

**日期**: 2026-03-26
**状态**: Draft

## 背景

当前项目的诊断与验收能力主要集中在 [`scripts/verify-reports-pipeline.ts`](/Users/lyq/ai-enhance/information-aggregator/scripts/verify-reports-pipeline.ts) 中。该脚本已经承载了较高价值的日报、周报和全链路验收逻辑，但存在几个问题：

1. 脚本同时承担参数解析、流程编排、阶段校验、结果汇总和终端展示，职责过重。
2. 采集诊断、源健康、候选摘要等日常 debug 诉求没有统一入口。
3. 现有逻辑难以复用到未来的 API、后台运维页或结构化 JSON 输出。
4. 生产环境与测试环境下的写入安全边界不够清晰，误操作风险较高。

本次重构的目标不是继续扩展旧脚本，而是建立项目级 diagnostics framework，将“采集可观测性”“报表验收”“统一输出模型”“安全门禁”纳入同一套架构中，并彻底废弃旧的 `verify-reports-pipeline.ts` 命名与实现。

## 目标

1. 用一个统一入口脚本承载 collection、reports、full 三类诊断模式。
2. 将核心逻辑下沉到 `src/diagnostics`，脚本仅保留 CLI 壳职责。
3. 统一 stage/result 数据结构，支持终端输出、JSON 输出和未来 API/UI 复用。
4. 让 diagnostics 同时覆盖：
   - 源健康状态与采集统计
   - 主动跑一轮采集后的真实落库诊断
   - 日报/周报配置校验、生成验证与一致性检查
5. 引入明确的环境和写入门禁，支持测试库全链路验收，也支持生产库只读诊断与受控写入。

## 非目标

本次重构先不包含：

1. 页面化 diagnostics UI
2. 默认源模板 + overlay 配置系统的实现
3. 将所有 cron route 或 API route 全部改写为直接走 diagnostics
4. 与当前需求无关的额外子命令扩展

## 总体方案

### 统一入口

新增统一脚本入口：

```bash
npx tsx scripts/diagnostics.ts collection
npx tsx scripts/diagnostics.ts reports
npx tsx scripts/diagnostics.ts full
```

旧文件 [`scripts/verify-reports-pipeline.ts`](/Users/lyq/ai-enhance/information-aggregator/scripts/verify-reports-pipeline.ts) 删除，不保留兼容壳。项目文档、AGENTS 指引和后续验收命令全部切换到新入口。

### 目录结构

```text
src/diagnostics/
├── core/
│   ├── guards.ts
│   ├── result.ts
│   ├── types.ts
│   └── format.ts
├── collection/
│   ├── health.ts
│   ├── inventory.ts
│   ├── run-collection.ts
│   ├── summarize-candidates.ts
│   └── types.ts
├── reports/
│   ├── config.ts
│   ├── inventory.ts
│   ├── verify-daily.ts
│   ├── verify-weekly.ts
│   ├── verify-integrity.ts
│   └── types.ts
└── runners/
    ├── collection.ts
    ├── reports.ts
    └── full.ts
```

脚本层仅保留：

```text
scripts/
└── diagnostics.ts
```

### 职责划分

- `core`
  - 定义统一结果模型
  - 聚合 stage 状态
  - 处理环境/权限门禁
  - 负责终端输出和 JSON 输出格式化
- `collection`
  - 汇总 `Source` / `SourceHealth`
  - 做采集 inventory
  - 执行真实采集并记录去重前后统计
  - 生成候选摘要
- `reports`
  - 读取配置
  - 运行或验证日报、周报
  - 执行 FK / 一致性检查
  - 复用现有 `verify-reports-pipeline.ts` 的高价值验收逻辑
- `runners`
  - 将多个阶段串成一轮 diagnostics run
  - 生成统一的 `DiagnosticsRunResult`

## 命令模型

### 子命令

#### `collection`

用于日常运维和排查，覆盖：

1. 源健康状态
2. 最近数据盘点
3. 可选主动采集并真实落库
4. 候选内容摘要

建议参数：

```bash
npx tsx scripts/diagnostics.ts collection \
  [--run-collection] \
  [--since-hours 24] \
  [--summary-top 10] \
  [--json-output /tmp/diagnostics.json] \
  [--verbose]
```

#### `reports`

用于日报、周报与配置相关验收，覆盖：

1. 配置校验
2. 日报生成与验证
3. 周报生成与验证
4. FK / 完整性检查
5. latest / empty API 行为检查

建议参数：

```bash
npx tsx scripts/diagnostics.ts reports \
  [--config-only] \
  [--daily-only] \
  [--weekly-only] \
  [--skip-collection] \
  [--cleanup] \
  [--api-url http://localhost:3000] \
  [--timeout 300] \
  [--poll-interval 3] \
  [--daily-packs tech,ai] \
  [--max-items 30] \
  [--pick-count 5] \
  [--json-output /tmp/diagnostics.json] \
  [--verbose]
```

#### `full`

用于完整验收，先执行 collection diagnostics，再执行 reports diagnostics。

```bash
npx tsx scripts/diagnostics.ts full \
  [--run-collection] \
  [--cleanup] \
  [--api-url http://localhost:3000] \
  [--json-output /tmp/diagnostics.json] \
  [--verbose]
```

### 公共参数

所有子命令统一支持：

- `--json-output <path>`
- `--verbose`
- `--allow-write`
- `--confirm-production`
- `--confirm-cleanup`

## 统一结果模型

### 顶层结果

```ts
interface DiagnosticsRunResult {
  mode: "collection" | "reports" | "full"
  startedAt: string
  finishedAt: string
  durationMs: number
  status: "PASS" | "WARN" | "FAIL"
  summary: {
    pass: number
    warn: number
    fail: number
    skip: number
  }
  stages: DiagnosticsStageResult[]
  sections?: {
    collection?: CollectionDiagnosticsSection
    reports?: ReportsDiagnosticsSection
  }
}
```

### Stage 结果

```ts
interface DiagnosticsStageResult {
  key: string
  label: string
  category: "collection" | "reports" | "system"
  status: "PASS" | "WARN" | "FAIL" | "SKIP"
  durationMs: number
  details?: string
  data?: Record<string, unknown>
}
```

### Collection section

```ts
interface CollectionDiagnosticsSection {
  inventory: {
    itemCount: number
    tweetCount: number
    sourceCount: number
    unhealthySourceCount: number
  }
  health: Array<{
    sourceId: string
    sourceName: string
    status: "healthy" | "warning" | "failing" | "unknown"
    consecutiveFailures: number
    lastSuccessAt?: string
    lastFailureAt?: string
    lastError?: string
  }>
  run?: {
    triggered: boolean
    sourceEvents: Array<{
      sourceId: string
      status: "success" | "failure" | "zero-items"
      itemCount: number
      latencyMs?: number
      error?: string
    }>
    counts: {
      raw: number
      normalized: number
      afterExactDedup: number
      afterNearDedup: number
      archivedNew?: number
      archivedUpdated?: number
    }
  }
  candidateSummary?: {
    topItems: Array<{
      id: string
      title: string
      sourceName: string
      score?: number
      publishedAt?: string
    }>
    topTweets: Array<{
      id: string
      authorHandle: string
      text: string
      score?: number
      publishedAt?: string
    }>
  }
}
```

### Reports section

```ts
interface ReportsDiagnosticsSection {
  config?: {
    daily: Record<string, unknown>
    weekly: Record<string, unknown>
  }
  inventory: {
    items: number
    tweets: number
    dailyReports: number
    weeklyReports: number
  }
  daily?: {
    date?: string
    topicCount?: number
  }
  weekly?: {
    weekNumber?: string
    pickCount?: number
  }
}
```

## 数据流设计

### `collection` 模式

1. 先做环境与权限检查，确定本次 run 的风险级别。
2. 读取 `Source` / `SourceHealth`，生成源健康摘要。
3. 读取最近窗口内的 `Item` / `Tweet`，生成人工可读 inventory。
4. 如果未传 `--run-collection`：
   - 输出离线 health + inventory + candidate summary
5. 如果传入 `--run-collection`：
   - 直接在项目内调用采集逻辑，而不是请求本地 API
   - 捕获 `onSourceEvent`
   - 统计 `raw -> normalized -> exact dedupe -> near dedupe -> archive`
   - 真实落库
   - 再基于落库结果生成最终 inventory 与 candidate summary

### `reports` 模式

1. 进行环境与权限检查。
2. 读取并可选验证日报/周报配置。
3. 统计现有 `Item` / `Tweet` / `DailyOverview` / `WeeklyReport` 数量。
4. 根据参数决定：
   - 仅配置校验
   - 仅日报校验
   - 仅周报校验
   - 跳过 collection
   - cleanup 后执行全量验收
5. 复用现有报表生成与验证逻辑，输出统一 stage 结果。

### `full` 模式

1. 先执行 collection runner
2. 再执行 reports runner
3. 合并两个 runner 的 stages 和 sections
4. 顶层状态按最严重级别汇总

## 错误处理

### Stage 级处理

每个 stage 独立捕获错误并返回 `DiagnosticsStageResult`：

- 可继续执行的错误记为 `WARN` 或 `FAIL`
- 只有前置条件不满足、环境门禁不通过等致命错误才中断整个 run

### Runner 级聚合

runner 根据 stage 结果聚合顶层状态：

1. 存在 `FAIL` -> 顶层 `FAIL`
2. 无 `FAIL` 但存在 `WARN` -> 顶层 `WARN`
3. 全部通过 -> 顶层 `PASS`

### 输出级处理

1. JSON 写出失败不应吞掉主结果
2. 终端格式化失败不应影响结果对象生成
3. 任何展示层错误都必须在终端明确暴露

## 安全与环境门禁

### 环境变量

新增约束环境变量：

```bash
DIAGNOSTICS_ENV=test|production
```

若未设置，默认按 `production` 处理。

### 动作分级

#### 只读

不会修改数据库：

- collection 离线诊断
- reports 配置校验
- inventory / FK / health 校验

#### 普通写入

会触发真实业务写入，但不主动清理：

- `collection --run-collection`
- 触发日报/周报生成
- `full`

#### 高风险写入

会删除或清理已有报表数据：

- `--cleanup`
- 未来 reset / rebuild 类参数

### 门禁规则

#### `DIAGNOSTICS_ENV=test`

- 只读：直接执行
- 普通写入：要求 `--allow-write`
- 高风险写入：要求 `--allow-write --confirm-cleanup`

#### `DIAGNOSTICS_ENV=production`

- 只读：直接执行
- 普通写入：要求 `--allow-write --confirm-production`
- 高风险写入：要求 `--allow-write --confirm-production --confirm-cleanup`

### 运行前提示

每次执行前必须打印：

1. 当前 mode
2. 当前 `DIAGNOSTICS_ENV`
3. 脱敏后的数据库 host
4. 本次动作级别：`read-only` / `write` / `high-risk write`

如果是生产写入，还需要打印醒目的风险摘要，明确说明：

1. 是否会触发采集
2. 是否会生成日报/周报
3. 是否会 cleanup

## 与现有实现的关系

### 需要保留的现有能力

从旧 [`scripts/verify-reports-pipeline.ts`](/Users/lyq/ai-enhance/information-aggregator/scripts/verify-reports-pipeline.ts) 中迁移并保留：

1. 配置 API 校验
2. 日报/周报生成与验证
3. FK 完整性检查
4. 空结果 API 行为校验
5. latest API 行为校验
6. `topicCount` 准确性校验
7. Weekly item source 约束校验

### 需要新增的能力

1. collection-only diagnostics
2. 源健康摘要
3. 主动采集后的多阶段计数
4. 候选内容摘要
5. 统一的 JSON 结果格式
6. 环境感知的写入门禁

## 测试策略

### 单元测试

覆盖：

1. stage/status 聚合逻辑
2. 环境门禁判断
3. 参数归一化
4. 结果对象格式化

### 集成测试

覆盖：

1. `collection` runner 的只读模式
2. `collection --run-collection` 的真实落库模式
3. `reports` runner 在不同参数组合下的行为
4. stage 失败后的聚合结果

### 端到端验收

使用新统一脚本替代旧验收命令，保留当前 AGENTS 中定义的验收级别，但映射到新入口：

| 级别 | 新命令形态 |
|------|-----------|
| L2 配置 | `diagnostics.ts reports --config-only` |
| L3 日报 | `diagnostics.ts reports --daily-only` |
| L4 周报 | `diagnostics.ts reports --weekly-only` |
| L5 全量 | `diagnostics.ts full --run-collection --cleanup` |

### 手工验证

至少验证以下场景：

1. `collection` 只读运行
2. `collection --run-collection` 在测试库写入
3. `reports --config-only`
4. `reports --daily-only`
5. `reports --weekly-only`
6. `full --run-collection --cleanup`
7. `production` 环境下写入门禁

## 迁移计划

1. 创建 `src/diagnostics/core`，先落统一类型、状态聚合和安全门禁。
2. 创建 `src/diagnostics/collection`，实现 health、inventory、run-collection、candidate summary。
3. 创建 `src/diagnostics/reports`，迁移旧脚本中的配置、日报、周报和完整性验证逻辑。
4. 创建 `src/diagnostics/runners`，串联 collection、reports 和 full 模式。
5. 新增统一入口 [`scripts/diagnostics.ts`](/Users/lyq/ai-enhance/information-aggregator/scripts/diagnostics.ts)。
6. 删除旧 [`scripts/verify-reports-pipeline.ts`](/Users/lyq/ai-enhance/information-aggregator/scripts/verify-reports-pipeline.ts)。
7. 更新 [`AGENTS.md`](/Users/lyq/ai-enhance/information-aggregator/AGENTS.md) 中所有旧命令引用。
8. 补充 tests，并执行 `pnpm check` 与 `pnpm build` 验证。

## 风险与取舍

### 风险

1. 一次性重构范围较大，若不先定义清晰的模块边界，容易把大脚本迁移成“大 runner”。
2. 旧脚本中部分逻辑可能隐含耦合，需要在迁移过程中明确抽象层次。
3. 真实落库的 diagnostics 工具如果门禁设计不严，生产环境存在误操作风险。

### 取舍

1. 本次优先建立可复用的 diagnostics framework，不优先做页面。
2. 允许 `reports` 继续使用部分 API/现有服务做验收编排，但其校验逻辑必须项目内聚合，不再埋在脚本里。
3. 不把配置 overlay 系统并入本次重构，避免范围失控。

## 最终建议

采用“**单脚本统一入口 + 完整 diagnostics 框架**”方案：

1. 统一入口：`scripts/diagnostics.ts`
2. 统一能力层：`src/diagnostics`
3. 统一结果模型：`DiagnosticsRunResult`
4. 统一安全门禁：环境 + 写入确认
5. 彻底废弃旧 `verify-reports-pipeline.ts`

这样可以一次性把项目的日常 debug、采集可观测性和报表验收纳入同一套架构，为后续 API 或运维页提供稳定底座。
