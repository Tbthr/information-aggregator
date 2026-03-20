# 前端页面样式与交互验收计划

**日期**: 2026-03-20
**状态**: 待验收
**关联设计文档**: `docs/plans/2026-03-20-database-config-design.md`
**验证工具**: Playwriter (Chrome 浏览器自动化)

---

## 1. 概述

本文档定义了 Information Aggregator 前端页面的验收标准，覆盖设计文档中所有 UI 功能的关键路径验证。

### 验收范围

| 模块 | 页面路由 | 核心功能 |
|------|---------|---------|
| 配置页面 | `/config` | Pack/Source 管理、参数配置、认证配置 |
| 自定义视图 | `/view/:id` | 视图创建、Pack 聚合展示 |
| 收藏功能 | `/saved` | 收藏/取消收藏、列表查看 |
| 日报/周报 | `/daily`, `/weekly` | 报告展示、文章交互 |

### 验收原则

- **关键路径验证**: 只验证核心功能是否可用
- **PASS/FAIL 标准**: 每个操作有明确的通过条件
- **可重复执行**: Playwriter 脚本可多次运行

---

## 2. 验收环境准备

### 2.1 启动开发服务器

```bash
pnpm dev
```

确认服务器运行在 `http://localhost:3000`。

### 2.2 初始化 Playwriter 会话

```bash
# 创建新会话
playwriter session new
# 输出示例: 1 (记住这个 session ID)
```

### 2.3 打开目标页面

```bash
playwriter -s 1 -e 'state.page = context.pages().find((p) => p.url() === "about:blank") ?? (await context.newPage()); await state.page.goto("http://localhost:3000/config"); await state.page.waitForLoadState("domcontentloaded")'
```

---

## 3. 用户流程验收清单

---

### 3.1 Pack 管理流程

**业务目的**: 管理信息聚合的主题包

**前置条件**:
- 已登录系统（如需认证）
- 访问 `/config` 页面
- 引擎配置 Tab 处于激活状态

#### 3.1.1 查看 Pack 列表

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 导航到配置页面 | `playwriter -s 1 -e 'await state.page.goto("http://localhost:3000/config")'` | 页面加载完成 |
| 2 | 等待 Pack 列表加载 | `playwriter -s 1 -e 'await state.page.waitForSelector("[data-testid=\"pack-list\"]", { timeout: 5000 }).catch(() => null)'` | 显示 Pack 列表或空状态 |
| 3 | 获取页面快照 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 可见 Pack 项目 |

**验收标准**:
- [ ] 页面正常加载，无 JS 错误
- [ ] Pack 列表显示（如有数据）或显示"暂无 Pack"提示
- [ ] 每个 Pack 显示名称和数据源数量

#### 3.1.2 创建新 Pack

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击"新建 Pack"按钮 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"新建 Pack\")")'` | 弹出创建对话框或进入编辑模式 |
| 2 | 输入 Pack 名称 | `playwriter -s 1 -e 'await state.page.fill("input[placeholder*=\"名称\"], input[name=\"name\"]", "测试 Pack - Playwriter")'` | 输入框显示文本 |
| 3 | 输入描述（可选） | `playwriter -s 1 -e 'await state.page.fill("textarea[placeholder*=\"描述\"], textarea[name=\"description\"]", "自动化测试创建的 Pack")'` | 输入框显示文本 |
| 4 | 保存 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"保存\"), button:has-text(\"创建\")")'` | 创建成功，列表更新 |
| 5 | 验证创建成功 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 新 Pack 出现在列表中 |

**验收标准**:
- [ ] 创建按钮可点击
- [ ] 表单可正常输入
- [ ] 保存后 Pack 出现在列表中
- [ ] 无错误提示

#### 3.1.3 展开查看 Pack 详情

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击 Pack 展开 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"测试 Pack - Playwriter\")")'` | Pack 展开，显示数据源列表 |
| 2 | 验证右侧详情面板 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=Pack 详情", { timeout: 3000 })'` | 右侧显示 Pack 详情 |

