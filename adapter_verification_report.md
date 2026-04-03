# Adapter 验收报告

> 生成日期: 2026-04-02
> 验收范围: 所有 10 个 Adapter（RSS, JSON-Feed, Clawfeed, Zeli, AttentionVC, Website, X-Bird, GitHub-Trending, Techurls, NewsNow）

---

## 1. RSS Adapter

**类型**: `rss`（标准 RSS 2.0 + Atom）
**用途**: 聚合标准 RSS/Atom Feed，是最通用的内容源适配器

### 字段映射

| RawItem 字段 | RSS/Atom 标签 | 优先级 |
|---|---|---|
| `id` | `${sourceId}-${index}-${url}` | — |
| `sourceId` | 入参 | — |
| `title` | `<title>` | — |
| `url` | `<link>` > Atom `<link href>` | 高 > 低 |
| `author` | `<dc:creator>` > `<author>` > `<managingEditor>` | 依次回退 |
| `publishedAt` | `pubDate` > `published` > `updated` | 依次回退 |
| `content` | `<content:encoded>` | — |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "rss",
  "sourceKind": "rss",
  "contentType": "article",
  "rawPublishedAt": "Wed, 01 Apr 2026 00:00:00 GMT",
  "timeSourceField": "pubDate",
  "timeParseNote": "parsed with timezone conversion",
  "summary": "<description> 标签内容",
  "content": "<content:encoded> 标签内容",
  "authorName": "同 author"
}
```

### 实际 Fetch 验证

**测试源**: `s-baoyu-io-feed`（宝玉的分享）
**时间窗口**: 7 天 | **结果**: 获取 4 条，丢弃 46 条（92% 丢弃率正常）

**示例 RawItem**:

```json
{
  "id": "s-baoyu-io-feed-1-https://baoyu.io/blog/openai-president-...",
  "sourceId": "s-baoyu-io-feed",
  "title": "OpenAI 总裁 Greg Brockman：AI 自我改进、Super App 豪赌...",
  "url": "https://baoyu.io/blog/openai-president-greg-brockman-...",
  "author": "宝玉",
  "publishedAt": "2026-04-01T00:00:00.000Z",
  "fetchedAt": "2026-04-02T19:45:35.464Z",
  "metadataJson": {
    "provider": "rss",
    "sourceKind": "rss",
    "contentType": "article",
    "rawPublishedAt": "Wed, 01 Apr 2026 00:00:00 GMT",
    "timeSourceField": "pubDate",
    "timeParseNote": "parsed with timezone conversion",
    "summary": "Brockman 用 90 分钟重新包装每一个被动决策...",
    "authorName": "宝玉"
  }
}
```

### 时间解析

- 支持 RFC 2822、ISO 8601（Z/时区偏移）、纯日期（填充为 23:59:59 UTC）
- 相对时间（"2 hours ago"）和无效时间戳会直接丢弃条目
- 不尝试回退到其他时间字段（如果 `pubDate` 解析失败则丢弃）

### 潜在问题

- **content 依赖 `content:encoded`**：部分 RSS 源只提供 `<description>` 而无 `<content:encoded>`，此时 content 为空
- **ID 含 index**：理论上同 URL 重复解析时 ID 会重复，实际场景下唯一性由 URL 保证

**结论**: ✅ 通过

---

## 2. JSON-Feed Adapter

**类型**: `json-feed`（JSON Feed 1.1 规范）
**用途**: 解析 JSON Feed 格式的数据源，比 RSS 更适合现代 Web

### 字段映射

| RawItem 字段 | JSON Feed 字段 | 备注 |
|---|---|---|
| `id` | `item.id` > `${sourceId}-${index}` | 回退到 index |
| `sourceId` | 入参 | — |
| `title` | `item.title` > `Untitled ${index}` | — |
| `url` | `item.url` > `item.external_url` | 依次回退 |
| `author` | `item.author.name` | — |
| `publishedAt` | `date_published` > `date_modified` | 依次回退 |
| `content` | `content_text` > `content_html` | 优先纯文本 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "json-feed",
  "sourceKind": "json-feed",
  "contentType": "article",
  "rawPublishedAt": "2026-04-01T08:00:00Z",
  "timeSourceField": "date_published",
  "timeParseNote": "parsed as UTC",
  "summary": "item.summary",
  "content": "item.content_text | item.content_html",
  "authorName": "item.author.name"
}
```

### 时间解析

