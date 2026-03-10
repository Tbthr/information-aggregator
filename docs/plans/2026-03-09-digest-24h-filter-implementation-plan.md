# Digest 24 小时过滤实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 让 `digest` 输出只覆盖最近 24 小时内容，优先使用发布时间，缺失时回退到抓取时间。

**架构：** 保持时间提取留在各 adapter 内部，只在 `runDigest` 中加入统一的时间窗口过滤。这样能把行为变化限定在 digest 模式，不影响 scan。

**技术栈：** Bun、TypeScript、bun:test

---

### 任务 1：先补失败测试

**文件：**
- 修改：`src/adapters/rss.test.ts`
- 修改：`src/adapters/json-feed.test.ts`
- 修改：`src/cli/run-digest.test.ts`

**步骤 1：先写失败测试**

- 为 RSS 增加 `pubDate` 与 Atom `published` 测试
- 为 JSON Feed 增加 `date_published` 测试
- 为 digest 增加 24 小时过滤与回退逻辑测试

**步骤 2：运行测试，确认它失败**

运行：`bun test src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/cli/run-digest.test.ts`
预期：FAIL，因为当前 digest 尚未按 24 小时窗口过滤，RSS 也未完整解析 Atom `published`

### 任务 2：写最小实现

**文件：**
- 修改：`src/adapters/rss.ts`
- 修改：`src/cli/run-digest.ts`

**步骤 1：实现最小改动**

- 扩展 RSS 解析，支持 Atom `published`
- 在 `runDigest.ts` 中加入 24 小时过滤 helper：
  - cutoff = `now() - 24h`
  - 优先使用 `publishedAt`
  - 缺失时回退到 `fetchedAt`
  - 丢弃无效时间或超窗条目

**步骤 2：运行测试，确认通过**

运行：`bun test src/adapters/rss.test.ts src/adapters/json-feed.test.ts src/cli/run-digest.test.ts`
预期：PASS

### 任务 3：做回归验证

**文件：**
- 无新增代码

**步骤 1：跑聚焦测试**

运行：`bun test src/cli/run-digest.test.ts src/adapters/rss.test.ts src/adapters/json-feed.test.ts`
预期：PASS

**步骤 2：跑 smoke**

运行：`bun run smoke`
预期：PASS
