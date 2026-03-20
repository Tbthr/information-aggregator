# 数据库 Schema 重构设计

## 背景

经过数据库字段核验，发现以下问题需要修复：

| # | 问题 | 影响 |
|---|------|------|
| 1 | `Source.id` 使用自定义 ID 非 cuid | 数据一致性 |
| 2 | `Settings` 三个 provider config 是字段而非记录 | 扩展性差 |
| 3 | `Settings` 字段有 `default` 前缀 | 命名不规范 |
| 4 | `Item.id` 使用 URL 作为主键 | 数据一致性 |
| 5 | `Item.packId` 为 null 丢失关联 | 数据完整性 |
| 6 | `DailyOverview.spotlightIds` 功能冗余 | 需移除 |
| 7 | `AuthConfig` 前端无展示 | 功能缺失 |

---

## 修改方案

### 1. 移除 Spotlight 功能

**原因**: spotlight 逻辑增加了复杂度，但实际价值有限，前端合并展示即可。

#### 1.1 Schema 修改

**prisma/schema.prisma**

```prisma
// DailyOverview - 移除 spotlightIds
model DailyOverview {
  id           String   @id @default(cuid())
  date         String   @unique
  dayLabel     String
  summary      String   @db.Text

  itemIds      String[]  // 只保留 itemIds

  createdAt    DateTime @default(now())
}

// DailyReportConfig - 移除 maxSpotlight
model DailyReportConfig {
  id                  String   @id @default("default")

  packs               String   @default("all")
  maxItems            Int      @default(20)
  // 移除: maxSpotlight
  sort                String   @default("ranked")

  enableOverview      Boolean  @default(true)

  newsFlashesEnabled  Boolean  @default(true)
  newsFlashesMaxCount Int      @default(12)

  updatedAt DateTime @updatedAt
}
```

#### 1.2 后端代码修改

| 文件 | 修改内容 |
|------|---------|
| `src/reports/daily.ts` | 移除 spotlight 选择逻辑，移除 spotlightIds 存储 |
| `src/reports/weekly.ts` | 移除 spotlightIds |
| `src/cli/commands/daily.ts` | 移除 spotlightCount 输出 |
| `src/config/reports-schema.ts` | 移除 maxSpotlight |
| `config/reports/daily.yaml` | 移除 maxSpotlight 配置 |

#### 1.3 API 修改

**app/api/daily/route.ts**

```typescript
// 修改前
return {
  overview,
  spotlightArticles,  // 移除
  recommendedArticles,
  newsFlashes,
}

// 修改后
return {
  overview,
  articles,  // 合并，只返回 articles
  newsFlashes,
}
```

#### 1.4 前端修改

| 文件 | 修改内容 |
|------|---------|
| `lib/api-client.ts` | 移除 spotlightArticles，改为单一 articles |
| `components/daily-page.tsx` | 移除 spotlight 特殊展示逻辑 |

---

### 2. Settings 表重构

**现状**:
```prisma
model Settings {
  defaultProvider   String   @default("anthropic")
  defaultBatchSize  Int      @default(3)
  ...
  anthropicConfig   String?  @db.Text
  geminiConfig      String?  @db.Text
  openaiConfig      String?  @db.Text
}
```

**目标**:
```prisma
model Settings {
  id            String   @id @default("default")

  provider      String   @default("anthropic")
  batchSize     Int      @default(3)
  concurrency   Int      @default(1)

  maxRetries    Int      @default(3)
  initialDelay  Int      @default(1000)
  maxDelay      Int      @default(30000)
  backoffFactor Float    @default(2.0)

  updatedAt DateTime @updatedAt
}

// 新增 ProviderConfig 表
model ProviderConfig {
  id          String   @id @default(cuid())
  provider    String   // anthropic, gemini, openai
  model       String
  baseUrl     String?
  apiKeyRef   String?  // 环境变量引用或加密存储
  extraConfig String?  @db.Text  // 其他配置

  updatedAt DateTime @updatedAt

  @@unique([provider])  // 每个 provider 一条记录
}
```

**迁移策略**:
1. 创建新表 ProviderConfig
2. 从 Settings 中提取三个 provider 配置，迁移到 ProviderConfig
3. 删除 Settings 中的三个 config 字段
4. 重命名 Settings 字段（移除 default 前缀）

---

### 3. Source.id 迁移到 cuid

**现状**: `Source.id` 使用如 `www-infoq-cn-feed` 的自定义 ID

**目标**: 使用 cuid 格式如 `cmmyo2f6c0001nnglhf1kmbwv`

**影响范围**:
- `Source` 表: 主键变更
- `Item` 表: `sourceId` 外键
- `SourceHealth` 表: `sourceId` 外键
- 所有引用 Source.id 的代码

**迁移策略**:
1. 添加新字段 `Source.newId` (cuid)
2. 创建 Source 时生成 cuid
3. 更新所有外键引用
4. 切换主键到 newId
5. 更新所有代码中的 Source ID 引用

**需要修改的代码**:
- `scripts/migrate-yaml-to-db.ts` - 迁移脚本
- `src/fetcher/*.ts` - 创建 Source 时生成 cuid
- `app/api/sources/*.ts` - API 路由
- 配置文件中的 Source ID 引用

---

### 4. Item 表修改

#### 4.1 Item.id 改为 cuid

**现状**: 使用 URL 作为 ID
```typescript
id: "https://i.buzzing.cc/ft/posts/2026/..."
```

**目标**: 使用 cuid
```typescript
id: "cmmyyhmwo0004nne27wzlubp0"
url: "https://i.buzzing.cc/ft/posts/2026/..."
canonicalUrl: "https://www.ft.com/content/..."
```

**影响**:
- `Bookmark` 表的 `itemId` 外键
- `DailyOverview` 的 `itemIds` 数组
- `TimelineEvent` 的 `itemIds` 数组

#### 4.2 Item.packId 从 source 继承

**现状**: `Item.packId` 为 null

**目标**: 创建 Item 时从 Source 获取 packId

```typescript
// src/fetcher 中创建 Item 时
const item = await prisma.item.create({
  data: {
    // ...
    packId: source.packId,  // 从 source 继承
  }
})
```

---

### 5. AuthConfig 前端展示

**需求**: 在 Pack 信息页面添加 Auth 配置展示和编辑

**实现位置**: `components/config-page.tsx` 或新建 `components/pack-auth-config.tsx`

**功能**:
- 展示当前 Pack 关联的 Auth 配置
- 无配置时显示 "无"
- 支持编辑 Auth 配置

**API**:
- `GET /api/auth-config` - 获取 Auth 配置
- `PUT /api/auth-config` - 更新 Auth 配置

---

## 实施顺序

| 阶段 | 内容 | 风险 |
|------|------|------|
| 1 | 移除 Spotlight 功能 | 低 |
| 2 | Settings 表重构 | 中 |
| 3 | Item.packId 继承逻辑 | 低 |
| 4 | Item.id 迁移到 cuid | 高 |
| 5 | Source.id 迁移到 cuid | 高 |
| 6 | AuthConfig 前端展示 | 低 |

---

## 数据迁移脚本

```sql
-- 阶段 1: 移除 spotlightIds
ALTER TABLE "DailyOverview" DROP COLUMN "spotlightIds";
ALTER TABLE "DailyReportConfig" DROP COLUMN "maxSpotlight";

-- 阶段 2: 创建 ProviderConfig 表并迁移数据
-- (详见迁移文件)
```

---

## 回滚策略

每个阶段完成后备份数据库，出现问题可回滚到上一阶段快照。