**验收标准**:
- [ ] 点击 Pack 可展开/折叠
- [ ] 展开后显示数据源子列表
- [ ] 右侧面板显示 Pack 详情（ID、名称、描述、统计）

#### 3.1.4 删除 Pack

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 选中目标 Pack | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"测试 Pack - Playwriter\")")'` | Pack 被选中 |
| 2 | 点击删除按钮 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"删除\"), button[data-testid=\"delete-pack\"]")'` | 弹出确认对话框或直接删除 |
| 3 | 确认删除 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"确认\"), button:has-text(\"确定\")")'` | Pack 从列表中移除 |

**验收标准**:
- [ ] 删除按钮可点击
- [ ] 有确认机制（确认框或二次点击）
- [ ] 删除后 Pack 从列表消失

---

### 3.2 Source 管理流程

**业务目的**: 管理 Pack 下的数据源

**前置条件**:
- 存在至少一个 Pack
- Pack 已展开显示数据源列表

#### 3.2.1 添加数据源

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 展开目标 Pack | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"AI 与大模型\")")'` | 显示数据源列表和"添加数据源"按钮 |
| 2 | 点击"添加数据源" | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"添加数据源\")")'` | 弹出添加表单 |
| 3 | 选择数据源类型 | `playwriter -s 1 -e 'await state.page.selectOption("select[name=\"type\"], [data-testid=\"source-type\"]", "rss")'` | 选中 RSS 类型 |
| 4 | 输入名称 | `playwriter -s 1 -e 'await state.page.fill("input[name=\"name\"], input[placeholder*=\"名称\"]", "测试 RSS 源")'` | 输入框显示文本 |
| 5 | 输入 URL | `playwriter -s 1 -e 'await state.page.fill("input[name=\"url\"], input[placeholder*=\"URL\"]", "https://example.com/feed.xml")'` | 输入框显示文本 |
| 6 | 保存 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"保存\"), button:has-text(\"添加\")")'` | 数据源添加成功 |

**验收标准**:
- [ ] 添加数据源按钮可点击
- [ ] 表单各字段可正常输入
- [ ] 保存后数据源出现在 Pack 下

#### 3.2.2 启用/禁用数据源

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 找到开关按钮 | `playwriter -s 1 -e 'const toggle = await state.page.locator("button[role=\"switch\"], [data-testid=\"source-toggle\"]").first(); await toggle.click()'` | 开关状态切换 |
| 2 | 验证状态变化 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 开关视觉状态改变 |

**验收标准**:
- [ ] 开关按钮可点击
- [ ] 点击后状态立即切换（视觉反馈）
- [ ] 禁用状态有明显区分

#### 3.2.3 删除数据源

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击数据源行 | `playwriter -s 1 -e 'await state.page.click("text=测试 RSS 源")'` | 选中数据源 |
| 2 | 点击删除 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"删除\"):near(:text(\"测试 RSS 源\")")'` | 确认删除 |

**验收标准**:
- [ ] 删除操作可执行
- [ ] 删除后数据源从列表移除

---

### 3.3 自定义视图流程

**业务目的**: 创建聚合多个 Pack 的自定义信息视图

**前置条件**:
- 存在多个 Pack
- 访问 `/config` 页面

#### 3.3.1 创建自定义视图

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击创建视图按钮 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"创建视图\"), button:has-text(\"新建视图\")")'` | 弹出创建表单 |
| 2 | 输入视图名称 | `playwriter -s 1 -e 'await state.page.fill("input[name=\"name\"], input[placeholder*=\"视图名称\"]", "晨间必读")'` | 输入框显示文本 |
| 3 | 选择图标 | `playwriter -s 1 -e 'await state.page.click("button[data-testid=\"icon-selector\"]"); await state.page.click("[data-icon=\"coffee\"]")'` | 选中图标 |
| 4 | 选择 Pack（多选） | `playwriter -s 1 -e 'await state.page.click("input[type=\"checkbox\"][value=\"ai-llm\"]"); await state.page.click("input[type=\"checkbox\"][value=\"frontend\"]")'` | 选中多个 Pack |
| 5 | 保存 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"保存\")")'` | 视图创建成功 |

