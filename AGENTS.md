# AGENTS.md

## 项目概览

`information-aggregator` 是一个本地优先的 Bun + TypeScript 信息聚合工具，用于收集已配置的数据源、规范化与去重，并通过统一的 `run --view <view>` 查询入口输出 Markdown 或 JSON。

当前能力范围：

- Pack 驱动的数据源配置（自包含 YAML 文件）
- SQLite 持久化：sources、runs、outputs、source health
- `rss`、`json-feed`、`website`、`hn`、`reddit`、`opml_rss`、`digest_feed`、`custom_api`、`github_trending` adapter
- `bird CLI` 驱动的 X family adapter：`x_home`、`x_list`、`x_bookmarks`、`x_likes`、`x_multi`
- 确定性的规范化、精确去重、近似去重、排序、聚类与 Markdown 输出
- enrichment boundary 与有界 AI hook
- `run --pack --view --window`、`sources list`、`config validate` CLI
- 稳定的本地 smoke 与 E2E 验证流程

当前仍明确不包含：

- embeddings / vector similarity
- Web UI
- 多用户能力
- 高级 feedback loop / learning loop

## 架构

主运行流为：

```text
QuerySpec -> SelectionResolver -> Collectors -> RawItem -> Normalize -> Dedup/Cluster -> Rank -> ViewModel -> Render
```

模块职责：

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
- `docs/`：计划、测试说明、实现进展

设计约束：

- 除非明确是可选 AI hook，否则 pipeline 必须保持确定性
- 不要把 fetch 逻辑混入 ranking / render
- 不要把 view-specific 逻辑塞回 collect / normalize
- 测试优先使用依赖注入，不依赖全局 mock
- 新 adapter 必须通过既有 collector pattern 接入

## 配置系统

配置采用自包含的 Pack 设计，数据源直接内联到 Pack 文件中：

```yaml
# config/packs/ai-news.yaml
pack:
  id: ai-news
  name: AI 新闻与动态
  description: AI 领域的新闻站点、公司博客、研究动态
  keywords: [GPT, LLM, 机器学习, AI]

sources:
  - type: rss
    url: https://openai.com/news/rss.xml
    description: OpenAI 官方新闻

  - type: rss
    url: https://huggingface.co/blog/feed.xml
    description: Hugging Face 技术博客
```

相关模块：
- `src/config/load-pack.ts`：Pack 加载与校验
- `src/query/parse-cli.ts`：CLI 参数解析
- `config/packs/`：Pack 配置目录

## 开发流程

安装与基线检查：

```bash
bun install
bun test
bun run check
```

主要开发命令：

```bash
bun run smoke
bun run e2e
bun run e2e:real
bun scripts/aggregator.ts --help
bun scripts/aggregator.ts config validate
bun scripts/aggregator.ts sources list
```

### Pack CLI

```bash
# 单 Pack 查询
bun run aggregator run --pack ai-news --view daily-brief --window 24h
bun run aggregator run --pack ai-news --view item-list --window 7d
bun run aggregator run --pack ai-news --view json --window all

# 多 Pack 合并查询
bun run aggregator run --pack ai-news,engineering --view daily-brief --window 24h
```

## 开发工作流

本项目采用结构化的开发工作流，使用 Superpowers 技能：

1. **需求探索 (Brainstorming)** → 产出设计文档
2. **编写计划 (Writing Plans)** → 详细的实施计划
3. **执行计划 (Executing Plans)** → 批量执行（每批最多 3 个任务）
4. **代码审查 (Code Review)** → 每批完成后必须审查
5. **系统调试 (Systematic Debugging)** → Bug 的根因分析
6. **测试驱动开发 (Test-Driven Development)** → Red-Green-Refactor 循环

任务执行阶段，无需反复向我确认，除非遇到重大问题或者关键决策。

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

## 端到端测试规则

当你新增或修改 source/runtime 行为时：

- 先补本地 mock-source E2E 测试
- 优先使用本地 HTTP test server，而不是脆弱的网络 mock
- 断言最终 Markdown 输出，而不只检查中间结构
- 真实网络 probe 只能作为补充验证，不能是唯一验证
- X family source 要优先做 `bird CLI` 参数映射和 fixture 输出测试，再做手动 probe

当你修改打包或安装行为时：

- 从 clean clone 验证仓库

## 文档规则

行为变化时，需要保持这些文件同步：

- `README.md`：用户视角说明与命令
- `docs/testing.md`：验证流程与最佳实践

如果某项能力故意未完成，必须写进文档，不能让配置或 README 暗示”已经支持”。

### Markdown 语言规则

- 本仓库新增或修改的 Markdown 文档必须使用中文
- 代码标识符、CLI 命令、source type 名称、协议名称等保留原文
- 引用英文上游名称时，用中文解释，不要把整份文档切回英文
