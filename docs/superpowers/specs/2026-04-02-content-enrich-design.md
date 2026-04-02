# Content Enrich Design — 2026-04-02

## 背景

当前 pipeline 中，AI 象限分类（quadrant classification）使用的输入是 `normalizedSummary`（仅 300 字符截断），内容来自 RSS feed 的 `description` 字段，质量有限。

对于「链接聚合型 adapter」（github-trending、techurls、zeli、newsnow、attentionvc），`metadata.content` 字段仅有标题，没有正文。

引入正文获取（content enrichment）环节，在 AI 分类前补全文章正文，提升分类准确性。

## Pipeline 位置

```
dedupe → [NEW: enrich] → generateDailyReport
```

Enrich 阶段尽量后移，只对 dedupe 之后存留的 article 类型 item 进行处理，最大化 API 调用效率。

## Adapter 分类与处理策略

不做 adapter 级别的 source-by-source hack。Enrich 对所有 article 类型 item 统一做动态质量判断。

| Adapter 类型 | 处理策略 |
|---|---|
| 所有 article 类型 | 统一 quality 判断，按需 fetch |
| X/Bird, ClawFeed | 触发 quality 判断（实际会 pass，跳过 fetch） |
| github-trending, techurls, zeli, newsnow, attentionvc | 触发 quality 判断（实际会 fail，触发 fetch） |

> **注**：不做 adapter 级别的特殊处理是因为：
> 1. 同一个 adapter 的不同 item 质量可能不同
> 2. description/content 字段的实际内容因源站而异，无法预先写死
> 3. Quality 判断（>500 字 + ≥3 句）天然能区分"站点描述"和"实际正文"

### RSS/JSON Feed Content 质量抽样调研

| Source | Content 质量 | 示例（首个 item content 字段前 200 字符） |
|--------|------------|----------------------------------------|
| Juya AI Daily | ✅ 完整 | `<p><img src="..."/><h1>AI 早报 2026-04-02</h1><p><strong>视频版</strong>...</p><h2>概览</h2>...` |
| Buzzing (JSON Feed) | ⚠️ 摘要 | `Inside Nepal's Fake Rescue Racket\n👉 103 HN Points: https://news.ycombinator.com/item?id=47613078\n原文地址: https://kathmandupost.com/...` |
| AI Hub Today | ❌ 站点描述 | `Recent content in 何夕2077的博客 on 何夕2077的AI资讯 | 精选AI新闻与工具 | 洞悉AI前沿动态` |
| Marcus on AI (substack) | ❌ 编辑语录 | `"Marcus has become one of our few indispensable public intellectuals. The more people read him..."` |
| Overreacted | ❌ 极短 tagline | `Formats over apps.` |

**结论**：部分 RSS 源的 `description` 字段并非文章正文，而是站点级描述或编辑语录。约 40-50% 源有实际文章内容，其余需 Enrich fetch。Quality 判断（>500 字符 + ≥3 句）可有效过滤低质量 content。

## 动态 needsEnrichment 判断

Enrich 阶段对每个 article 类型的 item 动态计算是否需要 fetch：

```
对每个 article item：
1. contentQuality(normalizedContent) >= PASS？
   → 是：needsEnrichment = false（跳过 fetch）
   → 否：有 valid URL？
        → 是：needsEnrichment = true（触发 fetch）
        → 否：needsEnrichment = false（跳过 fetch，无 URL 可 fetch）
```

**contentQuality() 判断逻辑**（对 normalizedContent 去 HTML 标签后）：

1. **长度阈值**：纯文本字符数 > 500
2. **句子数阈值**：≥ 3 个完整句子（`.` 或 `！` 或 `？` 结尾）
3. **排除特征**：包含 `[...]`、`Read more`、`click here` 等截断特征

满足以上条件 → PASS（有效内容，跳过 fetch）

## 正文获取流程

对判定为无效/缺失的 article item，使用 `agent-fetch`（已安装 `@teng-lin/agent-fetch`）：

```
agent-fetch {article_url} --json
  超时: 20s（默认，可配置）
  ↓ 失败
回退: 使用现有 metadata.content（不阻断 pipeline）
```

`agent-fetch` 支持：
- 自动识别 WordPress REST API 等常见 CMS API
- 内置 proxy 支持（环境变量 `AGENT_FETCH_PROXY`）
- TLS fingerprint 伪装（`--preset`）
- 失败时自动降级到 HTML 解析

**并发控制**：batch size = 10（可配置）

**单 item 失败**：不影响其他 item，不阻断 pipeline

## AI 分类变更

`src/reports/daily.ts` 中 `classifyArticlesQuadrantBatch`：

- 输入从 `normalizedSummary`（300 字符截断）
- 改为 `normalizedContent`（enriched 后的全文，无截断）

## 数据流

```
RawItem
  ↓ collect
normalizedArticle (normalizedContent = metadata.content || metadata.summary)
  ↓ dedupe
[deduped articles]
  ↓ enrich
  对每个 article item：
    contentQuality(normalizedContent) >= PASS？
      → 是：跳过 fetch（needsEnrichment = false）
      → 否 + 有 URL：调用 agent-fetch（needsEnrichment = true）
        → 成功：normalizedContent = agent-fetch 结果
        → 失败：回退到原有 normalizedContent
  ↓ generateDailyReport
AI 分类使用 enriched normalizedContent
```

> **注意**：`normalizedSummary` 在 enrich 阶段保持不变，仅 `normalizedContent` 被替换。由于 AI 分类改用 `normalizedContent`，`normalizedSummary` 此后不再被使用。

## Token 消耗注意

切换到全文输入（`normalizedContent`）后，每次 AI 分类的 token 消耗会显著高于原来的 300 字符截断输入。典型 article 正文约 2000-5000 字符，需在评估 API 成本时考虑此变化。

## Fallback 行为

Fetch 失败时回退到现有的 `metadata.content`，**不阻断 pipeline**。需注意：此情况下 AI 分类收到的可能是低质量内容（内容过短或已被截断），分类准确性可能下降。

## 文件变更（预计）

| 文件 | 变更 |
|---|---|
| `src/pipeline/enrich.ts` | 新建，实现动态 needsEnrichment 判断 + agent-fetch 调用 |
| `src/pipeline/enrich.test.ts` | 新建 |
| `src/cli/run.ts` | pipeline 中增加 enrich 步骤 |
| `src/reports/daily.ts` | classifyArticlesQuadrantBatch 改用 normalizedContent |
| `src/types/index.ts` | normalizedArticle 新增可选字段（如 `enrichedContent`） |
| `src/pipeline/extract-content.ts` | 可移除（已孤立，agent-fetch 替代方案） |

## 配置项

通过 `config/reports.yaml` 或环境变量新增：

```yaml
enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  fetchTimeout: 20000  # agent-fetch 超时（毫秒）
```

## 测试策略

1. **Enrich 逻辑测试**：验证 quality 判断、fetch 流程、fallback 逻辑
2. **集成测试**：用最小数据源（`--time-window 1h`）跑完整 pipeline，验证日报输出
3. **按 adapter 分类测试**：
   - RSS（content 有效）→ 跳过 fetch
   - techurls item → 触发 fetch
   - fetch 失败 → 回退现有 content