- 支持 ISO 8601（Z/时区偏移）和纯日期（YYYY-MM-DD，填充为 23:59:59 UTC）
- 不支持 RFC 2822（与 RSS 不同）
- 相对时间和无效时间戳会丢弃条目

### 与 RSS Adapter 对比

| 特性 | RSS | JSON-Feed |
|---|---|---|
| ID 来源 | 构造值 | 原生 `id` 字段 |
| 时间支持 | RFC 2822 + ISO 8601 | 仅 ISO 8601 |
| content 优先 | HTML encoded | 纯文本 > HTML |

**结论**: ✅ 通过

---

## 3. Clawfeed Adapter

**类型**: `clawfeed`（自定义 JSON API）
**用途**: 获取用户自定义的 RSS 摘要，每 4 小时生成一份

### 字段映射

| RawItem 字段 | Clawfeed API 字段 | 备注 |
|---|---|---|
| `id` | `clawfeed-${d.id}` | 固定前缀 + digest ID |
| `sourceId` | 入参 | — |
| `title` | 从 `content` 首行解析 | 去除 emoji 和 "ClawFeed \|" 前缀 |
| `url` | API URL（无单篇 URL） | 所有 item 共用源 URL |
| `publishedAt` | `d.created_at` | — |
| `content` | `d.content` | 完整摘要正文 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "clawfeed",
  "sourceKind": "clawfeed",
  "contentType": "digest",
  "userName": "body.user.name",
  "userSlug": "body.user.slug",
  "digestId": "d.id",
  "digestType": "d.type"
}
```

### 关键特性

- **`url` 字段为源 URL 而非单篇文章 URL**：ClawFeed 是摘要合集，没有单篇链接
- **`contentType` 为 `digest`**：区别于普通 article
- **标题解析**：从 `content` 首行提取（如 "☀️ ClawFeed | 2026-04-01 20:41 SGT" → "ClawFeed Digest 2026-04-01 20:41"）
- **无 `author` 字段**：摘要无单作者

### 潜在问题

- **无单篇文章 URL**：无法直接跳转原文，只能查看摘要内容
- **标题依赖内容格式**：如果首行格式变化解析可能不稳定

**结论**: ✅ 通过（设计如此）

---

## 4. Zeli Adapter

**类型**: `zeli`（自定义 API）
**用途**: 抓取 Hacker News 24 小时最热帖子

### 字段映射

| RawItem 字段 | Zeli API 字段 | 备注 |
|---|---|---|
| `id` | `zeli-${p.id}` | 固定前缀 + HN ID |
| `sourceId` | 入参 | — |
| `title` | `p.title` | — |
| `url` | `p.url` | HN 帖子原始链接 |
| `publishedAt` | Unix timestamp `p.time * 1000` | 自动转换 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "zeli",
  "sourceKind": "zeli",
  "contentType": "article",
  "source": "Hacker News · 24h最热",
  "hnId": "p.id"
}
```

### 关键特性

- **Unix 时间戳解析**：`p.time`（秒级）自动乘以 1000 转为 Date
- **无 `content` 和 `author` 字段**：HN API 只返回标题和链接
- **`contentType` 为 `article`**：虽是链接聚合但按 article 处理

### 潜在问题

- **无内容正文**：只含标题和 URL，无摘要/正文
- **无作者信息**：HN 帖子无单作者概念

**结论**: ✅ 通过

---

## 5. AttentionVC Adapter

**类型**: `attentionvc`（REST API）
**用途**: 获取 X/Twitter 上 AI 领域 24 小时热门文章排行榜

### 字段映射

