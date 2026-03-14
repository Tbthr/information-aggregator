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

## API 验证

启动 API 服务并验证端点：

```bash
# 启动 API 服务器
bun src/cli/main.ts serve --port 3000

# 另开终端，验证 API
curl "http://localhost:3000/api/items?window=24h&pageSize=5" | jq '.data.items[0].score'
# 期望：返回动态计算的分数（非固定值）

curl "http://localhost:3000/api/packs?includeStats=true" | jq '.data.packs[0].id'
# 期望：返回 Pack 列表
```

**分数计算验证**：

```bash
# 验证分数是动态计算的（应返回不同的值，如 5.9, 6.0, 5.2 等）
curl "http://localhost:3000/api/items?window=all&pageSize=5" | jq '.data.items[].score'
```

## 前端验证

1. 启动 API 服务和前端开发服务器：

```bash
# 终端 1：启动 API
bun src/cli/main.ts serve

# 终端 2：启动前端
cd frontend && bun dev
```

2. 打开 http://localhost:5173

3. 验证功能：
   - [ ] Pack 选择器：点击 Pack 可过滤内容
   - [ ] 时间窗口：切换窗口触发重新加载
   - [ ] 排序：切换排序方式生效
   - [ ] 搜索：输入关键词触发搜索（300ms 防抖）
   - [ ] 分页：翻页功能正常
   - [ ] 分数显示：显示动态计算值（非固定 5）

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
