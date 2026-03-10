# 数据源类型路线图实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 把当前的数据源类型路线图落成一组可执行的、按 TDD 推进的任务，覆盖 source type 体系、配置校验、adapter、规范化、去重、排序、测试与文档。

**架构：** 先收紧 source taxonomy 和 config schema，再逐步实现新 source type。所有新增类型都必须经过 fixture-first 测试、显式的 collector contract 和文档对齐，不能绕过既有 pipeline 直接落地。X family 统一通过 `bird CLI` 接入，enrichment 作为后置阶段引入。

**技术栈：** TypeScript、Bun、YAML、SQLite、bun:test、`bird CLI`

---

### 任务 1：先做 config / pack 审计与命名收敛

状态注记（2026-03-11）：

- 该任务的核心目标已完成
- 当前仓库已删除 reference-only pack 运行时语义
- 当前应把这部分视为历史实施记录，而不是待执行项

**文件：**
- 修改：`config/sources.example.yaml`
- 修改：`config/packs/*.yaml`
- 修改：`README.md`
- 修改：`docs/plans/2026-03-10-source-type-roadmap-design.md`
- 测试：`src/config/load.test.ts`

**步骤 1：先写失败测试**

增加测试，明确断言：
- pack 中不存在悬空 `sourceIds`
- `twitter_*` 不再作为仓库正式命名
- `hackernews` 不再作为正式命名，统一为 `hn`
- YAML 中不再保留 reference-only packs 作为运行时分组

**步骤 2：运行测试，确认它失败**

运行：`bun test src/config/load.test.ts`
预期：FAIL，因为当前配置和文档仍然存在 `twitter_*` / `hackernews` 等漂移。

**步骤 3：写最小实现**

- 把 X 相关 placeholder 统一改成 `x_*`
- 把 `hackernews` 统一改成 `hn`
- 从 pack 语义中移除 reference-only 运行分组
- 区分“disabled 但结构有效”和“non-runnable schema placeholder”

**步骤 4：运行测试，确认通过**

运行：`bun test src/config/load.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add config/sources.example.yaml config/packs README.md docs/plans/2026-03-10-source-type-roadmap-design.md src/config/load.test.ts
git commit -m "refactor: normalize reference source config taxonomy"
```

### 后续优先项（2026-03-11 更新）：确定性 relation enrichment

在 source taxonomy、query runner、X ingestion 都已落地后，下一条优先链路不再是扩 source type，而是提升复杂源质量。

当前优先切片：

- 消费已有 `canonicalHints`
- 显式标注 `original` / `discussion` / `share`
- 让 ranking 与 X views 优先表达 linked article
- 保持无额外网络请求、可 fixture-first 测试

### 任务 2：冻结 canonical source type taxonomy

**文件：**
- 修改：`src/types/index.ts`
- 修改：`src/config/validate.ts`
- 测试：`src/config/load.test.ts`
- 测试：`src/config/resolve-profile.test.ts`

**步骤 1：先写失败测试**

增加断言，明确 canonical type 只包含：
- `rss`
- `json-feed`
- `website`
- `hn`
- `reddit`
- `opml_rss`
- `digest_feed`
- `custom_api`
- `github_trending`
- `x_home`
- `x_list`
- `x_bookmarks`
- `x_likes`
- `x_multi`

**步骤 2：运行测试，确认它失败**

运行：`bun test src/config/load.test.ts src/config/resolve-profile.test.ts`
预期：FAIL，因为类型约定尚未完全收紧。

**步骤 3：写最小实现**

- 在类型定义和校验逻辑中显式表达 canonical taxonomy
- 移除内部对 `twitter_*` 的依赖

**步骤 4：运行测试，确认通过**

运行：`bun test src/config/load.test.ts src/config/resolve-profile.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/types/index.ts src/config/validate.ts src/config/load.test.ts src/config/resolve-profile.test.ts
git commit -m "refactor: freeze canonical source taxonomy"
```

### 任务 3：增加 source-type-specific config schema 校验

**文件：**
- 修改：`src/config/validate.ts`
- 修改：`src/config/load.ts`
- 新建：`src/config/validate-source-type.test.ts`
- 测试：`src/config/load.test.ts`

**步骤 1：先写失败测试**

增加这些校验场景：
- `opml_rss` 要求 `config.path`
- `custom_api` 要求 `itemPath` 和 field mapping
- `digest_feed` 要求格式或 link hint
- `github_trending` 允许轻量可选 config
- `x_*` 要求 `birdMode` 或等价字段

