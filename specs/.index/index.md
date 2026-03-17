# Codebase Index

**项目**: information-aggregator  
**索引时间**: 2026-03-18  
**版本**: 1.0.0

## 项目概述

Information Aggregator 是一个智能信息聚合器，从多源（RSS、JSON Feed、GitHub Trending、X/Twitter 等）收集内容，通过 AI 增强处理，生成日报/周报视图。

## 技术栈

- **后端**: TypeScript + Bun + Hono
- **前端**: React + Vite + Tailwind CSS
- **数据库**: SQLite (bun:sqlite)
- **AI**: Anthropic/Gemini/OpenAI API

## 组件索引

### 模型 (Models)

| 组件 | 文件 | 描述 |
|------|------|------|
| [Types](components/model-types.md) | src/types/index.ts | 核心类型定义 |

### 服务 (Services)

| 组件 | 文件 | 描述 |
|------|------|------|
| [Adapter Registry](components/service-adapters.md) | src/adapters/registry.ts | 数据源适配器管理 |
| [Pipeline Collect](components/service-pipeline-collect.md) | src/pipeline/collect.ts | 数据收集管道 |
| [AI Client](components/service-ai-client.md) | src/ai/client.ts | AI 客户端入口 |

### 控制器 (Controllers)

| 组件 | 文件 | 描述 |
|------|------|------|
| [API Server](components/controller-api.md) | src/api/server.ts | REST API 服务器 |

### 前端 (Frontend)

| 组件 | 文件 | 描述 |
|------|------|------|
| [App](components/frontend-app.md) | frontend/src/App.tsx | React 应用入口 |
| [API Client](components/frontend-api.md) | frontend/src/lib/api.ts | 前端 API 客户端 |

## 外部资源索引

### MCP 服务器

| 资源 | 描述 |
|------|------|
| [Playwright MCP](external/mcp-playwright.md) | 浏览器自动化 |

### Skills

| 资源 | 描述 |
|------|------|
| [Ralph Specum](external/skill-ralph-specum.md) | 规格驱动开发技能集 |

## 目录结构

```
src/
├── adapters/     # 数据源适配器
├── ai/           # AI 客户端和提示词
├── api/          # REST API 路由
├── cache/        # 内容缓存
├── cli/          # 命令行工具
├── config/       # 配置加载
├── db/           # 数据库查询
├── pipeline/     # 处理管道
├── policy/       # 策略过滤
├── query/        # 查询解析
├── types/        # 类型定义
├── utils/        # 工具函数
├── verification/ # 冒烟测试
└── views/        # 视图生成

frontend/src/
├── components/   # React 组件
├── hooks/        # 自定义 Hooks
├── lib/          # 工具库
├── pages/        # 页面组件
└── types/        # 类型定义
```

## 统计

| 类别 | 数量 |
|------|------|
| 模型 | 1 |
| 服务 | 3 |
| 控制器 | 1 |
| 前端 | 2 |
| MCP 服务器 | 1 |
| Skills | 1 |
| **总计** | **9** |

---

*此索引由 Ralph Specum `/ralph-specum:index` 命令自动生成*
