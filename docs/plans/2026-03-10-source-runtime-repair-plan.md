# Source Runtime Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复当前各类 source 在真实运行时的契约偏差与 X family 的 `bird` 集成问题，让可支持的 source 能稳定跑通 `scan` / `digest`，并把暂不支持的边界写清楚。

**Architecture:** 这次修复分成两条线。第一条线修正 adapter 与真实上游 payload 的契约，让 `hn`、`reddit`、`digest_feed` 等 source 能在当前参考源上返回有效 `RawItem`。第二条线重做 X family 的 `bird CLI` 映射与认证配置注入，统一通过 `bird 0.8.0` 已支持的命令和 JSON 输出路径接入，再用 mock CLI 与手动 probe 双层验证。

**Tech Stack:** Bun、TypeScript、现有 adapter/CLI/pipeline 测试、Bun test、本地 HTTP server、`bird 0.8.0`

---

### Task 1: 固化当前失败面，先写回归测试

**Files:**
- Modify: `src/adapters/hn.test.ts`
- Modify: `src/adapters/reddit.test.ts`
- Modify: `src/adapters/digest-feed.test.ts`
- Modify: `src/adapters/x-bird.test.ts`
- Create: `src/e2e/source-runtime-repair.test.ts`

**Step 1: 为 `hn` 写真实 payload 形状失败测试**

在 `src/adapters/hn.test.ts` 增加一例，输入形如 Algolia `search?tags=front_page` 的对象 payload，断言能从 `hits` 中提取条目，而不是要求根节点是数组。

**Step 2: 为 `reddit` 写 Reddit Listing 兼容测试**

在 `src/adapters/reddit.test.ts` 增加一例，覆盖真实返回中的 `kind: "Listing"` 与 `data.children[].data` 结构，并断言外链优先级、discussion url 和 `subreddit` 元数据都保留。

**Step 3: 为 `digest_feed` 写 JSON digest feed 失败测试**

在 `src/adapters/digest-feed.test.ts` 增加一例，输入当前 `clawfeed` 一类 JSON payload，先让测试失败，再明确预期是“支持 JSON digest”还是“拒绝并抛清晰错误”。

**Step 4: 为 X family 写 `bird 0.8.0` 命令映射测试**

在 `src/adapters/x-bird.test.ts` 增加断言：
- `x_home` -> `bird home --json`
- `x_bookmarks` -> `bird bookmarks --json`
- `x_likes` -> `bird likes --json`
- `x_list` -> `bird list-timeline <list-id> --json`
- `x_multi` 不再映射到不存在的 `bird multi`

**Step 5: 为全链路写 source runtime repair E2E**

在 `src/e2e/source-runtime-repair.test.ts` 用本地 HTTP server 与 fake `bird` CLI 组出：
- `hn`
- `reddit`
- `github_trending`
- `digest_feed`
- `custom_api`
- `opml_rss`
- `x_home`
- `x_bookmarks`
- `x_likes`
- `x_list`

断言它们能共同跑过 `runScan` 与 `runDigest`，并输出 Markdown。

**Step 6: 跑新增测试确认先失败**

Run:

```bash
bun test src/adapters/hn.test.ts src/adapters/reddit.test.ts src/adapters/digest-feed.test.ts src/adapters/x-bird.test.ts src/e2e/source-runtime-repair.test.ts
```

Expected: 至少出现当前已知失败，证明测试能卡住问题。

**Step 7: Commit**

```bash
git add src/adapters/hn.test.ts src/adapters/reddit.test.ts src/adapters/digest-feed.test.ts src/adapters/x-bird.test.ts src/e2e/source-runtime-repair.test.ts
git commit -m "test: lock source runtime regressions"
```

### Task 2: 修复 `hn` 与 `reddit` 真实 payload 兼容

**Files:**
- Modify: `src/adapters/hn.ts`
- Modify: `src/adapters/reddit.ts`
- Test: `src/adapters/hn.test.ts`
- Test: `src/adapters/reddit.test.ts`

**Step 1: 最小化修改 `hn` 解析入口**

让 `collectHnSource` 同时接受：
- 旧的数组 payload
- Algolia 风格对象 payload，优先读取 `hits`

保留 `parseHnItems` 的 `RawItem` 输出格式不变。

**Step 2: 给 `hn` 增加更清晰错误**

当 payload 既不是数组也没有 `hits` 数组时，抛出带 payload 类型信息的错误，便于排障。

**Step 3: 最小化修改 `reddit` 获取逻辑**

为 `collectRedditSource` 添加更稳的请求处理：
- 检查 HTTP status
- 在 JSON parse 失败时附带响应片段
- 保持 `parseRedditListing` 逻辑与元数据输出不变

**Step 4: 跑 adapter tests**

Run:

```bash
bun test src/adapters/hn.test.ts src/adapters/reddit.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/hn.ts src/adapters/reddit.ts src/adapters/hn.test.ts src/adapters/reddit.test.ts
git commit -m "fix: support real hn and reddit payloads"
```

### Task 3: 处理 `digest_feed` 真实参考源契约

**Files:**
- Modify: `src/adapters/digest-feed.ts`
- Modify: `src/config/validate.ts`
- Modify: `src/config/validate-source-type.test.ts`
- Modify: `config/sources.example.yaml`
- Test: `src/adapters/digest-feed.test.ts`

**Step 1: 先定策略，只选一种**

