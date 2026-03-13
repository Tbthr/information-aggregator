如果运行过程中发现了与本次任务无关的问题，需要考量下影响面和复杂度，如果可以比较简单的解决则直接修复，否则需要添加到README.md的"后续计划"中。

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

## 测试指南

参阅 [TEST.md](TEST.md)

## 文档规则

行为变化时，需要保持这些文件同步：

- `README.md`：用户视角说明与命令
- `TEST.md`：验证流程与最佳实践

### Markdown 语言规则

- 本仓库新增或修改的 Markdown 文档必须使用中文
