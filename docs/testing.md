# 测试指南

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
bun scripts/aggregator.ts scan
bun scripts/aggregator.ts digest
```

## 人工验收清单

- `bun run smoke` 无需手工修复即可通过
- `bun scripts/aggregator.ts --help` 展示 `scan`、`digest`、`config validate`
- `bun scripts/aggregator.ts config validate` 能通过示例配置
- `bun scripts/aggregator.ts scan` 能输出 Markdown
- `bun scripts/aggregator.ts digest` 能输出 Markdown
- 示例配置文件与文档保持一致且可读

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

## 当前最佳实践

推荐验证顺序：

1. 先跑变更模块对应的 unit / integration tests
2. 再跑 `bun run e2e`
3. 再跑 `bun run smoke`
4. 需要交付或发布时，再做 clean-clone 安装验证
5. `bun run e2e:real` 仅作为手动公共网络探测
6. 只有在 skill 打包或分发路径变更时才做 installation 验证

## source type 相关补充

当你新增或修改 source type 时：

- 先补 fixture-first adapter tests
- 再补 config validation tests
- 再补 mock-source E2E
- 最后才考虑真实网络 probe

对于不稳定或尚未正式支持的 source type，例如：

- `github_trending`
- `digest_feed`
- `custom_api`
- `x_bookmarks`
- `x_likes`
- `x_multi`
- `x_list`
- `x_home`
- `opml_rss`

默认应以 fixture / reference source / 手动 probe 为主，不应直接进入稳定 CI。

其中 X family 额外要求：

- 先验证 `bird CLI` 参数映射
- 再验证 fixture 输出到 `RawItem` 的转换
- 最后才做手动 `bird CLI` 探测