**步骤 2：运行测试，确认它失败**

运行：`bun test src/config/load.test.ts src/config/validate-source-type.test.ts`
预期：FAIL，因为当前没有 type-specific schema。

**步骤 3：写最小实现**

- 增加按 source type 分支的 schema 校验
- 对 roadmap placeholder 和 runnable source 分别给出明确错误信息

**步骤 4：运行测试，确认通过**

运行：`bun test src/config/load.test.ts src/config/validate-source-type.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/config/validate.ts src/config/load.ts src/config/validate-source-type.test.ts
git commit -m "feat: add source-type specific config validation"
```

### 任务 4：统一 collector metadata contract

**文件：**
- 修改：`src/types/index.ts`
- 修改：`src/pipeline/collect.ts`
- 修改：`src/adapters/rss.ts`
- 修改：`src/adapters/json-feed.ts`
- 修改：`src/adapters/website.ts`
- 修改：`src/adapters/hn.ts`
- 修改：`src/adapters/reddit.ts`
- 测试：`src/pipeline/collect.test.ts`
- 测试：`src/adapters/rss.test.ts`
- 测试：`src/adapters/json-feed.test.ts`
- 测试：`src/adapters/hn.test.ts`
- 测试：`src/adapters/reddit.test.ts`

**步骤 1：先写失败测试**

增加断言，要求 `RawItem.metadataJson` 至少稳定包含：
- `provider`
- `sourceType`
- `contentType`
- 必要时的 `engagement` / `canonicalHints`

**步骤 2：运行测试，确认它失败**

运行：`bun test src/pipeline/collect.test.ts src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/adapters/hn.test.ts src/adapters/reddit.test.ts`
预期：FAIL，因为当前 metadata 结构并不完全统一。

**步骤 3：写最小实现**

- 定义最小 metadata contract
- 让现有 adapter 都输出统一基底字段

**步骤 4：运行测试，确认通过**

运行：`bun test src/pipeline/collect.test.ts src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/adapters/hn.test.ts src/adapters/reddit.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/types/index.ts src/pipeline/collect.ts src/adapters/rss.ts src/adapters/json-feed.ts src/adapters/website.ts src/adapters/hn.ts src/adapters/reddit.ts src/pipeline/collect.test.ts src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/adapters/hn.test.ts src/adapters/reddit.test.ts
git commit -m "refactor: normalize collector metadata contract"
```

### 任务 5：完成 Phase 1 的 `hn` / `reddit` 规则

**文件：**
- 修改：`src/pipeline/normalize-url.ts`
- 修改：`src/pipeline/dedupe-exact.ts`
- 修改：`src/pipeline/rank.ts`
- 测试：`src/pipeline/dedupe-exact.test.ts`
- 测试：`src/pipeline/rank.test.ts`
- 测试：`src/e2e/post-mvp-mock-sources.test.ts`

**步骤 1：先写失败测试**

增加测试，证明：
- `hn` / `reddit` 优先使用外链 canonical URL
- 讨论页不会默认压过原文
- engagement 只做有界加权

**步骤 2：运行测试，确认它失败**

运行：`bun test src/pipeline/dedupe-exact.test.ts src/pipeline/rank.test.ts src/e2e/post-mvp-mock-sources.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 增加 community source 的 canonicalization
- 增加有界 engagement score

**步骤 4：运行测试，确认通过**

运行：`bun test src/pipeline/dedupe-exact.test.ts src/pipeline/rank.test.ts src/e2e/post-mvp-mock-sources.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/pipeline/normalize-url.ts src/pipeline/dedupe-exact.ts src/pipeline/rank.ts src/pipeline/dedupe-exact.test.ts src/pipeline/rank.test.ts src/e2e/post-mvp-mock-sources.test.ts
git commit -m "feat: add community source dedupe and ranking rules"
```

### 任务 6：实现 `opml_rss`

**文件：**
- 新建：`src/adapters/opml-rss.ts`
- 修改：`src/cli/run-scan.ts`
- 修改：`src/cli/run-digest.ts`
- 修改：`src/pipeline/collect.ts`
- 测试：`src/adapters/opml-rss.test.ts`
- 测试：`src/pipeline/collect.test.ts`

**步骤 1：先写失败测试**

增加 fixture 测试，覆盖：
- OPML 文件读取
- feed URL 提取
- feed 收集
- source health 记录

**步骤 2：运行测试，确认它失败**

运行：`bun test src/adapters/opml-rss.test.ts src/pipeline/collect.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 从本地 path 解析 OPML
- 使用既有 RSS 解析逻辑复用 feed 抓取

