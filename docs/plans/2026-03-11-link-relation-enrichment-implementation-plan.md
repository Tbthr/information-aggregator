# Link Relation Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为现有 pipeline 增加确定性的 link relation enrichment，并同步收口活跃文档语义。

**Architecture:** 先对齐活跃文档，再通过 TDD 在 `normalize -> rank -> view` 链路中引入最小关系字段。实现只消费已有 `canonicalHints` 和 canonical URL，不新增网络抓取或 adapter 复杂度。

**Tech Stack:** TypeScript、Bun、bun:test、Markdown、YAML

---

### Task 1: 对齐活跃文档中的 source / placeholder 语义

**Files:**
- Modify: `README.md`
- Modify: `docs/testing.md`
- Modify: `docs/plans/2026-03-10-source-type-roadmap-design.md`
- Modify: `docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md`

**Step 1: 更新 README 中的运行时边界说明**

- 明确 YAML 只保留 runnable source / pack
- 明确 `config.placeholderMode: schema` 仅用于 source 级 schema placeholder
- 把 Phase 4 首个切片表述成 relation enrichment

**Step 2: 更新 testing 文档**

- 删除或收敛仍暗示 reference source / reference pack 的描述
- 明确 relation enrichment 不引入新网络依赖

**Step 3: 更新 source roadmap 设计文档**

- 删除 reference-only pack 作为当前活跃语义的表述
- 改成“历史审计发现”与“当前已收敛状态”
- 加入 Phase 4 首个切片说明

**Step 4: 更新 source roadmap 实施计划**

- 明确 Task 1 已完成并被后续 query-runner 设计收口
- 补充 relation enrichment 作为后续优先项

**Step 5: Commit**

```bash
git add README.md docs/testing.md docs/plans/2026-03-10-source-type-roadmap-design.md docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md
git commit -m "docs: align roadmap with runnable config semantics"
```

### Task 2: 为 relation enrichment 写失败测试

**Files:**
- Modify: `src/pipeline/normalize.test.ts`
- Modify: `src/pipeline/rank.test.ts`
- Modify: `src/views/x-longform-hot.test.ts`
- Modify: `src/views/x-analysis.test.ts`

**Step 1: 在 normalize 测试里新增关系断言**

- X post 带 `expandedUrl` 时应生成 `share` 关系和 `linkedCanonicalUrl`
- reddit / hn discussion item 指向外链时应生成 `discussion` 关系

**Step 2: 在 rank 测试里新增有界惩罚断言**

- `discussion` 不应压过同 canonical 的 `original`
- `share` 只做轻微负向修正

**Step 3: 在 view 测试里新增展示断言**

- `x-longform-hot` 优先展示 linked article
- X analysis 视图显示 linked article 或 relation 标签

**Step 4: 运行测试，确认它失败**

Run:

```bash
bun test src/pipeline/normalize.test.ts src/pipeline/rank.test.ts src/views/x-longform-hot.test.ts src/views/x-analysis.test.ts
```

Expected: FAIL，因为当前还没有 relation 字段和对应视图行为。

### Task 3: 实现最小 relation enrichment

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/pipeline/normalize.ts`
- Modify: `src/pipeline/rank.ts`
- Modify: `src/views/x-longform-hot.ts`
- Modify: `src/views/x-bookmarks-analysis.ts`
- Modify: `src/views/x-likes-analysis.ts`

**Step 1: 扩展类型定义**

- 为 `NormalizedItem` 和 `RankedCandidate` 增加最小 relation 字段

**Step 2: 在 normalize 中实现关系判定**

- 根据 `contentType`、`canonicalUrl`、`url` 和 `canonicalHints` 生成：
  - `linkedCanonicalUrl`
  - `relationshipToCanonical`
  - `isDiscussionSource`

**Step 3: 在 rank 中加入有界关系修正**

- `discussion` 惩罚大于 `share`
- `original` 不惩罚

**Step 4: 在 X views 中消费 relation 字段**

- 优先展示 `linkedCanonicalUrl`
- 用最小文案标注 linked article / discussion source

**Step 5: 运行测试，确认通过**

Run:

```bash
bun test src/pipeline/normalize.test.ts src/pipeline/rank.test.ts src/views/x-longform-hot.test.ts src/views/x-analysis.test.ts
```

Expected: PASS

### Task 4: 补回归验证

**Files:**
- Optional Modify: `src/e2e/mock-sources.test.ts`

**Step 1: 评估是否需要 E2E 回归**

- 如果 view 输出变化已超出单元测试覆盖，则补最小 mock-source E2E

**Step 2: 运行针对性 E2E**

Run:

```bash
bun test src/e2e/mock-sources.test.ts
```

Expected: PASS

### Task 5: 完整验证

**Step 1: 运行变更相关测试**

Run:

```bash
bun test src/pipeline/normalize.test.ts src/pipeline/rank.test.ts src/views/x-longform-hot.test.ts src/views/x-analysis.test.ts src/e2e/mock-sources.test.ts
```

Expected: PASS

**Step 2: 运行全量单测**

Run:

```bash
bun test
```

Expected: PASS

**Step 3: 运行 smoke**

Run:

```bash
bun run smoke
```

Expected: PASS

### Task 6: 提交实现

**Step 1: Commit**

```bash
git add README.md docs/testing.md docs/plans/2026-03-10-source-type-roadmap-design.md docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md docs/plans/2026-03-11-link-relation-enrichment-design.md docs/plans/2026-03-11-link-relation-enrichment-implementation-plan.md src/types/index.ts src/pipeline/normalize.ts src/pipeline/rank.ts src/views/x-longform-hot.ts src/views/x-bookmarks-analysis.ts src/views/x-likes-analysis.ts src/pipeline/normalize.test.ts src/pipeline/rank.test.ts src/views/x-longform-hot.test.ts src/views/x-analysis.test.ts src/e2e/mock-sources.test.ts
git commit -m "feat: add deterministic link relation enrichment"
```
