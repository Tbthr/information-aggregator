# 测试指南

## 验证命令

| 命令 | 用途 | 网络依赖 |
|------|------|----------|
| `bun test` | 单元测试 | 无 |
| `bun run check` | TypeScript 类型检查 | 无 |
| `bun run smoke` | 本地验证（组合命令） | 无 |
| `bun run e2e:real` | 真实数据流验证 | 需要网络 |

## smoke 包含的检查

`bun run smoke` 依次执行：

```bash
bun test                              # 单元测试
bun run check                         # 类型检查
bun src/cli/main.ts --help            # CLI 可用性
bun src/cli/main.ts config validate   # 配置校验
```

任何一步失败都会中断。

## e2e:real 验证

`bun run e2e:real` 使用 `test_daily` 和 `test_x_analysis` pack 进行真实数据流验证：

- 访问实际数据源（需要网络）
- 输出到 `out/e2e-daily-brief.md` 和 `out/e2e-x-analysis.md`
- 可选使用 AI 增强（需配置 `ANTHROPIC_AUTH_TOKEN` 或 `GEMINI_API_KEY`）

**注意**：e2e:real 受上游和网络波动影响，不应作为 CI gate。

## 开发流程建议

1. 开发中：频繁运行 `bun run smoke`
2. 提交前：确保 `bun run smoke` 通过
3. 发布前：运行 `bun run e2e:real` 确认真实数据流

## 新增 source type 时

1. 先写 fixture-based adapter 测试
2. 再写 config validation 测试
3. 在 `config/packs/test_daily.yaml` 中添加测试用例
4. 真实网络探测仅作为补充验证