| RawItem 字段 | AttentionVC API 字段 | 备注 |
|---|---|---|
| `id` | `attentionvc-${entry.tweetId}` | 推文 ID |
| `sourceId` | 入参 | — |
| `title` | `entry.title` | 外链文章标题 |
| `url` | `https://x.com/${author.handle}/status/${tweetId}` | Twitter URL |
| `author` | `entry.author.name` | 作者显示名 |
| `publishedAt` | `entry.tweetCreatedAt` | 推文发布时间 |
| `content` | `entry.previewText` | 文章预览文本 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "attentionvc",
  "sourceKind": "attentionvc",
  "contentType": "article",
  "tweetId": "entry.tweetId",
  "authorId": "entry.author.handle",
  "authorName": "entry.author.name",
  "isBlueVerified": "entry.author.isBlueVerified",
  "followerCount": "entry.author.followers",
  "accountBasedIn": "entry.author.accountBasedIn",
  "engagement": {
    "views": "entry.viewCount",
    "likes": "entry.likeCount",
    "retweets": "entry.retweetCount",
    "replies": "entry.replyCount",
    "quotes": "entry.quoteCount",
    "bookmarks": "entry.bookmarkCount"
  },
  "coverImageUrl": "entry.coverImageUrl",
  "wordCount": "entry.wordCount",
  "readingTimeMinutes": "entry.readingTimeMinutes",
  "category": "entry.category",
  "tags": "entry.tags",
  "langsDetected": "entry.langsDetected",
  "trendingTopics": "entry.trendingTopics",
  "lastMetricsUpdate": "entry.lastMetricsUpdate",
  "rank": "entry.rank"
}
```

### 关键特性

- **`url` 为 Twitter 帖子 URL**：不是原文 URL，需通过 `metadataJson.expandedUrl` 或 `coverImageUrl` 获取原文
- **丰富的 `engagement` 数据**：完整的互动指标（views, likes, retweets 等）
- **`contentType` 为 `article`**：虽然是推文形式但内容是文章推荐

### 潜在问题

- **`url` 是 Twitter 而非原文**：需注意去重逻辑的 URL 比对应使用 `expandedUrl` 而非 `url`
- **作者信息可能不完整**：部分作者无蓝 V 认证或地理位置信息

**结论**: ✅ 通过

---

## 6. Website Adapter

**类型**: `website`（静态 HTML 回退）
**用途**: 当数据源无 RSS/JSON Feed 时，作为最后兜底的 HTML 解析方案

### 字段映射

| RawItem 字段 | HTML 解析来源 | 备注 |
|---|---|---|
| `id` | `${sourceId}-${Date.now()}` | 时间戳构造 |
| `sourceId` | 入参 | — |
| `title` | `<title>` 或正文摘要 | 依次回退 |
| `url` | 入参 URL | — |
| `author` | `<meta name="author">` | — |
| `publishedAt` | `<time datetime="...">` | 必须存在否则丢弃 |
| `content` | 全文文本（去除 HTML 标签） | — |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "website",
  "sourceKind": "website",
  "contentType": "article",
  "summary": "<meta description> 内容",
  "content": "提取的纯文本（前 5000 字符）",
  "authorName": "同 author",
  "publishedTime": "<time datetime> 原始值"
}
```

### 关键特性

- **兜底适配器**：仅在其他适配器不适用时使用
- **严格的时间要求**：必须有 `<time datetime>` 属性，否则直接丢弃
- **内容提取**：通过正则去除 `<script>`, `<style>`, `<nav>`, `<footer>` 等干扰内容
- **内容截断**：metadataJson 中 content 限制为 5000 字符

### 潜在问题

- **无单篇文章 URL 时整个源只有 1 条**：Website Adapter 以 URL 为粒度，一个页面只产生一条 item
- **ID 依赖时间戳**：`${sourceId}-${Date.now()}` 存在极低概率冲突
- **内容质量依赖页面结构**：不同网站 HTML 结构差异大，解析结果不稳定

**结论**: ✅ 通过（设计为兜底方案）

---

## 7. X-Bird (Twitter) Adapter

**类型**: `x`（通过 bird CLI 调用 Twitter API）
**用途**: 获取 Twitter/X 上的用户推文、列表、时间线、搜索结果

### 字段映射

