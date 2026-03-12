# AGENTS.md

> CLAUDE.md 是指向此文件的软链接，两者内容相同。
> .claude/CLAUDE.md 是指向此文件的软链接，两者内容相同。

## 项目概览
`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 CLI 输出 Markdown 或 JSON 结果。

## 模块职责

- `src/adapters/`：只负责 source-specific fetch / parse
- `src/config/`：YAML 加载与校验
- `src/db/`：SQLite schema 与 query helpers
- `src/pipeline/`：collect、normalize、dedupe、topic match、rank、cluster
- `src/query/`：query spec、CLI parser、selection resolver、shared query engine
- `src/views/`：view registry 与 view model 构建
- `src/render/`：Markdown 输出格式化
- `src/cli/`：兼容层 wrapper 与顶层 CLI surface
- `src/verification/`：可复用的验证辅助
- `scripts/`：开发与验证入口
- `config/packs/`：Pack 配置目录

## 设计约束

- Pipeline 保持确定性，AI hook 作为可选增强层
- Fetch 逻辑放在 `adapters/`，ranking/render 保持纯计算
- View-specific 逻辑放在 `views/`，collect/normalize 保持通用
- 测试使用依赖注入，参考 `src/adapters/__tests__/` 的模式
- 新 adapter 通过既有 collector pattern 接入，参考 `src/adapters/rss.ts`

## 编码风格

- **文件组织**：小文件优于大文件，单文件 <400 行，按功能/领域组织
- **错误处理**：在 adapter 边界捕获异常，返回 `Result<T, E>` 模式，不静默吞错误
- **输入验证**：在 `config/` 和 `query/` 层校验，fail fast
- **不可变性**：pipeline 中创建新对象，不修改输入数据

## 开发命令

```bash
# Pack 查询
bun run aggregator run --pack ai-news --view daily-brief --window 24h
bun run aggregator run --pack ai-news,engineering --view daily-brief --window 7d

# 常用验证
bun test && bun run smoke && bun run e2e
```

详细的测试和验证指南请参阅 [TEST.md](TEST.md)。

## 开发工作流

本项目采用结构化的开发工作流，使用 Superpowers 技能：

1. **需求探索 (Brainstorming)** → 产出设计文档
2. **编写计划 (Writing Plans)** → 详细的实施计划
3. **执行计划 (Executing Plans)** → 批量执行（每批最多 3 个任务）
4. **代码审查 (Code Review)** → 每批完成后必须审查
5. **系统调试 (Systematic Debugging)** → Bug 的根因分析
6. **测试驱动开发 (Test-Driven Development)** → Red-Green-Refactor 循环

任务执行阶段，无需反复向我确认，除非遇到重大问题或者关键决策。

## 文档规则

行为变化时，需要保持这些文件同步：

- `README.md`：用户视角说明与命令
- `TEST.md`：验证流程与最佳实践

### Markdown 语言规则

- 本仓库新增或修改的 Markdown 文档必须使用中文