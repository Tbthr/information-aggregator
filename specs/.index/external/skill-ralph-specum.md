---
name: Ralph Specum Skills
description: Ralph 规格驱动开发技能集
source_type: skill
source_id: ralph-specum
fetch_timestamp: 2026-03-18
---

# Ralph Specum Skills

## 概述

Ralph Specum 是一套规格驱动开发的技能集，提供从研究到实现的完整工作流。

## 核心技能

### 工作流入口

| 技能 | 描述 |
|------|------|
| `/ralph-specum:start` | 智能入口，检测新建或恢复规格 |
| `/ralph-specum:new` | 创建新规格并开始研究阶段 |
| `/ralph-specum:status` | 显示所有规格状态 |
| `/ralph-specum:switch` | 切换活动规格 |
| `/ralph-specum:cancel` | 取消活动执行循环 |

### 阶段命令

| 技能 | 阶段 | 描述 |
|------|------|------|
| `/ralph-specum:research` | 研究 | 运行/重跑研究阶段 |
| `/ralph-specum:requirements` | 需求 | 从目标和研究生成需求 |
| `/ralph-specum:design` | 设计 | 从需求生成技术设计 |
| `/ralph-specum:tasks` | 任务 | 从设计生成实现任务 |
| `/ralph-specum:implement` | 实现 | 开始任务执行循环 |
| `/ralph-specum:refactor` | 重构 | 执行后更新规格文件 |

### 辅助技能

| 技能 | 描述 |
|------|------|
| `/ralph-specum:index` | 索引代码库组件 |
| `/ralph-specum:triage` | 分解大型功能为多个规格 |
| `/ralph-specum:help` | 显示帮助信息 |
| `/ralph-specum:feedback` | 提交反馈 |

### 验证与审查

| 技能 | 描述 |
|------|------|
| `/ralph-specum:reality-verification` | 验证修复，重现失败 |
| `/ralph-specum:interview-framework` | 交互式访谈框架 |

## 子代理

| 代理 | 角色 |
|------|------|
| `research-analyst` | 研究分析师 |
| `product-manager` | 产品经理 |
| `architect-reviewer` | 架构师审查 |
| `task-planner` | 任务规划师 |
| `spec-executor` | 规格执行者 |
| `qa-engineer` | QA 工程师 |
| `spec-reviewer` | 规格审查员 |
| `refactor-specialist` | 重构专家 |
| `triage-analyst` | 分流分析师 |

## 关键词

ralph, specum, skill, spec-driven, workflow, research, requirements, design, tasks

## 相关文档

- [AGENTS.md](AGENTS.md) - 项目代理配置
- [ralph/](ralph/) - Ralph 配置目录
