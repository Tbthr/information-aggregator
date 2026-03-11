# Query Runner 与 View System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用统一的 `run --view` 查询入口替代当前 `scan` / `digest` 顶层模型，把时间窗口、source 选择、topic 与 view 变成一等参数，并保留 Markdown 输出与稳定中间层 JSON。

> 2026-03-11 状态更新：本计划中的“thin wrapper 兼容阶段”已结束；当前仓库只保留 `run --view`、`sources list`、`config validate` 等新 CLI surface。

**Architecture:** 先收紧配置语义，移除 `referenceOnly` 和 `profile.mode` 这类旧模型残留，再新增 `QuerySpec`、`SelectionResolver`、`QueryEngine` 和 `ViewRegistry`。实现采用短期兼容迁移：先引入新命令与新视图，把 `scan` / `digest` 降为 thin wrapper，待文档、测试和配置完成迁移后再删除旧入口。

**Tech Stack:** TypeScript、Bun、YAML、SQLite、bun:test

---

### Task 1: 先冻结新 CLI 契约与帮助文案

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/cli/index.test.ts`
- Modify: `scripts/aggregator.ts`

**Step 1: Write the failing test**

在 `src/cli/index.test.ts` 增加断言：
- help 文案包含 `run --view <view>`
- help 文案包含 `sources list`
- help 文案把 `scan` / `digest` 标记为 deprecated，或不再作为首选命令
- 参数解析支持 `run`、`sources list`、`config validate`

**Step 2: Run test to verify it fails**

Run: `bun test src/cli/index.test.ts -v`
Expected: FAIL，因为当前 help 仍只暴露 `scan` / `digest`。

**Step 3: Write minimal implementation**

- 扩展 `ParsedCliArgs`
- 更新 `getHelpText()`
- 让 `scripts/aggregator.ts` 先识别 `run` 和 `sources list`
- 旧 `scan` / `digest` 保留，但帮助文案不再把它们作为主入口

**Step 4: Run test to verify it passes**

Run: `bun test src/cli/index.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/index.ts src/cli/index.test.ts scripts/aggregator.ts
git commit -m "refactor: introduce run command in cli surface"
```

### Task 2: 收紧配置语义并移除 `referenceOnly`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/config/validate.ts`
- Modify: `src/config/load.test.ts`
- Modify: `config/packs/*.yaml`
- Modify: `config/sources.example.yaml`

**Step 1: Write the failing test**

在 `src/config/load.test.ts` 增加断言：
- pack schema 不再包含 `referenceOnly`
- 所有 pack 都代表当前可运行分组
- YAML 中不再保留 reference-only pack 或 schema placeholder pack
- 不再期待 `x-auth-reference`、`community-api-reference` 之类 pack 存在

**Step 2: Run test to verify it fails**

Run: `bun test src/config/load.test.ts -v`
Expected: FAIL，因为当前 pack 配置和 schema 仍保留 `referenceOnly`。

**Step 3: Write minimal implementation**

- 从 `SourcePack` 删除 `referenceOnly`
- 调整 `validateSourcePack()`
- 清理 `config/packs/*.yaml` 中的 `referenceOnly` 字段
- 从 `config/sources.example.yaml` 移除不应进入 runtime registry 的 source

**Step 4: Run test to verify it passes**

Run: `bun test src/config/load.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/config/validate.ts src/config/load.test.ts config/packs config/sources.example.yaml
git commit -m "refactor: keep only runnable packs in config"
```

### Task 3: 把 `profiles` 重定义为 query preset

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/config/validate.ts`
- Modify: `src/config/load.test.ts`
- Modify: `src/config/resolve-profile.test.ts`
- Modify: `config/profiles.example.yaml`

**Step 1: Write the failing test**

增加断言：
- `profiles` 不再要求 `mode`
- `profiles` 支持 `defaultView`
- `profiles` 支持 `defaultWindow`
- 旧 `mode` 字段被忽略或视为 deprecated

**Step 2: Run test to verify it fails**

Run: `bun test src/config/load.test.ts src/config/resolve-profile.test.ts -v`
Expected: FAIL，因为当前 profile schema 仍要求旧结构。

**Step 3: Write minimal implementation**

- 更新 `TopicProfile` 类型
- 更新 `validateProfile()`
- 修改 `config/profiles.example.yaml`
- 先保留旧 `resolveProfileSelection` 测试能编译，后续再替换实现

**Step 4: Run test to verify it passes**

Run: `bun test src/config/load.test.ts src/config/resolve-profile.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/config/validate.ts src/config/load.test.ts src/config/resolve-profile.test.ts config/profiles.example.yaml
git commit -m "refactor: redefine profiles as query presets"
```

### Task 4: 新增 `views` 配置加载与校验

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/config/load.ts`
- Modify: `src/config/validate.ts`
- Create: `src/config/views.test.ts`
- Create: `config/views.example.yaml`

