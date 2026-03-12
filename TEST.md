# 测试指南

## 核心原则

- **测试先行**：新功能先写测试，80%+ 覆盖率
- **确定性优先**：Pipeline 必须可复现，真实网络探测仅作为补充验证

## 成功指标

- `bun test` 全部通过
- `bun run smoke` 无错误
- `bun run e2e` 输出符合预期
- 无遗漏的"已支持但未文档化"能力

## 最快的日常检查

开发过程中优先使用：

```bash
bun run smoke
```

它会执行当前推荐的验证链：

```bash
bun test
bun run check
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts run --view item-list
bun scripts/aggregator.ts run --view daily-brief
bun scripts/aggregator.ts run --view item-list --format json
bun scripts/aggregator.ts sources list
```

## 验证策略

默认顺序：

1. `bun test`
2. `bun run smoke`
3. `bun run e2e`
4. clean-clone 安装验证
5. `bun run e2e:real`

解释：

- `smoke` 是开发期最快的回归检查
- `e2e` 是稳定的 fetch-to-output 本地基线
- `e2e:real` 不应作为 CI gate，因为它受上游和网络波动影响

## 人工验收清单

- `bun run smoke` 无需手工修复即可通过
- `bun scripts/aggregator.ts --help` 展示 `run --view <view>`、`sources list`、`config validate`
- `bun scripts/aggregator.ts config validate` 能通过示例配置
- `bun scripts/aggregator.ts run --view daily-brief` 能输出 Markdown
- `bun scripts/aggregator.ts run --view x-analysis` 能输出完整分析格式（含 AI 评分、摘要、统计、选题建议）
- `bun scripts/aggregator.ts run --view daily-brief --format json` 能输出结构化 JSON
- `bun scripts/aggregator.ts sources list` 能输出 `sourceId<TAB>sourceType<TAB>sourceName`
- 示例配置文件与文档保持一致且可读

## 端到端测试规则

### 新增或修改 source/runtime 行为时

- 先补本地 mock-source E2E 测试
- 优先使用本地 HTTP test server，而不是脆弱的网络 mock
- 断言最终 Markdown 输出，而不只检查中间结构
- 真实网络 probe 只能作为补充验证，不能是唯一验证
- X family source 要优先做 `bird CLI` 参数映射和 fixture 输出测试，再做手动 probe

### 修改打包或安装行为时

- 从 clean clone 验证仓库

## 端到端检查

稳定的本地 E2E 基线：

```bash
bun run e2e
```

这个命令不会依赖外部服务，而是通过本地 mock HTTP sources 验证从 fetch 到 render 的完整流程。

可选的真实网络探测：

```bash
bun run e2e:real
```

它会访问当前公开可用的数据源，确认运行时仍能与真实 source 协同工作。
它不应该作为稳定 CI gate，因为上游可用性会变化。

## 安装验证

发布前建议用一个干净目录做外部用户视角验证：

```bash
git clone <repo-url> information-aggregator-test
cd information-aggregator-test
bun install
bun run smoke
```

这通常足以覆盖本地使用与交付前检查。

## source type 相关补充

当你新增或修改 source type 时：

- 先补 fixture-first adapter tests
- 再补 config validation tests
- 再补 mock-source E2E
- 最后才考虑真实网络 probe

对于不稳定或尚未正式支持的 source type，例如：

- `custom_api`
- `opml_rss`

默认应以 fixture / reference source / 手动 probe 为主，不应直接进入稳定 CI。

其中 X family 额外要求：

- 先验证 `bird CLI` 参数映射
- 再验证 fixture 输出到 `RawItem` 的转换
- 最后才做手动 `bird CLI` 探测
- 建议顺序：

```bash
bird check
bird whoami
bird --chrome-profile "Default" home --json
```

- 如果 `bird 0.8.x` 使用 Chrome cookie，优先配置：
  - `chromeProfile`
  - `chromeProfileDir`
  - `cookieSource`
- 如果直接注入 cookie，则使用：
  - `authToken` / `ct0`
  - 或 `authTokenEnv` / `ct0Env`

当前匿名 public probe 可覆盖：

- `rss`
- `json-feed`
- `github_trending`

当前仍建议保留为手动或本地依赖验证的类型：

- `custom_api`
- `opml_rss`
- X family 全部类型

## source 有效性审计

当你调整示例配置里的 source taxonomy、pack 归类或启用状态时，先做一次匿名可达性审计，再决定它属于 runnable public source 还是本地扩展 source：

- 使用 `curl -L --max-time 15 --connect-timeout 10` 做匿名探测
- 返回非错误响应且内容语义仍是目标 source 时，才可视为 public runnable 候选
- 如果跳转到登录页、权限页或依赖会话态，只能归为 auth-required reference source
- `example.com`、空 `url`、`config.placeholderMode: schema` 这类条目只能归为 source 级 placeholder，不应当作 live source，也不应进入默认 pack
- `e2e:real` 只验证当前公开源，不要求 auth-required reference source 在匿名探测下可运行