**步骤 4：运行测试，确认通过**

运行：`bun test src/adapters/opml-rss.test.ts src/pipeline/collect.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/adapters/opml-rss.ts src/adapters/opml-rss.test.ts src/cli/run-scan.ts src/cli/run-digest.ts src/pipeline/collect.ts src/pipeline/collect.test.ts
git commit -m "feat: add opml rss source support"
```

### 任务 7：实现 `digest_feed`

**文件：**
- 新建：`src/adapters/digest-feed.ts`
- 修改：`src/pipeline/normalize-url.ts`
- 修改：`src/pipeline/dedupe-exact.ts`
- 修改：`src/cli/run-scan.ts`
- 修改：`src/cli/run-digest.ts`
- 测试：`src/adapters/digest-feed.test.ts`
- 测试：`src/pipeline/dedupe-exact.test.ts`

**步骤 1：先写失败测试**

增加测试，证明：
- digest item 可解析
- linked canonical URL 被保留
- digest item 与原文可去重

**步骤 2：运行测试，确认它失败**

运行：`bun test src/adapters/digest-feed.test.ts src/pipeline/dedupe-exact.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 增加 digest feed parser
- 输出 canonical-link hint
- 在 dedupe 中优先使用 linked article

**步骤 4：运行测试，确认通过**

运行：`bun test src/adapters/digest-feed.test.ts src/pipeline/dedupe-exact.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/adapters/digest-feed.ts src/adapters/digest-feed.test.ts src/pipeline/normalize-url.ts src/pipeline/dedupe-exact.ts src/cli/run-scan.ts src/cli/run-digest.ts
git commit -m "feat: add digest feed source support"
```

### 任务 8：实现受限的 `custom_api`

**文件：**
- 新建：`src/adapters/custom-api.ts`
- 修改：`src/config/validate.ts`
- 修改：`src/cli/run-scan.ts`
- 修改：`src/cli/run-digest.ts`
- 测试：`src/adapters/custom-api.test.ts`
- 测试：`src/config/validate-source-type.test.ts`

**步骤 1：先写失败测试**

增加测试，覆盖：
- fixture JSON 按 mapping 转成 `RawItem`
- 无效 mapping 被拒绝

**步骤 2：运行测试，确认它失败**

运行：`bun test src/adapters/custom-api.test.ts src/config/validate-source-type.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 增加受限 field mapping
- 拒绝过于泛化的 ETL 式配置

**步骤 4：运行测试，确认通过**

运行：`bun test src/adapters/custom-api.test.ts src/config/validate-source-type.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/adapters/custom-api.ts src/adapters/custom-api.test.ts src/config/validate.ts src/cli/run-scan.ts src/cli/run-digest.ts
git commit -m "feat: add custom api source support"
```

### 任务 9：实现 `github_trending`

**文件：**
- 新建：`src/adapters/github-trending.ts`
- 修改：`src/cli/run-scan.ts`
- 修改：`src/cli/run-digest.ts`
- 测试：`src/adapters/github-trending.test.ts`

**步骤 1：先写失败测试**

增加 fixture 测试，覆盖：
- repo URL
- repo name
- description
- language

**步骤 2：运行测试，确认它失败**

运行：`bun test src/adapters/github-trending.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 先做 fixture-first parser
- config 仅允许 `language` 和 `since` 这类有限字段

**步骤 4：运行测试，确认通过**

运行：`bun test src/adapters/github-trending.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/adapters/github-trending.ts src/adapters/github-trending.test.ts src/cli/run-scan.ts src/cli/run-digest.ts
git commit -m "feat: add github trending source support"
```

### 任务 10：实现 X family 的 `bird CLI` 接入

**文件：**
- 新建：`src/adapters/x-bird.ts`
- 修改：`src/config/validate.ts`
- 修改：`src/cli/run-scan.ts`
- 修改：`src/cli/run-digest.ts`
- 测试：`src/adapters/x-bird.test.ts`
- 测试：`src/config/validate-source-type.test.ts`
- 修改：`docs/testing.md`

**步骤 1：先写失败测试**

增加测试，证明：
- `x_bookmarks`
- `x_likes`
- `x_multi`
- `x_list`
- `x_home`

都能正确映射到 `bird CLI` 参数，并把 fixture 输出转成 `RawItem`。

**步骤 2：运行测试，确认它失败**

运行：`bun test src/adapters/x-bird.test.ts src/config/validate-source-type.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 加入统一的 X adapter family
- 只做 ingestion
- 不在此阶段加入 thread / article / deep extraction

