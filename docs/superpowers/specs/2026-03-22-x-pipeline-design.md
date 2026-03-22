# X/Twitter 独立 Pipeline + 专用页面

## 概述

将 X/Twitter 从现有 Item/Source/Pack 体系中完全剥离，建立独立的数据模型、Pipeline、API 和前端页面。

## 数据模型

### Tweet

存储推文原始数据和 AI 增强结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| tweetId | String (unique) | X 平台推文 ID |
| tab | String | 来源: home / bookmarks / likes / lists |
| text | String (Text) | 推文全文 |
| url | String | x.com/{handle}/status/{tweetId} |
| expandedUrl | String? | t.co 短链接还原后的 URL |
| publishedAt | DateTime? (Timestamptz) | 推文发布时间 |
| fetchedAt | DateTime (Timestamptz) | 抓取时间 |
| authorHandle | String | @handle |
| authorName | String? | 显示名称 |
| authorId | String? | X 平台用户 ID |
| conversationId | String? | 会话 ID |
| likeCount | Int | 点赞数 (bird CLI 返回) |
| replyCount | Int | 回复数 |
| retweetCount | Int | 转发数 |
| summary | String? (Text) | AI 摘要 |
| bullets | String[] | AI 关键要点 |
| categories | String[] | AI 分类标签 |
| score | Float | AI 评分 (默认 5.0) |
| mediaJson | String? (Text) | 媒体: [{type, url, previewUrl}] |
| quotedTweetJson | String? (Text) | 引用推文完整对象 |
| threadJson | String? (Text) | Thread 列表 |
| parentJson | String? (Text) | 父推文 |
| articleJson | String? (Text) | 文章预览: {title, url, previewText} |
| createdAt | DateTime (Timestamptz) | |
| updatedAt | DateTime (Timestamptz) | |

索引: tab, fetchedAt, score。

### TweetBookmark

1:1 toggle 收藏模式。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| tweetId | String (unique) | 关联 Tweet.id |
| bookmarkedAt | DateTime (Timestamptz) | 收藏时间 |

级联删除: Tweet 删除时自动删除对应收藏。

### XPageConfig

统一管理每个 tab 的 pipeline 参数、enrichment 开关和页面展示配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| tab | String (unique) | home / bookmarks / likes / lists |
| enabled | Boolean | 是否启用 |
| birdMode | String | bird CLI 模式 |
| count | Int | 每次抓取数量 |
| fetchAll | Boolean | 是否全量抓取 |
| maxPages | Int? | 最大翻页数 |
| authTokenEnv | String? | auth token 环境变量名 |
| ct0Env | String? | ct0 cookie 环境变量名 |
| listsJson | String? (Text) | lists tab 专用: [{listId, name}] |
| filterPrompt | String? (Text) | AI 过滤 prompt |
| enrichEnabled | Boolean | 启用 enrichment |
| enrichScoring | Boolean | AI 评分 |
| enrichKeyPoints | Boolean | AI 要点提取 |
| enrichTagging | Boolean | AI 分类标签 |
| timeWindow | String | 默认时间窗口 (week) |
| sortOrder | String | 默认排序 (ranked) |
| updatedAt | DateTime (Timestamptz) | |

## Pipeline

### X 独立 Cron

路径: `app/api/cron/collect-x/route.ts`，每 30 分钟执行。

流程:
1. 从 XPageConfig 表读取所有 enabled 的 tab 配置
2. 对每个 tab 调用 `collectXBirdSource(config)` 收集数据
3. 对 lists tab，遍历 `listsJson` 中的每个 list 分别调用
4. `archiveTweets(rawItems, tab)` 写入 Tweet 表
5. `enrichTweets(newTweetIds, aiClient, config)` AI 增强

### 去重策略

`archiveTweets()` 使用 Prisma upsert 以 `tweetId` 为唯一键处理重复。同一 tweetId 重复抓取时更新已有记录（刷新 engagement 数据和 fetchedAt）。同一 tweetId 出现在不同 tab 时，保留最新一次抓取的 tab 值。

### 错误处理

各 tab 独立处理，单个 tab 的收集或归档失败不影响其他 tab。失败信息记录到 cron 响应日志中，不中断整体流程。参考现有 `collect/route.ts` 中 `failedSources` 的独立记录模式。

复用: `verifyCronRequest()`、`runAfterJob()`、`collectXBirdSource()`、`createAiClient()`。