**Step 1: Write the failing test**

在 `src/config/views.test.ts` 中断言：
- 可以加载 `config/views.example.yaml`
- `daily-brief`、`item-list`、`x-longform-hot`、`x-bookmarks-analysis`、`x-likes-analysis` 都存在
- 支持 `defaultWindow`、`defaultSort`、`defaultSourceTypes`

**Step 2: Run test to verify it fails**

Run: `bun test src/config/views.test.ts -v`
Expected: FAIL，因为当前没有 views config。

**Step 3: Write minimal implementation**

- 新增 view 类型定义与校验
- 在 `src/config/load.ts` 中增加 `loadViewsConfig()`
- 新建 `config/views.example.yaml`

**Step 4: Run test to verify it passes**

Run: `bun test src/config/views.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/config/load.ts src/config/validate.ts src/config/views.test.ts config/views.example.yaml
git commit -m "feat: add query view config"
```

### Task 5: 新增 `QuerySpec` 与 `run` 参数解析

**Files:**
- Create: `src/query/spec.ts`
- Create: `src/query/parse-cli.ts`
- Create: `src/query/parse-cli.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `scripts/aggregator.ts`

**Step 1: Write the failing test**

在 `src/query/parse-cli.test.ts` 中增加用例：
- `run --view daily-brief`
- `run --view item-list --pack ai-news-sites`
- `run --view x-bookmarks-analysis --window 7d`
- `run --view x-likes-analysis --since 2026-03-01T00:00:00Z --until 2026-03-08T00:00:00Z`
- `sources list --source-type x_bookmarks`

**Step 2: Run test to verify it fails**

Run: `bun test src/query/parse-cli.test.ts -v`
Expected: FAIL，因为当前没有 query CLI parser。

**Step 3: Write minimal implementation**

- 定义 `QuerySpec`
- 实现新 parser
- 让 `scripts/aggregator.ts` 调用 parser，并将结果路由到后续执行入口

**Step 4: Run test to verify it passes**

Run: `bun test src/query/parse-cli.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/query/spec.ts src/query/parse-cli.ts src/query/parse-cli.test.ts src/cli/index.ts scripts/aggregator.ts
git commit -m "feat: add query cli argument parsing"
```

### Task 6: 用通用 `SelectionResolver` 取代旧 `resolveProfileSelection`

**Files:**
- Create: `src/query/resolve-selection.ts`
- Create: `src/query/resolve-selection.test.ts`
- Modify: `src/config/resolve-profile.ts`
- Modify: `src/config/resolve-profile.test.ts`

**Step 1: Write the failing test**

在 `src/query/resolve-selection.test.ts` 中断言：
- 没有显式选择器时默认回落到 `profile=default`
- `--pack`、`--source-type`、`--source`、`--topic` 可叠加
- view 默认值会先应用，再被显式参数覆盖
- `since > until` 会报错
- `x-bookmarks-analysis` 在没有匹配 source 时给出清晰错误

**Step 2: Run test to verify it fails**

Run: `bun test src/query/resolve-selection.test.ts -v`
Expected: FAIL，因为当前只有 profile-only resolver。

**Step 3: Write minimal implementation**

- 定义 `ResolvedSelection`
- 合并 view defaults、profile defaults、explicit args
- 展开 packs，收敛成 selected sources 与 topic rule
- 把旧 `resolveProfileSelection()` 调整成 wrapper 或迁移调用方

**Step 4: Run test to verify it passes**

Run: `bun test src/query/resolve-selection.test.ts src/config/resolve-profile.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/query/resolve-selection.ts src/query/resolve-selection.test.ts src/config/resolve-profile.ts src/config/resolve-profile.test.ts
git commit -m "refactor: resolve query selection from views and selectors"
```

### Task 7: 抽出统一 `QueryEngine`

**Files:**
- Create: `src/query/run-query.ts`
- Create: `src/query/run-query.test.ts`
- Modify: `src/cli/run-scan.ts`
- Modify: `src/cli/run-digest.ts`
- Modify: `src/pipeline/collect.ts`

**Step 1: Write the failing test**

在 `src/query/run-query.test.ts` 中断言：
- 能从 selected sources 跑通 collect -> normalize -> dedupe -> rank
- 时间窗口过滤在 query 层统一生效
- 返回结果包含 `items`、`rankedItems`、`clusters`、`warnings`

**Step 2: Run test to verify it fails**

Run: `bun test src/query/run-query.test.ts -v`
Expected: FAIL，因为当前没有统一 query engine。

**Step 3: Write minimal implementation**

- 提取 `runScan` / `runDigest` 公共逻辑到 `runQuery()`
- 让旧 `runScan` / `runDigest` 暂时转为 wrapper
- 保留 deterministic pipeline，不把 view-specific 逻辑塞回 collect

**Step 4: Run test to verify it passes**

Run: `bun test src/query/run-query.test.ts src/cli/run-scan.test.ts src/cli/run-digest.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/query/run-query.ts src/query/run-query.test.ts src/cli/run-scan.ts src/cli/run-digest.ts src/pipeline/collect.ts
git commit -m "refactor: introduce shared query engine"
```

### Task 8: 实现 `item-list` 与 `daily-brief` view registry

**Files:**
- Create: `src/views/registry.ts`
- Create: `src/views/item-list.ts`
- Create: `src/views/daily-brief.ts`
- Create: `src/views/views.test.ts`
- Modify: `src/render/scan.ts`
- Modify: `src/render/digest.ts`

**Step 1: Write the failing test**

在 `src/views/views.test.ts` 中断言：
- `item-list` 能消费 `QueryResult` 并输出稳定 `ViewModel`
- `daily-brief` 能生成 highlights 与 clusters 结构
- 渲染 Markdown 后保留现有 `scan` / `digest` 核心观感

**Step 2: Run test to verify it fails**

Run: `bun test src/views/views.test.ts src/render/scan.test.ts src/render/digest.test.ts -v`
Expected: FAIL，因为当前没有 view registry。

**Step 3: Write minimal implementation**

- 建立 view registry
- 把现有 `scan` / `digest` 渲染逻辑迁为 `item-list` / `daily-brief` renderer
- 让旧 wrapper 复用新 view

**Step 4: Run test to verify it passes**

Run: `bun test src/views/views.test.ts src/render/scan.test.ts src/render/digest.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/registry.ts src/views/item-list.ts src/views/daily-brief.ts src/views/views.test.ts src/render/scan.ts src/render/digest.ts
git commit -m "feat: add item-list and daily-brief views"
```

### Task 9: 实现 `sources list` 与 JSON 输出

**Files:**
- Modify: `scripts/aggregator.ts`
- Modify: `src/query/run-query.ts`
- Create: `src/render/json.ts`
- Create: `src/render/json.test.ts`

**Step 1: Write the failing test**

增加测试，断言：
- `sources list` 能输出命中的 source 列表
- `run --format json` 能输出结构化 JSON
- JSON 中包含 `query`、`selection`、`rankedItems`、`clusters`、`viewModel`

**Step 2: Run test to verify it fails**

Run: `bun test src/render/json.test.ts -v`
Expected: FAIL，因为当前没有 JSON renderer。

**Step 3: Write minimal implementation**

- 增加 JSON renderer
- 为 `sources list` 提供只解析 selection 的执行路径
- 让 `run` 支持 `--format json`

**Step 4: Run test to verify it passes**

Run: `bun test src/render/json.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/aggregator.ts src/query/run-query.ts src/render/json.ts src/render/json.test.ts
git commit -m "feat: add source listing and json output"
```

### Task 10: 实现 `x-bookmarks-analysis` 与 `x-likes-analysis` view

**Files:**
- Create: `src/views/x-bookmarks-analysis.ts`
- Create: `src/views/x-likes-analysis.ts`
- Create: `src/views/x-analysis.test.ts`
- Modify: `src/views/registry.ts`

**Step 1: Write the failing test**

在 `src/views/x-analysis.test.ts` 中断言：
- `x-bookmarks-analysis` 支持时间窗口过滤后的主题、domain、author 聚合
- `x-likes-analysis` 支持时间窗口过滤后的兴趣统计
- Markdown 结构包含 summary、top themes、notable items

**Step 2: Run test to verify it fails**

Run: `bun test src/views/x-analysis.test.ts -v`
Expected: FAIL，因为当前没有这两个 view。

**Step 3: Write minimal implementation**

- 复用 `QueryResult` 增加 view-specific analytics
- 增加 Markdown renderer
- 在 registry 中注册两个新 view

**Step 4: Run test to verify it passes**

Run: `bun test src/views/x-analysis.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/x-bookmarks-analysis.ts src/views/x-likes-analysis.ts src/views/x-analysis.test.ts src/views/registry.ts
git commit -m "feat: add x bookmarks and likes analysis views"
```

### Task 11: 实现 `x-longform-hot` view

**Files:**
- Create: `src/views/x-longform-hot.ts`
- Create: `src/views/x-longform-hot.test.ts`
- Modify: `src/views/registry.ts`

**Step 1: Write the failing test**

在 `src/views/x-longform-hot.test.ts` 中断言：
- 长文本、外链、engagement 能参与排序
- 可按 `window=all` 运行
- Markdown 输出包含 hot posts、linked articles、clusters

**Step 2: Run test to verify it fails**

Run: `bun test src/views/x-longform-hot.test.ts -v`
Expected: FAIL，因为当前没有 longform hot view。

**Step 3: Write minimal implementation**

- 在 view 层增加 longform-specific scoring
- 输出适合 X 热帖发现的 `ViewModel`
- 挂入 registry

**Step 4: Run test to verify it passes**

Run: `bun test src/views/x-longform-hot.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/views/x-longform-hot.ts src/views/x-longform-hot.test.ts src/views/registry.ts
git commit -m "feat: add x longform hot view"
```

### Task 12: 用本地 E2E 覆盖新查询入口

**Files:**
- Modify: `src/e2e/mock-sources.test.ts`
- Modify: `src/e2e/post-mvp-mock-sources.test.ts`
- Modify: `src/e2e/source-runtime-repair.test.ts`

**Step 1: Write the failing test**

调整 E2E，断言：
- `run --view item-list` 能输出 Markdown
- `run --view daily-brief` 能输出 Markdown
- `run --view x-bookmarks-analysis` 能输出分析 Markdown
- `run --format json` 能输出结构化结果

**Step 2: Run test to verify it fails**

Run: `bun test src/e2e/mock-sources.test.ts src/e2e/post-mvp-mock-sources.test.ts src/e2e/source-runtime-repair.test.ts -v`
Expected: FAIL，因为当前 E2E 仍围绕 `scan` / `digest`。

**Step 3: Write minimal implementation**

- 调整测试入口到新 CLI / 新 query engine
- 保留必要的旧 wrapper 覆盖，确保迁移期行为清晰

**Step 4: Run test to verify it passes**

Run: `bun test src/e2e/mock-sources.test.ts src/e2e/post-mvp-mock-sources.test.ts src/e2e/source-runtime-repair.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/e2e/mock-sources.test.ts src/e2e/post-mvp-mock-sources.test.ts src/e2e/source-runtime-repair.test.ts
git commit -m "test: cover query views in e2e"
```

### Task 13: 同步 README、测试文档与活跃路线图

**Files:**
- Modify: `README.md`
- Modify: `docs/testing.md`
- Modify: `docs/plans/2026-03-09-information-aggregator-skill-design.md`
- Modify: `docs/plans/2026-03-09-information-aggregator-skill-implementation-plan.md`
- Modify: `docs/plans/2026-03-10-query-runner-view-system-design.md`

**Step 1: Write the failing test**

增加或调整现有文档一致性测试，断言：
- README 不再把 `scan` / `digest` 作为首选命令
- README 与 `docs/testing.md` 中命令示例改为 `run --view ...`
- 文档不再出现 runnable/reference-only pack 语义

**Step 2: Run test to verify it fails**

Run: `bun test src/config/load.test.ts src/cli/index.test.ts -v`
Expected: FAIL，因为文档和帮助文案尚未完全迁移。

**Step 3: Write minimal implementation**

- 更新 README
- 更新测试文档
- 更新活跃设计 / 历史计划中的“当前状态”说明
- 明确 `scan` / `digest` 已进入废弃迁移

**Step 4: Run test to verify it passes**

Run: `bun test src/config/load.test.ts src/cli/index.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md docs/testing.md docs/plans/2026-03-09-information-aggregator-skill-design.md docs/plans/2026-03-09-information-aggregator-skill-implementation-plan.md docs/plans/2026-03-10-query-runner-view-system-design.md
git commit -m "docs: migrate usage to query runner views"
```

### Task 14: 跑仓库级验证并收尾旧命令

**Files:**
- Modify: `src/cli/run-scan.ts`
- Modify: `src/cli/run-digest.ts`
- Modify: `src/verification/smoke.ts`
- Modify: `src/verification/smoke.test.ts`
- Modify: `scripts/e2e-real.ts`

**Step 1: Write the failing test**

调整 smoke / verification，断言：
- `bun scripts/aggregator.ts run --view item-list`
- `bun scripts/aggregator.ts run --view daily-brief`
- 新入口能替代旧 smoke 基线

**Step 2: Run test to verify it fails**

Run: `bun test src/verification/smoke.test.ts -v`
Expected: FAIL，因为当前 smoke 仍使用 `scan` / `digest`。

**Step 3: Write minimal implementation**

- 更新 smoke 和 real probe 脚本
- 决定旧 `run-scan.ts` / `run-digest.ts` 是保留 wrapper 还是删除
- 如果保留 wrapper，明确 deprecated 行为；如果删除，确保所有入口与测试已迁移

**Step 4: Run test to verify it passes**

Run:

```bash
bun test
bun run smoke
bun run e2e
```

Expected:
- `bun test`: PASS
- `bun run smoke`: PASS
- `bun run e2e`: PASS

**Step 5: Commit**

```bash
git add src/cli/run-scan.ts src/cli/run-digest.ts src/verification/smoke.ts src/verification/smoke.test.ts scripts/e2e-real.ts
git commit -m "refactor: verify query runner as primary execution path"
```
