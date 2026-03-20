# 数据库配置系统设计文档

**日期**: 2026-03-20
**状态**: 已批准
**作者**: Claude + 用户协作设计

## 概述

将 Information Aggregator 从 YAML 文件配置迁移到纯数据库配置，实现完全的 UI 化配置管理。

## 目标

1. **用户友好** - 非技术用户也能在 UI 中完成所有配置
2. **实时生效** - 配置修改无需重启服务
3. **简化代码** - 去掉复杂的 YAML 加载逻辑
4. **统一管理** - 所有配置集中在一个数据源

## 架构变更

### 当前架构（YAML 混合）

```
config/
├── packs/              # Pack 和 Source 配置
│   ├── ai-llm.yaml
│   └── frontend.yaml
├── settings.yaml       # AI 模型配置
├── scheduler.yaml      # 定时任务配置
├── reports/            # 报告配置
│   ├── daily.yaml
│   └── weekly.yaml
└── auth/               # 认证配置
    └── x-family.yaml

代码: loadAllPacks() + Prisma 混合逻辑
```

### 新架构（纯数据库）

```
数据库表:
- Pack, Source, SourceHealth
- CustomView, CustomViewPack
- Settings
- SchedulerJob
- DailyReportConfig, WeeklyReportConfig
- AuthConfig

代码: Prisma 统一查询
```

## 数据模型设计

### 1. Pack 和 Source 管理