**验收标准**:
- [ ] 创建表单可正常打开
- [ ] 名称、图标、Pack 选择均可操作
- [ ] 保存后视图出现在侧边栏

#### 3.3.2 查看自定义视图

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 导航到侧边栏 | `playwriter -s 1 -e 'await state.page.goto("http://localhost:3000/")'` | 首页加载 |
| 2 | 点击自定义视图 | `playwriter -s 1 -e 'await state.page.click("text=晨间必读")'` | 跳转到视图页面 |
| 3 | 验证内容聚合 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 显示聚合的文章列表 |

**验收标准**:
- [ ] 自定义视图出现在侧边栏
- [ ] 点击可跳转到 `/view/:id`
- [ ] 页面显示聚合自多个 Pack 的文章

---

### 3.4 AI 配置流程

**业务目的**: 配置 AI 模型和参数

**前置条件**:
- 访问 `/config` 页面
- 切换到"参数配置" Tab

#### 3.4.1 配置 AI Provider

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 切换到参数配置 Tab | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"参数配置\")")'` | Tab 切换成功 |
| 2 | 选择 Provider | `playwriter -s 1 -e 'await state.page.selectOption("select[name=\"provider\"], [data-testid=\"ai-provider\"]", "anthropic")'` | 下拉选项更新 |
| 3 | 输入 API Token | `playwriter -s 1 -e 'await state.page.fill("input[name=\"apiToken\"], input[type=\"password\"]", "sk-test-xxx")'` | 输入框显示（可能掩码） |
| 4 | 配置批次大小 | `playwriter -s 1 -e 'await state.page.fill("input[name=\"batchSize\"], input[type=\"number\"]", "5")'` | 数值更新 |

**验收标准**:
- [ ] Tab 切换正常
- [ ] Provider 下拉可正常选择
- [ ] 各配置项可正常输入

#### 3.4.2 测试连接

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击测试连接 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"测试连接\")")'` | 开始测试 |
| 2 | 等待结果 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=连接成功, text=连接失败", { timeout: 10000 })'` | 显示测试结果 |

**验收标准**:
- [ ] 测试按钮可点击
- [ ] 显示加载状态
- [ ] 最终显示成功或失败结果

---

### 3.5 定时任务流程

**业务目的**: 管理系统定时任务

**前置条件**:
- 在"参数配置" Tab
- 定时任务区域可见

#### 3.5.1 启用/禁用任务

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 找到任务列表 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 可见任务列表 |
| 2 | 切换任务开关 | `playwriter -s 1 -e 'const toggle = await state.page.locator("[data-testid=\"job-toggle-fetch\"]").first(); await toggle.click()'` | 开关状态切换 |

**验收标准**:
- [ ] 任务开关可点击
- [ ] 状态立即更新

#### 3.5.2 修改 Cron 表达式

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击 Cron 输入框 | `playwriter -s 1 -e 'await state.page.click("input[value*=\"*/30\"]")'` | 输入框获得焦点 |
| 2 | 修改值 | `playwriter -s 1 -e 'await state.page.fill("input[value*=\"*/30\"]", "*/15 * * * *")'` | 值更新 |
| 3 | 保存 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"保存\")")'` | 保存成功 |

**验收标准**:
- [ ] Cron 输入框可编辑
- [ ] 保存后值保持

#### 3.5.3 手动触发任务

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击手动触发 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"手动触发\")")'` | 任务开始执行 |
| 2 | 验证执行状态 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=执行中, text=执行完成", { timeout: 30000 })'` | 显示执行状态 |

**验收标准**:
- [ ] 触发按钮可点击
- [ ] 显示执行状态反馈

---

### 3.6 报告配置流程

**业务目的**: 配置日报和周报生成参数

**前置条件**:
- 在"参数配置" Tab
- 报告配置区域可见

