---
name: Playwright MCP
description: Playwright 浏览器自动化 MCP 服务器
source_type: mcp
source_id: playwright
fetch_timestamp: 2026-03-18
---

# Playwright MCP Server

## 概述

Playwright MCP 提供浏览器自动化能力，用于 E2E 测试和页面交互。

## 可用工具

### 导航与快照

| 工具 | 描述 |
|------|------|
| `browser_navigate` | 导航到 URL |
| `browser_navigate_back` | 返回上一页 |
| `browser_snapshot` | 获取页面可访问性快照 |
| `browser_take_screenshot` | 截取页面截图 |

### 交互操作

| 工具 | 描述 |
|------|------|
| `browser_click` | 点击元素 |
| `browser_type` | 输入文本 |
| `browser_hover` | 悬停元素 |
| `browser_press_key` | 按键 |
| `browser_select_option` | 选择下拉选项 |
| `browser_drag` | 拖放操作 |

### 表单与文件

| 工具 | 描述 |
|------|------|
| `browser_fill_form` | 填充多个表单字段 |
| `browser_file_upload` | 上传文件 |

### 高级功能

| 工具 | 描述 |
|------|------|
| `browser_evaluate` | 执行 JavaScript |
| `browser_run_code` | 运行 Playwright 代码 |
| `browser_console_messages` | 获取控制台消息 |
| `browser_network_requests` | 获取网络请求 |

### 标签页管理

| 工具 | 描述 |
|------|------|
| `browser_tabs` | 列出/创建/关闭/选择标签页 |
| `browser_close` | 关闭页面 |
| `browser_resize` | 调整窗口大小 |

## 使用场景

1. **E2E 测试**: 自动化端到端测试流程
2. **页面交互**: 复杂的表单填写和提交
3. **截图验证**: 视觉回归测试
4. **性能分析**: 网络请求和控制台日志

## 关键词

playwright, mcp, browser, automation, e2e, testing, screenshot

## 相关组件

- [TEST.md](TEST.md) - 测试指南
- [e2e/](e2e/) - E2E 测试目录