| RawItem 字段 | Bird CLI 输出字段 | 备注 |
|---|---|---|
| `id` | `item.id` | Twitter 推文 ID |
| `sourceId` | 入参 | — |
| `title` | `article.title` > 规范化文本 | 优先外链文章标题 |
| `url` | `item.url` > 构造 Twitter URL | — |
| `author` | `item.author.username` | 用户名（非显示名） |
| `publishedAt` | `item.created_at` | — |
| `content` | `item.text` | 推文正文 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "bird",
  "sourceKind": "<mode>"（home/list/search/user-tweets/news/trending）,
  "contentType": "social_post",
  "conversationId": "item.conversationId",
  "engagement": {
    "score": "item.likeCount",
    "comments": "item.replyCount",
    "reactions": "item.retweetCount"
  },
  "canonicalHints": { "expandedUrl": "item.expanded_url" },
  "article": {
    "title": "item.article.title",
    "previewText": "item.article.previewText",
    "url": "item.article.url"
  },
  "media": [{ "type": "photo|video|animated_gif", "url": "...", "width?": ..., "height?": ... }],
  "quote": { "id": "...", "text": "...", "author": "...", "url": "..." },
  "thread": [{ "id": "...", "text": "...", "author": "..." }],
  "parent": { "id": "...", "text": "...", "author": "..." },
  "tweetId": "item.id",
  "authorId": "item.authorId",
  "authorName": "item.author?.name",
  "expandedUrl": "item.expanded_url"
}
```

### Bird CLI 支持的模式

| mode | 说明 | 认证方式 |
|---|---|---|
| `home` | 首页时间线 | cookie |
| `list` | 列表时间线 | cookie |
| `bookmarks` | 收藏 | cookie |
| `likes` | 点赞 | cookie |
| `user-tweets` | 用户推文 | cookie |
| `search` | 搜索结果 | cookie |
| `news` / `trending` | 新闻/趋势 | cookie |

### 关键特性

- **通过 bird CLI（第三方工具）获取数据**：不直接调用 Twitter API
- **丰富的 `metadataJson`**：media、article、quote、thread、parent 等完整上下文
- **标题规范化**：优先使用外链文章标题，否则从推文文本提取首行（去除 URL）
- **认证方式多样**：支持 authToken+ct0、Chrome Profile、Cookie Source

### 潜在问题

- **`author` 是 username 而非 display name**：如 `@sama` 而非 "Sam Altman"
- **依赖外部 bird CLI**：需要预装且配置正确
- **cookie 过期**：长时间运行需处理 cookie 刷新

**结论**: ✅ 通过

---

## 8. GitHub-Trending Adapter

**类型**: `github-trending`（静态 HTML 爬取）
**用途**: 抓取 GitHub Trending 页面，聚合热门开源项目

### 字段映射

| RawItem 字段 | GitHub HTML 结构 | 备注 |
|---|---|---|
| `id` | `${sourceId}-${index}` | 索引构造 |
| `sourceId` | 入参 | — |
| `title` | `<h2><a>${author}/${repo}</a></h2>` | 仓库全名 |
| `url` | 构造 `https://github.com/${href}` | 从 `href` 解析 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "github-trending",
  "sourceType": "github-trending",
  "contentType": "repository",
  "stars": "1,234 或 12k",
  "forks": "同上",
  "todayStars": "今日新增 stars",
  "language": "编程语言",
  "author": "仓库作者",
  "repo": "仓库名"
}
```

### 关键特性

- **`contentType` 为 `repository`**：区别于普通 article
- **无 `author`、`publishedAt`、`content` 字段**：Trending 页面不提供这些信息
- **元数据提取**：使用正则从 HTML 文本块中解析星标数（支持 1.2k、12,345 等格式）
- **HTML 结构验证**：若响应不包含 `<article>` 元素则报错

### ⚠️ 重要：未注册到 Adapter 映射

**`src/adapters/build-adapters.ts` 中主动排除了 GitHub-Trending**：

```typescript
/**
 * 构建适配器映射
 * Note: github-trending is intentionally excluded - unsupported source type
 */
export function buildAdapters(): Record<string, AdapterFn> {
  return {
    // ... 其他 adapters
    // github-trending: 注释掉了
  };
}
```

这意味着即使配置文件中定义了 `type: github-trending` 的数据源，系统也无法正确路由到该适配器。

### 潜在问题

1. **未注册**：在 `buildAdapters()` 中被注释排除，无法实际使用
2. **无时间窗口过滤**：没有根据项目发布时间过滤，只展示"今日"Trending
3. **HTML 结构依赖**：GitHub 页面改版会导致解析失败

**结论**: ❌ 不通过 — 未注册到适配器映射，无法投入使用

---

## 9. Techurls Adapter

**类型**: `techurls`（静态 HTML + 相对时间解析）
**用途**: 聚合多个技术博客/新闻源的精选链接

### 字段映射

| RawItem 字段 | TechURLs HTML 结构 | 备注 |
|---|---|---|
| `id` | `${sourceId}-${Date.now()}-${index}` | 含时间戳 |
| `sourceId` | 入参 | — |
| `title` | `a.article-link` 文本 | — |
| `url` | `a.article-link.href` | — |
| `publishedAt` | 从相对时间 `Xh ago` 计算 | 基于当前时间 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "techurls",
  "sourceKind": "techurls",
  "contentType": "article",
  "source": "SourceName · Category",
  "timeHint": "2h ago"
}
```