#### 3.6.1 配置日报参数

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 找到日报配置区 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=日报配置")'` | 区域可见 |
| 2 | 修改最大文章数 | `playwriter -s 1 -e 'await state.page.fill("input[name=\"dailyMaxItems\"]", "25")'` | 值更新 |
| 3 | 切换快讯开关 | `playwriter -s 1 -e 'await state.page.click("[data-testid=\"news-flashes-toggle\"]")'` | 开关切换 |

**验收标准**:
- [ ] 日报配置区域可见
- [ ] 各参数可正常编辑

#### 3.6.2 配置周报参数

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 找到周报配置区 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=周报配置")'` | 区域可见 |
| 2 | 修改天数范围 | `playwriter -s 1 -e 'await state.page.fill("input[name=\"weeklyDays\"]", "7")'` | 值更新 |

**验收标准**:
- [ ] 周报配置区域可见
- [ ] 参数可正常编辑

#### 3.6.3 手动生成报告

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击生成日报 | `playwriter -s 1 -e 'await state.page.click("button:has-text(\"立即生成日报\")")'` | 开始生成 |
| 2 | 等待生成完成 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=生成成功, text=生成完成", { timeout: 60000 })'` | 显示成功消息 |

**验收标准**:
- [ ] 生成按钮可点击
- [ ] 显示生成进度或状态
- [ ] 完成后有成功反馈

---

### 3.7 收藏管理流程

**业务目的**: 保存和管理感兴趣的文章

**前置条件**:
- 有可浏览的文章（日报或自定义视图）
- 访问 `/daily` 或其他有文章的页面

#### 3.7.1 收藏文章

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 导航到日报页面 | `playwriter -s 1 -e 'await state.page.goto("http://localhost:3000/daily")'` | 页面加载 |
| 2 | 找到收藏按钮 | `playwriter -s 1 -e 'await state.page.waitForSelector("button[aria-label=\"收藏文章\"]")'` | 收藏按钮可见 |
| 3 | 点击收藏 | `playwriter -s 1 -e 'await state.page.click("button[aria-label=\"收藏文章\"]")'` | 按钮状态变化（填充效果） |
| 4 | 验证收藏动画 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 书签图标变为填充状态 |

**验收标准**:
- [ ] 收藏按钮可点击
- [ ] 点击后图标变为填充状态（视觉反馈）
- [ ] 有 pop 动画效果

#### 3.7.2 查看收藏列表

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 导航到收藏页面 | `playwriter -s 1 -e 'await state.page.goto("http://localhost:3000/saved")'` | 页面加载 |
| 2 | 等待列表加载 | `playwriter -s 1 -e 'await state.page.waitForSelector("text=我的收藏夹", { timeout: 5000 })'` | 页面标题显示 |
| 3 | 验证文章存在 | `playwriter -s 1 -e 'await snapshot({ page: state.page })'` | 刚收藏的文章出现在列表 |

**验收标准**:
- [ ] 页面正常加载
- [ ] 显示收藏数量
- [ ] 收藏的文章出现在列表中

#### 3.7.3 取消收藏

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 在收藏列表点击取消 | `playwriter -s 1 -e 'await state.page.click("button[aria-label=\"取消收藏\"]")'` | 取消收藏 |
| 2 | 验证文章移除 | `playwriter -s 1 -e 'await state.page.waitForTimeout(500); await snapshot({ page: state.page })'` | 文章从列表移除 |

**验收标准**:
- [ ] 取消收藏按钮可点击
- [ ] 文章立即从列表移除

#### 3.7.4 打开原文链接

| 步骤 | 操作 | Playwriter 命令 | 预期结果 |
|------|------|-----------------|---------|
| 1 | 点击外链图标 | `playwriter -s 1 -e 'await state.page.click("a[target=\"_blank\"]")'` | 新标签页打开 |
| 2 | 验证新页面 | `playwriter -s 1 -e 'const pages = context.pages(); console.log("打开的页面数:", pages.length)'` | 新页面已打开 |

