# Adapter Cleanup & RawItem Field Refactor

**日期**: 2026-04-03
**状态**: 设计完成，待实现

---

## 背景

基于 `adapter_verification_report.md` 的验收结果，发现以下问题：

1. **字段冗余**: `RawItem.metadataJson` 中的 `provider`、`sourceKind`、`contentType` 与 RawItem 顶层字段或 YAML 配置重复
2. **废弃 adapter 未清理**: `techurls`、`newsnow`、`website` adapter 已无对应数据源，仍保留在 `buildAdapters()` 中
3. **类型不匹配**: `www-buzzing-cc-feed-json` 在 `sources.yaml` 中声明为 `type: rss`，实际是 JSON Feed 格式
4. **GitHub-Trending 未注册**: adapter 存在但未在 `buildAdapters()` 中注册

---

## 改动 1: RawItem 类型重构

### 问题

`metadataJson` 中存在通用字段，造成冗余：

| metadataJson 字段 | 实际来源 | 问题 |
|---|---|---|
| `provider` | adapter 硬编码，与 sourceKind 重复 | 冗余 |
| `sourceKind` | adapter 硬编码，应从 YAML 读取 | 应提升到顶层 |
| `contentType` | adapter 硬编码，应从 YAML 读取 | 应提升到顶层 |

### 解决方案

**提升到 RawItem 顶层**:
- `sourceType: string` — 直接对应 `sources.yaml.type` 字段
- `contentType: string` — 直接对应 `sources.yaml.contentType` 字段（必填）

**从 metadataJson 中移除**:
- `provider`
- `sourceKind`
- `contentType`

**metadataJson 保留**: adapter 特有字段（engagement, canonicalHints, media, article, tweetId, hnId, digestId, 等）

### 类型变更

```typescript
// src/types/index.ts

// RawItem 修改
export interface RawItem {
  id: string;
  sourceId: string;
  sourceType: string;          // 新增：从 source.type 读取
  contentType: string;        // 新增：从 source.contentType 读取（必填）
  title: string;
  url: string;
  author?: string;
  content?: string;
  publishedAt?: string;
  fetchedAt: string;
  metadataJson: string;        // 只含 adapter 特有字段
  filterContext?: FilterContext;
}

// Source 类型修改
export interface InlineSource {
  kind: string;               // 保持 string，与 YAML type 字段一致
  url: string;
  description?: string;
  name?: string;
  enabled?: boolean;
  configJson?: string;
  priority?: number;
  defaultTopicIds?: string[];
  authRef?: string;
  contentType: string;        // 新增：必填
}
```

### metadataJson 变更示例

**RSS adapter 修改前**:
```typescript
metadataJson = JSON.stringify({
  provider: "rss",
  sourceKind: "rss",
  contentType: "article",
  rawPublishedAt: ...,
  summary: ...,
  content: ...,
  authorName: ...,
});
```

**RSS adapter 修改后**:
```typescript
metadataJson = JSON.stringify({
  rawPublishedAt: ...,
  summary: ...,
  content: ...,
  authorName: ...,
});

// RawItem 顶层赋值
rawItem.sourceType = source.type;      // "rss"
rawItem.contentType = source.contentType; // "article"
```

---

## 改动 2: sources.yaml 改造

### 2.1 修正类型错误

`www-buzzing-cc-feed-json` 实际为 JSON Feed 格式，需修正：

```yaml
# 修改前
- type: rss
  id: www-buzzing-cc-feed-json

# 修改后
- type: json-feed
  id: www-buzzing-cc-feed-json
  contentType: article
```

### 2.2 启用 GitHub-Trending

```yaml
- type: github-trending
  id: github-com-trending
  enabled: true   # false → true
  contentType: repository
```

### 2.3 恢复 Twitter/X 源

取消注释，恢复 `twitter` 源配置：

```yaml
- type: twitter
  id: karpathy
  name: Andrej Karpathy
  handle: karpathy
  enabled: true
  topics: [ai]
  auth:
    authToken: ${TWITTER_AUTH_TOKEN}
    ct0: ${TWITTER_CT0}
```

### 2.4 新增 contentType 字段

**所有 source 必须补 `contentType` 字段**，参考值：

| sourceType | contentType 示例 |
|---|---|
| `rss` | `article` |
| `json-feed` | `article` |
| `clawfeed` | `digest` |
| `zeli` | `article` |
| `attentionvc` | `article` |
| `twitter` | `tweet` |
| `github-trending` | `repository` |

---

## 改动 3: build-adapters.ts 改造

### 3.1 注册 GitHub-Trending

```typescript
import { collectGitHubTrendingSource } from "./github-trending";

export function buildAdapters(): Record<string, AdapterFn> {
  return {
    // ... 现有 adapters
    githubTrending: (source, options) => collectGitHubTrendingSource(source, options),
  };
}
```

### 3.2 移除废弃 adapter

移除 `techurls`、`newsnow`、`website` 的注册。

---

## 改动 4: 删除废弃文件

| 删除文件 | 原因 |
|---|---|
| `src/adapters/techurls.ts` | adapter 已废弃 |
| `src/adapters/newsnow.ts` | adapter 已废弃 |
| `src/adapters/website.ts` | adapter 已废弃 |
| `src/adapters/techurls.test.ts` | 对应 adapter 已删除 |
| `src/adapters/newsnow.test.ts` | 对应 adapter 已删除 |

---

## 改动 5: env.local 新增配置

```bash
# Twitter/X 认证
TWITTER_AUTH_TOKEN=your_token_here
TWITTER_CT0=your_ct0_here
```

---

## 改动 6: Adapter 统一改造

所有 adapter 构建 RawItem 时遵循以下规范：

1. **不再写入** `metadataJson` 中的 `provider`、`sourceKind`、`contentType`
2. **`sourceType`** 直接从 `source.type` 读取，赋值到 RawItem 顶层
3. **`contentType`** 直接从 `source.contentType` 读取，赋值到 RawItem 顶层

### 需改造的 adapter

| Adapter | 特殊字段 |
|---|---|
| `rss` | `authorName`, `summary`, `rawPublishedAt` |
| `json-feed` | `authorName`, `summary` |
| `clawfeed` | `userName`, `userSlug`, `digestId`, `digestType` |
| `zeli` | `source`, `hnId` |
| `attentionvc` | `tweetId`, `authorId`, `authorName`, `engagement`, `coverImageUrl`, `rank` 等 |
| `x-bird` | `tweetId`, `authorId`, `authorName`, `engagement`, `media`, `article`, `conversationId` 等 |
| `github-trending` | `stars`, `forks`, `todayStars`, `language`, `author`, `repo` |

---

## 改动 7: pipeline 层适配

`normalize.ts` 和 `collect.ts` 中引用 `RawItemMetadata` 类型的地方需同步更新：

- 移除 `provider`、`sourceKind`、`contentType` 字段
- 如有代码依赖这些字段，需改为从 RawItem 顶层或 source 配置读取

---

## 实现顺序

1. 修改 `src/types/index.ts`（RawItem、Source 类型）
2. 修改 `config/sources.yaml`（补 contentType，修正 type，恢复 twitter）
3. 修改 `build-adapters.ts`（注册 githubTrending，移除 techurls/newsnow/website）
4. 删除废弃 adapter 文件
5. 逐个改造 adapter（移除 metadataJson 中的 provider/sourceKind/contentType）
6. 修改 `src/pipeline/normalize.ts` 等依赖类型
7. 运行 `bun run typecheck` 验证
8. 运行 `bun test` 验证
9. 更新 `.env.local`（添加 twitter 认证变量）