**步骤 4：运行测试，确认通过**

运行：`bun test src/adapters/x-bird.test.ts src/config/validate-source-type.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/adapters/x-bird.ts src/adapters/x-bird.test.ts src/config/validate.ts src/cli/run-scan.ts src/cli/run-digest.ts docs/testing.md
git commit -m "feat: add bird cli x source support"
```

### 任务 11：增加 X 专用规范化与去重

**文件：**
- 修改：`src/pipeline/normalize-url.ts`
- 修改：`src/pipeline/normalize.ts`
- 修改：`src/pipeline/dedupe-exact.ts`
- 测试：`src/pipeline/normalize-url.test.ts`
- 测试：`src/pipeline/normalize.test.ts`
- 测试：`src/pipeline/dedupe-exact.test.ts`

**步骤 1：先写失败测试**

增加测试，覆盖：
- tweet URL 规范化
- expanded URL canonical hint
- quote / thread / linked article 的分层 dedupe

**步骤 2：运行测试，确认它失败**

运行：`bun test src/pipeline/normalize-url.test.ts src/pipeline/normalize.test.ts src/pipeline/dedupe-exact.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 增加 X source 的 normalize 规则
- 增加 metadata-aware dedupe

**步骤 4：运行测试，确认通过**

运行：`bun test src/pipeline/normalize-url.test.ts src/pipeline/normalize.test.ts src/pipeline/dedupe-exact.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/pipeline/normalize-url.ts src/pipeline/normalize.ts src/pipeline/dedupe-exact.ts src/pipeline/normalize-url.test.ts src/pipeline/normalize.test.ts src/pipeline/dedupe-exact.test.ts
git commit -m "feat: add x normalization and dedupe rules"
```

### 任务 12：引入 enrichment 边界并复用 `smaug` / `x-ai-topic-selector` 思路

**文件：**
- 新建：`src/pipeline/enrich.ts`
- 新建：`src/pipeline/enrich.test.ts`
- 修改：`src/cli/run-digest.ts`
- 修改：`src/cli/run-scan.ts`
- 修改：`src/pipeline/rank.ts`
- 修改：`src/render/digest.ts`

**步骤 1：先写失败测试**

增加测试，证明：
- enrichment 只发生在 candidate reduction 之后
- X 外链展开、GitHub repo 提取、X 长文提取可以作为后置增强
- ranking hook 可以有界吸收 `x-ai-topic-selector` 风格信号

**步骤 2：运行测试，确认它失败**

运行：`bun test src/pipeline/enrich.test.ts src/pipeline/rank.test.ts src/render/digest.test.ts`
预期：FAIL

**步骤 3：写最小实现**

- 增加 enrichment pipeline boundary
- 复用 `smaug` 的 extraction 思路
- 复用 `x-ai-topic-selector` 的 ranking/report 思路

**步骤 4：运行测试，确认通过**

运行：`bun test src/pipeline/enrich.test.ts src/pipeline/rank.test.ts src/render/digest.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/pipeline/enrich.ts src/pipeline/enrich.test.ts src/cli/run-digest.ts src/cli/run-scan.ts src/pipeline/rank.ts src/render/digest.ts
git commit -m "feat: add enrichment pipeline and x quality hooks"
```

### 任务 13：文档与验证流程对齐

**文件：**
- 修改：`README.md`
- 修改：`docs/testing.md`
- 修改：`docs/plans/2026-03-10-source-type-roadmap-design.md`
- 修改：`docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md`
- 测试：`src/config/load.test.ts`

**步骤 1：先写失败测试**

增加或更新测试，要求：
- config 中的 canonical taxonomy 与文档一致
- reference-only pack 与 runnable pack 的边界在文档中可见
- placeholder 的结构有效性和可运行性被分开描述

**步骤 2：运行测试，确认它失败**

运行：`bun test src/config/load.test.ts`
预期：FAIL，因为文档和配置边界还会继续演进。

**步骤 3：写最小实现**

- 每完成一个 phase，就同步 README / testing / plans
- 保持“当前支持”和“路线图 placeholder”两层说明

**步骤 4：运行测试，确认通过**

运行：`bun test src/config/load.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add README.md docs/testing.md docs/plans/2026-03-10-source-type-roadmap-design.md docs/plans/2026-03-10-source-type-roadmap-implementation-plan.md src/config/load.test.ts
git commit -m "docs: align source roadmap and config guidance"
```
