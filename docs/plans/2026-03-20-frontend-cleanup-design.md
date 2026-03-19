# 前端清理与文档重构设计方案

## 概述

本次重构解决三个核心问题：
1. 数据模式：从混合模式转为纯真实模式
2. 目录结构：修复 `app/app/` 嵌套导致的 URL 问题
3. 文档更新：重写过时文档，反映当前 Next.js 架构

## 1. 数据模式重构

### 当前状态
- `/api/items` - 纯真实数据（Prisma + Supabase）
- `/api/daily`、`/api/weekly` 等 - 混合模式，数据不足时 fallback 到 mock

### 目标状态
- 所有 API 纯真实数据
- 数据库无数据时返回空数组
- 前端显示空态 UI

### 改动清单

| 文件 | 改动 |
|------|------|
| `app/app/api/daily/route.ts` | 移除 mock import 和 fallback 逻辑 |
| `app/app/api/weekly/route.ts` | 移除 mock import 和 fallback 逻辑 |
| `app/app/api/news-flashes/route.ts` | 移除 mock import 和 fallback 逻辑 |
| `app/lib/mock-data.ts` | 删除文件 |

### 新增文档
创建 `docs/api-data-formats.md`，记录 API 响应格式，供开发者参考：

```markdown
# API 数据格式参考

## Items API
- GET /api/items - 列表查询
- 响应结构: { success, data: { items, sources }, meta }

## Daily API
- GET /api/daily - 日报数据
- 响应结构: { success, data: { overview, spotlightArticles, recommendedArticles, newsFlashes }, meta }
```

## 2. 目录结构重构

### 当前结构（问题）
```
app/
├── app/           # Next.js App Router
│   ├── api/       # → /app/api/*
│   ├── page.tsx   # → /app
│   └── ...
├── components/
├── hooks/
└── lib/
```

### 目标结构
```
information-aggregator/
├── app/              # Next.js App Router (根目录)
│   ├── api/          # → /api/*
│   ├── daily/        # → /daily
│   ├── weekly/       # → /weekly
│   ├── layout.tsx
│   └── page.tsx      # → /
├── components/       # React 组件
├── hooks/            # React hooks
├── lib/              # 前端工具库
├── src/              # 后端代码（保持不变）
├── prisma/           # 数据库 schema
└── config/           # 配置文件
```

### 改动清单

1. 移动 `app/app/*` → `app/*`
2. 移动 `app/components/` → `components/`
3. 移动 `app/hooks/` → `hooks/`
4. 移动 `app/lib/` → `lib/`
5. 删除空的 `app/app/` 目录
6. 更新所有 import 路径（`@/lib/*` 路径可能需要调整 tsconfig）

### tsconfig.json 更新

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## 3. 文档重构

### AGENTS.md（重写）

内容结构：
1. 项目架构概述 - Next.js App Router + Prisma + Supabase
2. 目录结构说明
3. 开发规范
   - 代码风格
   - Git 工作流
   - 测试要求
4. 测试流程（融合 TEST.md）
   - `pnpm build` - 构建验证
   - `pnpm lint` - 代码检查
   - 前端验证要求
5. AI 协作指南
   - 任务拆分原则
   - 代码审查要求

### README.md（重写）

内容结构：
1. 项目简介 - Information Aggregator 是什么
2. 快速开始
   - 环境要求
   - 安装依赖
   - 配置环境变量
   - 启动开发服务器
3. 功能特性
4. 前端入口
   - `/` - 日报首页
   - `/daily` - 日报详情
   - `/weekly` - 周报
   - `/saved` - 收藏
5. 配置说明
6. 部署指南

### TEST.md（删除）

内容融合到 AGENTS.md 的「测试流程」章节。

### 文件变更清单

| 文件 | 操作 |
|------|------|
| `AGENTS.md` | 重写 |
| `README.md` | 重写 |
| `TEST.md` | 删除 |
| `docs/api-data-formats.md` | 新建 |

## 实施顺序

1. **Phase 1: 目录重构** - 移动文件，更新 import 路径
2. **Phase 2: 数据模式** - 移除 mock，创建格式文档
3. **Phase 3: 文档更新** - 重写 README/AGENTS，删除 TEST

## 风险评估

| 风险 | 缓解措施 |
|------|----------|
| import 路径遗漏 | 构建验证 + TypeScript 检查 |
| Vercel 部署失败 | 更新 vercel.json 配置 |
| 空态 UI 不完善 | 确认空态组件已实现 |
