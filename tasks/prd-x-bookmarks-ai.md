# PRD: X Bookmarks AI 增强日报

## 概述

为 `information-aggregator` 的 X Bookmarks 数据源添加 AI 增强能力，包括完整的 X 内容解析（帖子、回复、文章）、AI 评分、智能摘要、以及丰富的 Markdown 日报输出格式。

## 质量门禁

这些命令必须在每个用户故事通过：
- `bun run check` - TypeScript 类型检查
- `bun test` - 单元测试

## 用户故事

### US-001: 适配 Anthropic 兼容 AI Provider

As a developer, I want to support Anthropic-compatible AI API so that I can use Zhipu AI GLM-5 model for scoring and summarization.

**Acceptance Criteria:**
- [ ] 修改 `src/ai/client.ts` 支持 Anthropic Messages API 格式 (`/v1/messages`)
- [ ] 支持通过环境变量配置 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL`
- [ ] 添加 `createAnthropicClient()` 工厂函数
- [ ] 单元测试验证 API 调用格式正确

### US-002: CLI 集成 AI Client

As a user, I want AI capabilities automatically enabled when environment variables are set so that I get AI-enhanced output without manual configuration.

**Acceptance Criteria:**
- [ ] 修改 `scripts/aggregator.ts`，从环境变量创建 AI client
- [ ] 将 AI client 传入 `runQuery` 的 dependencies
- [ ] AI client 为可选依赖，未配置时降级到基础评分
- [ ] 添加 `--no-ai` 参数显式禁用 AI

### US-003: 增强 X 帖子内容解析

As a user, I want complete X post content parsing so that all information including replies, threads, and articles are captured.

**Acceptance Criteria:**
- [ ] 修改 `src/adapters/x-bird.ts` 解析更多 BirdItem 字段
- [ ] 解析 `article` 对象的完整内容（title, previewText, url）
- [ ] 解析 `thread` / `parent` 回复内容
- [ ] 解析 `media` 类型（image, video, gif）
- [ ] 解析 `quote` 引用帖子内容
- [ ] 将所有扩展数据存入 `metadataJson`

### US-004: 添加 X 专用 AI Prompts

As a developer, I want specialized prompts for X content so that AI generates high-quality scores and summaries for social media posts.

**Acceptance Criteria:**
- [ ] 在 `src/ai/prompts.ts` 添加 `buildXPostScorePrompt(title, snippet, engagement, author)`
- [ ] 添加 `buildXPostSummaryPrompt(title, snippet)` 生成 50 字内中文摘要
- [ ] 添加 `buildDigestNarrationPromptX(items)` 生成今日看点摘要
- [ ] 添加 `buildTopicSuggestionPrompt(items)` 生成选题建议
- [ ] Prompts 使用中文输出

### US-005: 增强 X Bookmarks 视图

As a user, I want a rich daily-brief format for X bookmarks so that I can quickly understand what's worth reading.

**Acceptance Criteria:**
- [ ] 创建新视图 `src/views/x-bookmarks-digest.ts`
- [ ] 日报标题格式：`📰 书签日报 — YYYY-MM-DD`
- [ ] 包含「今日看点」AI 摘要（3-5 句话）
- [ ] 包含「数据概览」表格（扫描/筛选/精选数）
- [ ] 每条内容显示：作者链接、⭐ AI 评分、❤️ 点赞、🔄 转发、💬 评论
- [ ] 包含 AI 生成的 50 字摘要
- [ ] 包含「为什么值得关注」说明
- [ ] 包含标签（AI 提取或规则匹配）
- [ ] 在 `src/views/registry.ts` 注册视图

### US-006: 添加数据统计和可视化

As a user, I want visual statistics in the report so that I can quickly understand content distribution and trends.

**Acceptance Criteria:**
- [ ] 添加分类分布统计
- [ ] 添加高频关键词统计（Top 10）
- [ ] 输出 mermaid pie chart（分类分布）
- [ ] 输出 mermaid bar chart（关键词频次）
- [ ] 提供纯文本备用格式（终端友好）
- [ ] 添加话题标签云

### US-007: 添加选题建议

As a content creator, I want AI-suggested topics so that I can create relevant content based on my bookmarks.

**Acceptance Criteria:**
- [ ] 基于精选内容生成 3-5 个选题建议
- [ ] 每个选题包含：标题、角度说明、素材来源链接
- [ ] 使用 AI 生成吸引人的标题
- [ ] 在日报末尾输出「选题思路」section

### US-008: 端到端验证

As a developer, I want automated verification so that the feature works end-to-end.

**Acceptance Criteria:**
- [ ] 运行 `bun scripts/aggregator.ts run --pack x-bookmarks --view x-bookmarks-digest --window all --output out/test.md`
- [ ] 验证输出包含所有期望 section
- [ ] 验证 AI 评分/摘要正常显示
- [ ] 验证数据统计正确
- [ ] 更新 TEST.md 添加验证步骤

## 功能需求

- FR-1: 系统必须支持 Anthropic Messages API 格式的 AI provider
- FR-2: 系统必须从环境变量 `ANTHROPIC_*` 读取 AI 配置
- FR-3: AI client 必须是可选的，未配置时系统降级运行
- FR-4: X adapter 必须解析 thread、quote、article、media 等扩展内容
- FR-5: AI prompts 必须输出中文内容
- FR-6: 新视图 `x-bookmarks-digest` 必须包含日报格式输出
- FR-7: 每条内容必须显示 AI 评分（0-15 分制）和互动数据

## 非目标

- 不实现实时获取（仍依赖 bird CLI 手动触发）
- 不实现增量更新（每次全量处理）
- 不实现 Web UI
- 不实现多语言支持（仅中文）
- 不实现用户偏好学习

## 技术考量

### AI Provider 配置

```bash
# 环境变量配置
ANTHROPIC_AUTH_TOKEN=7152d6764d10401fa7e5882ec44d071d.OKXrmnwAgD1ZOcCp
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
ANTHROPIC_MODEL=GLM-5
```

### API 格式

Anthropic Messages API 格式：
```json
{
  "model": "GLM-5",
  "max_tokens": 1024,
  "messages": [{"role": "user", "content": "..."}]
}
```

### 性能考量

- 评分/摘要批处理，避免逐条调用
- 考虑并发限制（避免触发 API rate limit）
- 缓存 AI 结果到 SQLite（可选优化）

## 成功指标

1. 运行 `x-bookmarks-digest` 视图输出格式与参考 md 相近
2. 所有帖子都有 AI 评分和摘要
3. 统计图表正确渲染
4. 端到端测试通过

## 待解决问题

- [ ] AI 调用成本控制（是否需要限制调用次数）
- [ ] 是否需要缓存 AI 结果避免重复调用
- [ ] 如何处理 AI 调用失败的情况