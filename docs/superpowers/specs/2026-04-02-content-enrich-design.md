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

| Adapter 类型 | metadata.content 质量 | 处理策略 |
|---|---|---|
| RSS, JSON Feed | `content:encoded` / `content_html` 可能包含全文 | 质量判断后按需 fetch |
| X/Bird | 推文正文 text 完整 | 不触发 fetch |
| ClawFeed | digest 内容完整 | 不触发 fetch |
| github-trending, techurls, zeli, newsnow, attentionvc | 只有 title/url，无 content | 触发 fetch |

## Content Quality 判断

对 `metadata.content`（去 HTML 标签后）进行判断：

1. **长度阈值**：纯文本字符数 > 500
2. **句子数阈值**：≥ 3 个完整句子（`.` 或 `！` 或 `？` 结尾）
3. **排除特征**：包含 `[...]`、`Read more`、`click here` 等截断特征

满足以上条件 → 判定为有效内容，**跳过 fetch**。

## 正文获取流程

对判定为无效/缺失的 article item：

```
Jina Reader API
  URL: https://r.jina.ai/{article_url}
  超时: 10s
  ↓ 失败
Defuddle
  URL: https://defuddle.md/{article_url}
  超时: 15s
  ↓ 失败
回退: 使用现有 metadata.content（不阻断 pipeline）
```

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
normalizedArticle (normalizedContent 被 Jina/defuddle 结果替换)
  ↓ generateDailyReport
AI 分类使用 enriched normalizedContent
```

## 文件变更（预计）

| 文件 | 变更 |
|---|---|
| `src/pipeline/enrich.ts` | 新建，整合现有的 extract-content.ts 逻辑 + Jina/defuddle 调用 |
| `src/pipeline/enrich.test.ts` | 新建 |
| `src/cli/run.ts` | pipeline 中增加 enrich 步骤 |
| `src/reports/daily.ts` | classifyArticlesQuadrantBatch 改用 normalizedContent |
| `src/types/index.ts` | normalizedArticle 新增可选字段（如 `enrichedContent`） |

## 配置项

通过 `config/reports.yaml` 或环境变量新增：

```yaml
enrich:
  enabled: true
  batchSize: 10
  minContentLength: 500
  jinaTimeout: 10000
  defuddleTimeout: 15000
```

## 测试策略

1. **Enrich 逻辑测试**：验证 quality 判断、fetch 流程、fallback 逻辑
2. **集成测试**：用最小数据源（`--time-window 1h`）跑完整 pipeline，验证日报输出
3. **按 adapter 分类测试**：
   - RSS（content 有效）→ 跳过 fetch
   - techurls item → 触发 fetch
   - fetch 失败 → 回退现有 content