不依赖: Source/Pack 表、`loadAllPacksFromDb()`。

### AI Enrichment

定制推文专用 prompt，判断:
- 是否是 thread、是否含文章链接、是否值得深入阅读
- 评分 + 摘要 + 要点 + 分类标签

根据 XPageConfig 的 enrich* 开关控制各步骤。

### 清理主 Pipeline

- SourceType 类型定义移除 x-home、x-list、x-bookmarks、x-likes
- ADAPTER_FAMILIES 移除 x 系列注册
- collect/route.ts 移除所有 x 相关 import 和逻辑
- collectXBirdSource() 保留在 adapter 文件，只被 X cron import

### 迁移现有 X 数据

现有 Item/Source 表中存在 x-* 相关数据，清理顺序:

1. 先删除 Item 表中 `sourceType IN ('x-home', 'x-list', 'x-bookmarks', 'x-likes')` 的记录
2. 再删除 Source 表中对应的 x-* 记录
3. 删除 config/packs/x-*.yaml 配置文件

原因: Item -> Source 外键关系无 onDelete 级联，必须先删 Item 再删 Source，否则外键约束报错。现有 x-* Item 数据不做迁移（历史数据价值低，新 pipeline 会重新收集）。

## API

| Endpoint | 方法 | 功能 |
|----------|------|------|
| /api/tweets | GET | 列表: tab, window, sort (ranked/recent/engagement), page, pageSize, search |
| /api/tweet-bookmarks | GET | 收藏列表 |
| /api/tweet-bookmarks/[id] | POST/DELETE | 收藏 toggle |
| /api/x-config | GET | 获取配置 (全部或指定 tab) |
| /api/x-config | PUT | 更新配置 (per-tab) |

API client 扩展遵循现有 `fetchApi<T>()` 模式。

## 前端

### 导航

侧边栏新增「社交」分组，包含 "X / Twitter" 入口。Tab 切换器 (Bookmarks / Likes / Home / Lists) 以 pill 样式嵌入 topbar，与过滤/搜索/排序/配置按钮同行。

### TweetCard (详情卡片)

始终展示的 AI 区域:
- AI 摘要 (summary)
- 关键要点 (bullets)
- 分类标签 (categories)

卡片底部: engagement 数据 (❤ 💬 🔁) + 收藏 toggle + 跳转 X 原站按钮。

引用推文: 缩进嵌套卡片，含引用的 author + engagement。
媒体: 图片网格 / 视频。
文章预览: 标题卡片。

点击跳转 X 原站，不做本地 ReadingPanel。

### XPageConfig 初始化

首次访问时自动创建默认 XPageConfig 记录 (4 个 tab 各一条)。

## 新建文件 (12)

| 文件 | 用途 |
|------|------|
| app/api/cron/collect-x/route.ts | X 独立 cron |
| app/api/tweets/route.ts | Tweet 列表 API |
| app/api/tweet-bookmarks/route.ts | Tweet 收藏列表 |
| app/api/tweet-bookmarks/[id]/route.ts | Tweet 收藏增删 |
| app/api/x-config/route.ts | X 配置 API |
| app/x/page.tsx | X 路由页面 |
| components/x-page.tsx | X 主页面 (tabs + feed) |
| components/tweet-card.tsx | 推文卡片 |
| src/archive/upsert-tweet-prisma.ts | Tweet 归档 |
| src/archive/enrich-tweet-prisma.ts | Tweet AI 增强 |
| lib/tweet-utils.ts | 推文工具函数 (formatEngagement 等) |
| hooks/use-x-config.ts | X 配置 SWR hook |

## 修改文件

| 文件 | 变更 |
|------|------|
| prisma/schema.prisma | +Tweet, TweetBookmark, XPageConfig |
| lib/types.ts | +Tweet 类型, SourceType 移除 x-* |
| lib/api-client.ts | +fetchTweets, fetchXConfig 等 |
| src/types/index.ts | SourceType 移除 x-* |
| src/adapters/x-bird.ts | 主 pipeline 不再 import 此文件 |
| components/sidebar.tsx | +社交分组 + X 入口 |
| components/topbar.tsx | +x 页面标题 |
| vercel.json | +X cron |

## 验证

1. pnpm exec prisma db push
2. pnpm check
3. pnpm build
4. 触发 X cron 测试数据收集
5. 验证 Tweet API
6. playwriter 验证前端
