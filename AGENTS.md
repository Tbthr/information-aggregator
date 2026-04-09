# Information Aggregator

## Build And Test

```bash
bun install           # 安装依赖
bun run typecheck     # TypeScript 类型检查
bun test              # 运行所有测试
```

运行 CLI（需先加载 `.env.local`）：
```bash
bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts'
bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts -t 1h'  # 快速测试
```

## Architecture Boundaries

- **src/pipeline/** — 数据收集管道（collect、normalize、dedupe、enrich）
- **src/adapters/** — 数据源适配器（RSS、JSON Feed、X/Twitter）
- **src/ai/** — AI 客户端和报表生成 prompts
- **src/reports/** — 日报生成
- **src/archive/** — 存档接口和 JSON 存储
- **lib/** — 工具函数

## Coding Conventions

- 数据收集以北京时间（UTC+8）界定"某一天"
- 使用 `formatBeijingDate()` 获取当前北京时间日期字符串，禁止直接使用 `toISOString().split('T')[0]`
- CLI 使用结构化 JSON 日志输出到 stdout
- 所有代码必须通过 TypeScript 检查

## Safety Rails

### Git 安全
- **禁止**执行 `git reset --hard`，除非用户明确要求且已确认分支状态

### 时间处理
- 获取北京时间日期：**必须用 `formatBeijingDate(new Date())`**，不能用 `new Date().toISOString()`
- 工具函数见 `lib/date-utils.ts`

## NEVER

- 修改 `.env`、lockfiles、CI secrets
- 在 Pipeline 中引入新的全局状态
- Commit 前不运行 `bun run typecheck` 和 `bun test`

## Verification

```bash
bun run typecheck && bun test                    # 全部通过
bash -c 'set -a; source .env.local; exec bun run src/cli/run.ts -t 1h'  # CLI 正常运行，无任何报错
```

## Compact Instructions

保留：
1. Architecture 决策和模块边界
2. 修改的文件和关键变更
3. 当前验证状态（通过/失败命令）
4. 开放风险、TODO、回滚注意事项