**验收标准**:
- [ ] 外链图标可点击
- [ ] 在新标签页打开原文 URL

---

## 4. Playwriter 会话管理脚本

### 4.1 完整会话初始化

```bash
#!/bin/bash
# 保存为: scripts/acceptance-test-init.sh

SESSION_ID=$(playwriter session new | tr -d ' ')
echo "创建会话: $SESSION_ID"

# 打开 Chrome 并导航到配置页面
playwriter -s $SESSION_ID -e 'state.page = await context.newPage(); await state.page.goto("http://localhost:3000/config"); await state.page.waitForLoadState("domcontentloaded")'

echo "会话已就绪，Session ID: $SESSION_ID"
echo "使用以下命令执行测试:"
echo "  playwriter -s $SESSION_ID -e '<your-code>'"
```

### 4.2 快速页面快照

```bash
# 获取当前页面状态
playwriter -s 1 -e 'console.log("URL:", state.page.url()); await snapshot({ page: state.page })'
```

### 4.3 截图保存

```bash
# 保存截图到文件
playwriter -s 1 -e 'await state.page.screenshot({ path: "screenshots/config-page.png", scale: "css" })'
```

### 4.4 清理会话

```bash
# 测试完成后清理
playwriter session reset 1
# 或删除所有会话
rm -rf ~/.playwriter/sessions/*
```

---

## 5. 验收执行指南

### 5.1 执行顺序建议

1. **环境准备** - 启动 `pnpm dev`，确认服务运行
2. **初始化 Playwriter** - 创建会话，打开浏览器
3. **按流程执行** - 从 Pack 管理开始，依次验证各流程
4. **记录问题** - 发现问题立即记录到问题清单
5. **截图留证** - 关键步骤和问题点截图保存

### 5.2 验收结果记录模板

```markdown
## 验收执行记录

**执行日期**: YYYY-MM-DD
**执行人**: XXX
**环境**: Chrome XX / macOS XX

### 3.1 Pack 管理流程
| 测试项 | 状态 | 备注 |
|--------|------|------|
| 3.1.1 查看 Pack 列表 | PASS | 列表正常显示 |
| 3.1.2 创建新 Pack | PASS | - |
| 3.1.3 展开查看详情 | FAIL | 展开无响应 #123 |
| 3.1.4 删除 Pack | SKIP | 依赖 3.1.3 |

### 问题清单
| # | 问题描述 | 严重程度 | 状态 |
|---|---------|---------|------|
| 123 | Pack 展开无响应 | 高 | 待修复 |
```

### 5.3 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 元素找不到 | 页面未加载完成 | 增加 `waitForSelector` 等待 |
| 点击无响应 | 事件被阻止 | 尝试 `force: true` 选项 |
| Playwriter 连接失败 | 扩展未激活 | 点击浏览器扩展图标激活 |
| 截图为空白 | 页面未渲染完成 | 增加 `waitForLoadState` |

---

## 6. 附录

### 6.1 关键选择器参考

| 元素 | 选择器 | 说明 |
|------|--------|------|
| Tab 按钮 | `button:has-text("引擎配置")` | 参数配置、认证配置类似 |
| Pack 列表项 | `button:has-text("Pack名称")` | 点击选中/展开 |
| 新建 Pack | `button:has-text("新建 Pack")` | 触发创建表单 |
| 收藏按钮 | `button[aria-label="收藏文章"]` | 文章卡片上的书签按钮 |
| 外链图标 | `a[target="_blank"]` | 打开原文链接 |

### 6.2 API 端点参考

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/packs` | GET/POST | Pack 列表/创建 |
| `/api/packs/:id` | PUT/DELETE | Pack 更新/删除 |
| `/api/sources` | GET/POST | Source 列表/创建 |
| `/api/custom-views` | GET/POST | 自定义视图 |
| `/api/settings` | GET/PUT | 全局设置 |
| `/api/bookmarks` | GET | 收藏列表 |

---

**文档结束**