#### Pack 表 - 主题包
```prisma
model Pack {
  id          String   @id
  name        String
  description String?

  sources     Source[]           // 一个 Pack 有多个 Source
  customViews CustomViewPack[]   // 一个 Pack 可被多个 CustomView 引用

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Source 表 - 数据源
```prisma
model Source {
  id          String   @id
  type        String        // rss, json, twitter, etc.
  name        String
  url         String?
  description String?
  enabled     Boolean  @default(true)  // UI 可启停
  configJson  String?      @db.Text

  packId      String?
  pack        Pack?    @relation(fields: [packId], references: [id])

  items       Item[]
  health      SourceHealth?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### SourceHealth 表 - 数据源健康状态
```prisma
model SourceHealth {
  id                  String   @id @default(cuid())
  sourceId            String   @unique
  lastSuccessAt       DateTime?
  lastFailureAt       DateTime?
  lastError           String?  @db.Text
  consecutiveFailures Int      @default(0)

  source              Source   @relation(fields: [sourceId], references: [id])
  updatedAt           DateTime @updatedAt
}
```

**关系说明**：
- Pack → Source (1:N): 一个 Pack 包含多个 Source
- Source → Item (1:N): 一个 Source 生成多个 Item

### 2. 自定义视图

#### CustomView 表 - 自定义视图
```prisma
model CustomView {
  id          String   @id
  name        String
  icon        String
  description String?
  filterJson  String?  @db.Text  // 过滤规则: 时间范围、分数阈值等

  packs       CustomViewPack[]  // 关联多个 Pack

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### CustomViewPack 表 - 视图与 Pack 的关联表
```prisma
model CustomViewPack {
  id        String     @id @default(cuid())
  viewId    String
  packId    String

  view      CustomView @relation(fields: [viewId], references: [id], onDelete: Cascade)
  pack      Pack       @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@unique([viewId, packId])
  @@index([viewId])
}
```

**关系说明**：
- CustomView → Pack (N:M): 一个视图可聚合多个 Pack
- Pack → CustomView (N:M): 一个 Pack 可被多个视图使用

**业务场景**：
```
CustomView: "晨间必读"
├─ Pack: "AI与大模型"
└─ Pack: "前端与工程"

CustomView: "摸鱼快看"
├─ Pack: "AI与大模型"
└─ Pack: "产品与设计"
```

**数据查询流程**：
1. 查询 CustomView 关联的 Pack IDs
2. 查询这些 Pack 下的所有 Source
3. 查询这些 Source 的 Item
4. 应用 filterJson 中的过滤规则
5. 返回聚合后的文章列表

### 3. 全局设置

#### Settings 表 - AI 和全局配置
```prisma
model Settings {
  id                String   @id @default("default")

  defaultProvider   String   @default("anthropic")
  defaultBatchSize  Int      @default(3)
  defaultConcurrency Int     @default(1)

  maxRetries        Int      @default(3)
  initialDelay      Int      @default(1000)
  maxDelay          Int      @default(30000)
  backoffFactor     Float    @default(2.0)

  anthropicConfig   String?  @db.Text  // JSON: { authToken, model, baseUrl }
  geminiConfig      String?  @db.Text
  openaiConfig      String?  @db.Text

  updatedAt DateTime @updatedAt
}
```

**配置项**：
- AI Provider 选择
- 批次大小和并发控制
- 重试策略（次数、延迟、退避）
- 各 Provider 的 API 配置（token、model、baseUrl）

### 4. 定时任务

#### SchedulerJob 表 - 定时任务配置
```prisma
model SchedulerJob {
  id          String    @id
  name        String
  cron        String
  description String?
  enabled     Boolean   @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?

  updatedAt DateTime @updatedAt
}
```

**预设任务**：
- `fetch-and-process`: 每30分钟抓取数据
- `daily-report`: 每天6:30生成日报
- `weekly-report`: 每周一7:00生成周报

### 5. 报告配置

#### DailyReportConfig 表 - 日报配置
```prisma
model DailyReportConfig {
  id                  String   @id @default("default")

  packs               String   @default("all")  // "all" or comma-separated IDs
  maxItems            Int      @default(20)
  maxSpotlight        Int      @default(3)
  sort                String   @default("ranked")  // ranked | chronological

  enableOverview      Boolean  @default(true)

  newsFlashesEnabled  Boolean  @default(true)
  newsFlashesMaxCount Int      @default(12)

  updatedAt DateTime @updatedAt
}
```

#### WeeklyReportConfig 表 - 周报配置
```prisma
model WeeklyReportConfig {
  id                String   @id @default("default")

  days              Int      @default(7)
  maxTimelineEvents Int      @default(10)
  maxDeepDives      Int      @default(5)

  enableEditorial   Boolean  @default(true)

  updatedAt DateTime @updatedAt
}
```

**设计考虑**：
- 日报和周报配置分离，因为未来扩展方向不同
- 日报可能增加：AI 摘要、时区设置
- 周报可能增加：趋势分析、热度图、周末包含设置

### 6. 认证配置

#### AuthConfig 表 - 认证配置
```prisma
model AuthConfig {
  id         String   @id @default("default")
  adapter    String         // x_family, etc.
  configJson String   @db.Text

  updatedAt DateTime @updatedAt
}
```

## API 设计

### Pack 管理
- `GET /api/packs` - 获取所有 Pack 及其 Sources
- `POST /api/packs` - 创建新 Pack
- `PUT /api/packs/:id` - 更新 Pack
- `DELETE /api/packs/:id` - 删除 Pack

### Source 管理
- `GET /api/sources` - 获取所有 Sources
- `POST /api/sources` - 创建新 Source
- `PATCH /api/sources/:id` - 更新 Source（包括启停）
- `DELETE /api/sources/:id` - 删除 Source

### CustomView 管理
- `GET /api/custom-views` - 获取所有自定义视图
- `POST /api/custom-views` - 创建自定义视图
- `PUT /api/custom-views/:id` - 更新视图
- `DELETE /api/custom-views/:id` - 删除视图

### 视图数据查询
- `GET /api/views/:id` - 获取视图聚合的文章列表
  - 查询关联的 Pack IDs
  - 获取这些 Pack 的 Sources
  - 查询 Items 并应用过滤规则

### 全局设置
- `GET /api/settings` - 获取全局配置
- `PUT /api/settings` - 更新全局配置
- `POST /api/settings/test-connection` - 测试 AI Provider 连接

### 定时任务
- `GET /api/scheduler/jobs` - 获取所有任务
- `PATCH /api/scheduler/jobs/:id` - 更新任务（启停、cron）
- `POST /api/scheduler/jobs/:id/trigger` - 手动触发

### 报告配置
- `GET /api/reports/daily/config` - 获取日报配置
- `PUT /api/reports/daily/config` - 更新日报配置
- `POST /api/reports/daily/generate` - 手动生成日报
- `GET /api/reports/weekly/config` - 获取周报配置
- `PUT /api/reports/weekly/config` - 更新周报配置
- `POST /api/reports/weekly/generate` - 手动生成周报

## UI 设计

### 配置页面布局 (`/config`)

**三个 Tab 切换**：

#### Tab 1: 引擎配置
**左侧面板 - Pack 树形列表**：
```
├─ AI 与大模型 (Pack)
│  ├─ The Verge · AI [RSS] [●]  ← 启用/禁用开关
│  ├─ Anthropic Blog [RSS] [●]
│  └─ OpenAI News [RSS] [○]
│  [+ 添加数据源]
├─ 前端与工程 (Pack)
│  ├─ Vercel Blog [RSS] [●]
│  └─ web.dev [RSS] [●]

[+ 新建 Pack]
```

功能：
- 创建/删除 Pack
- 添加/删除 Source
- Source 启用/禁用开关
- 点击 Pack 显示详情配置

**右侧面板 - Pack 详情配置**：
- Pack 名称、描述
- 关键词配置
- AI Prompt 策略
- 保存/重置按钮

**创建自定义视图按钮**：
- 视图名称、图标、描述
- 选择 Pack（多选）
- 配置过滤规则
- 保存

#### Tab 2: 参数配置

**AI 配置区域**：
- 默认 Provider 选择
- 批次大小、并发数
- 重试策略配置
- Provider 配置（API Token、Model、Base URL）
- [测试连接] 按钮

**定时任务区域**：
- 任务列表（可启用/禁用）
- Cron 表达式编辑
- 上次运行/下次运行时间
- [手动触发] 按钮

**报告配置区域**：
- 日报配置
- 周报配置
- [立即生成] 按钮

#### Tab 3: 认证配置
- Adapter 选择
- 配置参数
- [测试认证] 按钮

### 自定义视图展示

**侧边栏** (`components/sidebar.tsx`)：
- 从 `/api/custom-views` 动态加载视图列表
- 点击跳转到 `/view/:id`

**视图页面** (`app/view/[id]/page.tsx`)：
- 显示视图名称、图标、描述
- 展示聚合的文章列表
- 保存/分享功能

## 数据迁移

### 迁移脚本

**位置**: `scripts/migrate-all-yaml-to-db.ts`

**步骤**：
1. 读取 `config/packs/*.yaml` → Pack + Source 表
2. 读取 `config/settings.yaml` → Settings 表
3. 读取 `config/scheduler.yaml` → SchedulerJob 表
4. 读取 `config/reports/daily.yaml` → DailyReportConfig 表
5. 读取 `config/reports/weekly.yaml` → WeeklyReportConfig 表
6. 读取 `config/auth/x-family.yaml` → AuthConfig 表

**迁移完成后**：
- 删除 `config/` 目录
- 删除 `loadAllPacks()`、`loadSettings()` 等 YAML 加载代码
- 更新所有配置读取为 Prisma 查询

### 代码更新

**之前**：
```typescript
import { loadAllPacks } from '../config/load-pack'
const packs = await loadAllPacks('config/packs')
```

**之后**：
```typescript
import { prisma } from '@/lib/prisma'
const packs = await prisma.pack.findMany({
  include: { sources: true }
})
```

## 实施计划

### Phase 1: 数据库 Schema
1. 创建新的 Prisma schema
2. 运行 `prisma migrate dev`
3. 验证表结构

### Phase 2: 数据迁移
1. 编写迁移脚本
2. 测试迁移（备份当前数据库）
3. 执行迁移
4. 验证数据完整性

### Phase 3: API 实现
1. 实现 Pack/Source CRUD API
2. 实现 CustomView API
3. 实现配置查询 API
4. 实现视图数据聚合 API

### Phase 4: UI 实现
1. 重构 ConfigPage 组件
2. 实现 Tab 切换
3. 实现各配置区域的表单
4. 实现自定义视图创建流程
5. 更新侧边栏动态加载

### Phase 5: 清理
1. 删除 YAML 配置文件
2. 删除 YAML 加载代码
3. 更新所有配置读取逻辑
4. 测试完整功能

## 优势

1. **用户友好** - 非技术用户也能轻松配置
2. **实时生效** - 配置修改立即生效
3. **代码简化** - 去掉复杂的 YAML 混合逻辑
4. **统一管理** - 单一数据源，无同步问题
5. **可扩展性** - 容易添加新的配置项
6. **审计追踪** - 可以添加配置变更历史

## 风险与缓解

**风险 1: 数据库性能**
- 缓解: 添加适当的索引（已在 schema 中标注）
- 缓解: 对频繁查询的配置使用缓存

**风险 2: 敏感信息存储**
- 缓解: API Token 等敏感信息考虑加密存储
- 缓解: 添加访问控制（未来）

**风险 3: 迁移失败**
- 缓解: 迁移前完整备份数据库
- 缓解: 编写回滚脚本

## 后续优化

1. **配置版本控制** - 记录配置变更历史
2. **配置导出/导入** - 支持导出为 JSON 备份
3. **配置预览** - 修改前预览效果
4. **批量操作** - 批量启用/禁用 Source
5. **配置模板** - 预设的 Pack 模板
6. **权限控制** - 不同用户角色的配置权限

## 总结

本设计方案将 Information Aggregator 从 YAML 文件配置完全迁移到数据库配置，实现了：
- ✅ 完全的 UI 化管理
- ✅ 配置实时生效
- ✅ 代码简化
- ✅ 统一的数据源
- ✅ 良好的可扩展性

该设计支持核心业务场景：
- Pack/Source 的完整生命周期管理
- 基于多 Pack 聚合的自定义视图
- 灵活的 AI 和定时任务配置
- 可扩展的日报/周报配置
