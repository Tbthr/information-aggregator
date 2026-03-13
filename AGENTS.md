> CLAUDE.md 是指向此文件的软链接，两者内容相同。

## 项目概览
`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、去除重复内容，并通过统一的 CLI 输出 Markdown 或 JSON 结果。

## 模块职责

- `src/adapters/`：只负责 source-specific fetch / parse
- `src/config/`：YAML 加载与校验
- `src/db/`：SQLite schema 与 query helpers
- `src/pipeline/`：collect、normalize、dedupe、topic match、rank、cluster
- `src/query/`：query spec、CLI parser、selection resolver、shared query engine
- `src/views/`：view registry 与 view model 构建
- `src/views/render/`：Markdown 渲染输出
- `src/render/`：JSON 等其他格式输出
- `src/ai/`：AI 客户端抽象层
  - `src/ai/config/`：配置 schema 与加载（settings.yaml → 环境变量，4 层优先级）
  - `src/ai/providers/`：策略模式实现（base.ts 抽象基类 + 各 provider 策略）
  - `src/ai/prompts*.ts`：各场景 prompt 构建
  - `src/ai/concurrency.ts`：并发控制
- `src/cli/`：CLI 命令与入口点（main.ts）
- `src/utils/`：通用工具函数
- `src/verification/`：可复用的验证辅助（smoke、e2e）
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
# 常用验证
bun test && bun run smoke
```

详细的测试和验证指南请参阅 [TEST.md](TEST.md)。

## 开发工作流

This project follows a structured development workflow using Superpowers skills:
1. **Brainstorming** → Design documentation
2. **Writing Plans** → Detailed implementation plans
3. **Executing Plans** → Batch execution (max 3 tasks per batch)
4. **Code Review** → Mandatory review after each batch
5. **Systematic Debugging** → Root cause analysis for bugs
6. **Test-Driven Development** → Red-Green-Refactor cycle

任务执行阶段，无需反复向我确认，除非遇到重大问题或者关键决策。

## 文档规则

行为变化时，需要保持这些文件同步：

- `README.md`：用户视角说明与命令
- `TEST.md`：验证流程与最佳实践

### Markdown 语言规则

- 本仓库新增或修改的 Markdown 文档必须使用中文