### 关键特性

- **相对时间解析**：从 "2h ago"、"1d ago" 等文本计算发布时间
- **来源信息丰富**：`primary`（站点名）和 `secondary`（分类）组合为 source
- **使用 linkedom 解析 HTML**：Server-side DOM 解析，比正则更健壮

### 潜在问题

- **ID 含时间戳**：`${sourceId}-${Date.now()}-${index}` 在同一毫秒内多条时存在冲突
- **相对时间精度有限**：只精确到小时/分钟，无法获知具体时刻
- **依赖 HTML 结构**：`.publisher-block` 结构变化会导致解析失败

**结论**: ✅ 通过

---

## 10. NewsNow Adapter

**类型**: `newsnow`（自定义 API）
**用途**: 聚合多个中文技术社区（Hacker News、Product Hunt、GitHub、少数派、掘金、36Kr 等）

### 字段映射

| RawItem 字段 | NewsNow API 字段 | 备注 |
|---|---|---|
| `id` | `${sourceId}-${sid}-${Date.now()}-${index}` | 含时间戳 |
| `sourceId` | 入参 | — |
| `title` | `it.title` | — |
| `url` | `it.url` | — |
| `publishedAt` | `it.pubDate` > `extra.date` > 降级为 updated` | 多级回退 |
| `fetchedAt` | `new Date().toISOString()` | — |
| `metadataJson` | 见下节 | — |

### metadataJson 结构

```json
{
  "provider": "newsnow",
  "sourceKind": "newsnow",
  "contentType": "article",
  "source": "sourceTitle (sid)"
}
```

### 关键特性

- **多源聚合**：通过源 ID 列表批量获取多个社区内容
- **两阶段 API**：优先调用 `/api/s/entire` 批量接口，失败后逐个调用 `/api/s?id={sourceId}`
- **动态源发现**：从首页 HTML 的 JS Bundle 中提取 `sourceIds` 数组
- **多级时间回退**：`pubDate` → `extra.date` → `updatedTime`

### 潜在问题

1. **ID 含时间戳**：`${Date.now()}` 在同一毫秒内多条时存在冲突
2. **依赖 JS Bundle 解析**：`sourceIds` 提取依赖正则匹配，可能因页面改版失败
3. **User-Agent 伪造**：需要 Chrome UA 才能访问 API

**结论**: ✅ 通过

---

## 验收汇总

| # | Adapter | 类型 | 状态 | 关键字段完整度 | 备注 |
|---|---|---|---|---|---|
| 1 | RSS | `rss` | ✅ 通过 | 9/9 | 所有字段完整 |
| 2 | JSON-Feed | `json-feed` | ✅ 通过 | 9/9 | 所有字段完整 |
| 3 | Clawfeed | `clawfeed` | ✅ 通过 | 8/9 | 无 `author`（设计如此） |
| 4 | Zeli | `zeli` | ✅ 通过 | 6/9 | 无 `author`、`content`（HN API 限制） |
| 5 | AttentionVC | `attentionvc` | ✅ 通过 | 9/9 | `url` 为 Twitter URL |
| 6 | Website | `website` | ✅ 通过 | 9/9 | 兜底适配器 |
| 7 | X-Bird | `x` | ✅ 通过 | 9/9 | 丰富 metadataJson |
| 8 | GitHub-Trending | `github-trending` | ❌ 不通过 | 4/9 | 未注册到 `buildAdapters()` |
| 9 | Techurls | `techurls` | ✅ 通过 | 7/9 | 无 `author`、`content` |
| 10 | NewsNow | `newsnow` | ✅ 通过 | 7/9 | 无 `author`、`content` |

### 严重问题

**GitHub-Trending Adapter 未注册**：在 `src/adapters/build-adapters.ts` 中被注释排除，无法实际使用。若配置文件中有 `type: github-trending` 的数据源，将无法找到对应 collector 函数。

### 建议修复

```typescript
// src/adapters/build-adapters.ts
export function buildAdapters(): Record<string, AdapterFn> {
  return {
    // ... 现有 adapters
    // github-trending: 需要取消注释并导入
    githubTrending: (source, options) => collectGitHubTrendingSource(source, options.fetchImpl),
  };
}
```

同时 `collectGitHubTrendingSource` 签名与 `AdapterFn` 不一致（第二个参数缺 `filterContext`），需要统一。