二选一，禁止半支持：
- 如果要支持当前参考源，给 `digest_feed` 增加 JSON digest 解析分支
- 如果不打算支持当前 JSON source，把参考源改成真正的 RSS/XML digest，或把它明确标成 placeholder/reference，不再暗示 runnable

**Step 2: 实现最小代码或最小配置修正**

优先选 YAGNI 路线：
- 如果只有一个公开 JSON digest 参考源，直接支持其稳定字段形状
- 如果字段形状明显私有且不稳定，则收缩配置与文档边界，不在代码里做脆弱兼容

**Step 3: 更新 source type 校验**

保证 `digest_feed` 的配置要求与实现一致，不出现“配置允许但运行必挂”的情况。

**Step 4: 跑 digest-feed 相关测试**

Run:

```bash
bun test src/adapters/digest-feed.test.ts src/config/validate-source-type.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/digest-feed.ts src/config/validate.ts src/config/validate-source-type.test.ts config/sources.example.yaml src/adapters/digest-feed.test.ts
git commit -m "fix: align digest feed runtime with supported sources"
```

### Task 4: 重做 X family 的 `bird` 命令映射

**Files:**
- Modify: `src/adapters/x-bird.ts`
- Modify: `src/types/index.ts`
- Modify: `src/config/validate.ts`
- Modify: `src/adapters/x-bird.test.ts`

**Step 1: 改成 `bird 0.8.0` 实际支持的命令**

在 `src/adapters/x-bird.ts` 中使用：
- `home --json`
- `bookmarks --json`
- `likes --json`
- `list-timeline <listId> --json`

不要再生成不存在的 `bird list`、`bird multi`。

**Step 2: 明确 `x_multi` 的实现方式**

只保留一种实现：
- 方案 A：在 adapter 内对 `listIds` 逐个执行 `bird list-timeline --json`，合并结果
- 方案 B：如果当前版本不准备支持，就把 `x_multi` 从 runnable taxonomy 收回 reference-only，并在验证与文档中写明

**Step 3: 统一要求 JSON 输出**

所有 `bird` 读取命令必须追加 `--json`，否则当前 `parseBirdItems` 无法解析纯文本输出。

**Step 4: 保留错误上下文**

当 `bird` 退出非 0 时，把命令和 stderr 一并带进错误信息，便于区分认证失败、命令不存在、输出非 JSON。

**Step 5: 跑 X adapter tests**

Run:

```bash
bun test src/adapters/x-bird.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/adapters/x-bird.ts src/types/index.ts src/config/validate.ts src/adapters/x-bird.test.ts
git commit -m "fix: align x adapters with bird 0.8"
```

### Task 5: 接入 `bird` 认证配置与手动 probe

**Files:**
- Modify: `src/adapters/x-bird.ts`
- Modify: `config/sources.example.yaml`
- Modify: `README.md`
- Modify: `docs/testing.md`

**Step 1: 在 source config 中声明 `bird` 认证来源**

给 X family source 增加明确可用的配置约定，至少覆盖：
- `birdMode`
- `chromeProfile`
- `chromeProfileDir`
- `cookieSource`
- 可选的 `authTokenEnv`
- 可选的 `ct0Env`

其中 cookie 与显式 token 只能选一种优先级策略，并写死在实现里。

**Step 2: 在 adapter 中实现认证参数注入**

构造命令时按固定优先级拼接：
1. 显式 token/env
2. `chromeProfile` / `chromeProfileDir`
3. `cookieSource`

确保不会把认证细节散落到 CLI 调用点。

**Step 3: 加一个最小手动 probe 命令**

在文档里规定先跑：

```bash
bird check
bird whoami
bird --chrome-profile "Default" home --json
```

只有这三个都成功，才继续跑 repo 内 `scan` / `digest`。

**Step 4: 跑 X family 手动验证**

Run:

```bash
bird check
bird whoami
bird --chrome-profile "Default" home --json
```

Expected: 能拿到已登录账号信息与 JSON timeline

**Step 5: Commit**

```bash
git add src/adapters/x-bird.ts config/sources.example.yaml README.md docs/testing.md
git commit -m "docs: document bird auth configuration"
```

### Task 6: 统一 E2E、真实 probe 与文档

**Files:**
- Modify: `src/verification/real-probe.ts`
- Modify: `scripts/e2e-real.ts`
- Modify: `README.md`
- Modify: `docs/testing.md`
- Modify: `docs/plans/2026-03-10-source-type-roadmap-design.md`

**Step 1: 划清 stable E2E 与 manual probe**

把 source 分类写清楚：
- 稳定 mock E2E 覆盖的类型
- 可匿名 public probe 的类型
- 需要 auth/local dependency 的类型

**Step 2: 更新 real probe 范围**

只把真正匿名可跑的 source 放进 `e2e:real`，不要把 auth-required 或契约未稳的 reference source 混进去。

**Step 3: 同步 README 与 testing 文档**

保证文档不再暗示“所有 reference source 都可直接跑通”。

**Step 4: 跑完整验证链**

Run:

```bash
bun test
bun run e2e
bun run smoke
bun run e2e:real
```

Expected:
- `bun test` 全绿
- `bun run e2e` 全绿
- `bun run smoke` 全绿
- `bun run e2e:real` 只验证当前文档承诺的 public runnable source，并通过

**Step 5: Commit**

```bash
git add src/verification/real-probe.ts scripts/e2e-real.ts README.md docs/testing.md docs/plans/2026-03-10-source-type-roadmap-design.md
git commit -m "docs: align runtime verification with supported sources"
```
