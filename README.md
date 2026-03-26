# Information Aggregator

一个现代化的信息聚合平台，帮助您高效管理和发现有价值的内容。

## 功能特性

- **日报视图** - 每日精选内容概览
- **周报视图** - 本周热点和深度分析
- **收藏功能** - 保存感兴趣的文章

## 快速开始

### 环境要求

- Node.js 20.19+ 或 22.12+
- pnpm 9+

### 安装

```bash
pnpm install
cp .env.example .env
# 编辑 .env 填入数据库连接信息
```

### 开发

```bash
pnpm dev
```

## 技术栈

- [Next.js 16](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Prisma](https://www.prisma.io/)
- [Supabase](https://supabase.com/)

## Diagnostics Framework

项目内置诊断框架，用于验证收集流水线和报表系统的正确性。

### 命令

```bash
# 只读诊断（无风险）
npx tsx scripts/diagnostics.ts collection                          # 收集系统诊断
npx tsx scripts/diagnostics.ts reports --config-only               # 报表配置校验

# 写入诊断（需确认）
npx tsx scripts/diagnostics.ts collection --run-collection --allow-write  # 触发实际收集
npx tsx scripts/diagnostics.ts reports --daily-only --allow-write --confirm-production
npx tsx scripts/diagnostics.ts reports --weekly-only --allow-write --confirm-production
npx tsx scripts/diagnostics.ts full --allow-write --confirm-production       # 全量诊断

# 完整命令矩阵见 AGENTS.md
```

### 已知限制

- `--cleanup` 标志已定义但**未实现**。目前不会执行任何数据清理。
- 生产环境写入操作需要 `--confirm-production` 确认。

## License

MIT
