# API 请求优化设计文档

## 问题诊断

### 问题 1: 重复请求

**原因**: React StrictMode 在开发模式下会双重渲染组件，导致 `useEffect` 执行两次。

**受影响的 API**:
- `/api/packs` - 被 Sidebar 调用
- `/api/custom-views` - 被 Sidebar 调用
- `/api/bookmarks` - 被 useSaved hook 调用
- `/api/daily` - 被 DailyPage 调用
- `/api/news-flashes` - 被 DailyPage 调用（多余）

### 问题 2: 冗余的 API 调用

**发现**: `/api/daily` 已经返回 `newsFlashes`，但 DailyPage 还单独调用 `/api/news-flashes`。

```typescript
// 当前代码（冗余）
const [dailyData, flashesData] = await Promise.all([
  fetchDailyOverview(),  // 已包含 newsFlashes
  fetchNewsFlashes(),    // 重复获取
])
setNewsFlashes(flashesData)  // 使用的是这个，忽略了 dailyData.newsFlashes
```

**此外**: `/api/daily` 中的 `newsFlashes` 查询也是浪费的，因为结果未被使用。

### 问题 3: API 响应慢

| API | 响应时间 | 原因 |
|-----|---------|------|
| `/api/daily` | ~3400ms | 3 个串行数据库查询 |
| `/api/bookmarks` | ~2900ms | 远程数据库延迟 |
| `/api/custom-views` | ~1900ms | 远程数据库延迟 |
| `/api/packs` | ~1200ms | 远程数据库延迟 |

---

## 解决方案

### 方案概述

```
┌─────────────────────────────────────────────────────────────┐
│                    优化前 (5 个 API)                         │
│  /api/packs ×2  /api/custom-views ×2  /api/bookmarks ×2    │
│  /api/daily ×2  /api/news-flashes ×2                        │
│                    ↓                                        │
│                    优化后 (3 个 API)                         │
│  /api/packs ×1  /api/custom-views ×1  /api/daily ×1        │
│  (bookmarks 延迟加载，news-flashes 移除)                     │
└─────────────────────────────────────────────────────────────┘
```

### 模块 1: 引入 SWR 进行请求缓存和去重

**为什么选择 SWR?**
- 内置请求去重（解决 StrictMode 双重请求）
- 自动缓存，避免重复请求
- 轻量级（~4KB gzipped）
- 支持后台重新验证

**新增文件**: `hooks/use-api.ts`

```typescript
// 统一的 API hooks
import useSWR from 'swr'

// 使用示例
export function usePacks() {
  return useSWR('/api/packs', fetcher)
}

export function useDaily() {
  return useSWR('/api/daily', fetcher)
}
```

### 模块 2: 优化 `/api/daily` API

**改动**:
1. 移除无用的 `newsFlashes` 查询（结果未被使用）
2. 将 `overview` 和 `newsFlashes` 查询改为并行

```typescript
// 优化前：串行查询
const overview = await prisma.dailyOverview.findFirst()
const items = await prisma.item.findMany()
const newsFlashes = await prisma.newsFlash.findMany()

// 优化后：并行查询 + 移除无用查询
const [overview, newsFlashes] = await Promise.all([
  prisma.dailyOverview.findFirst(),
  prisma.newsFlash.findMany({ where: { dailyDate: overview.date } })
])
// items 查询保持串行（依赖 overview）
```

### 模块 3: 重构组件数据获取

**DailyPage 改造**:
```typescript
// 改造前
useEffect(() => {
  Promise.all([fetchDailyOverview(), fetchNewsFlashes()])
}, [])

// 改造后：使用 SWR hook，直接使用 daily 数据中的 newsFlashes
const { data, isLoading } = useDaily()
const newsFlashes = data?.newsFlashes ?? []
```

**Sidebar 改造**:
```typescript
// 改造前
useEffect(() => {
  Promise.all([fetch('/api/custom-views'), fetch('/api/packs')])
}, [])

// 改造后
const { data: views } = useCustomViews()
const { data: packs } = usePacks()
```

**useSaved hook 改造**:
```typescript
// 改造前
useEffect(() => {
  fetchBookmarks().then(setData)
}, [])

// 改造后
const { data, mutate } = useBookmarks()
```

### 模块 4: 移除冗余的 `/api/news-flashes` 调用

**改动**:
1. DailyPage 直接使用 `/api/daily` 返回的 `newsFlashes`
2. 保留 `/api/news-flashes` API（可能有其他地方使用），但首页不再调用

---

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `hooks/use-api.ts` | 新增 | 统一的 SWR hooks |
| `components/daily-page.tsx` | 修改 | 使用 useDaily hook |
| `components/sidebar.tsx` | 修改 | 使用 usePacks/useCustomViews hooks |
| `hooks/use-saved.ts` | 修改 | 使用 useBookmarks hook |
| `app/api/daily/route.ts` | 修改 | 并行查询 + 移除无用查询 |
| `lib/api-client.ts` | 修改 | 移除 fetchNewsFlashes 调用 |

---

## 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| API 请求数 | 5 × 2 = 10 | 3 × 1 = 3 | -70% |
| 首屏加载时间 | ~6s | ~2s | -66% |
| 数据库查询数 | 7 × 2 = 14 | 4 × 1 = 4 | -71% |

---

## 实施步骤

1. **安装 SWR 依赖** - `pnpm add swr`
2. **创建 `hooks/use-api.ts`** - 统一的 SWR hooks
3. **优化 `/api/daily`** - 并行查询 + 移除无用查询
4. **重构 DailyPage** - 使用 useDaily hook
5. **重构 Sidebar** - 使用 usePacks/useCustomViews hooks
6. **重构 useSaved** - 使用 useBookmarks hook
7. **验证** - 刷新页面，确认请求减少

---

## 风险和回滚

**风险**:
- SWR 的缓存行为可能与预期不同
- 需要处理 loading/error 状态

**回滚方案**:
- Git revert 到优化前的 commit
- 每个步骤独立提交，可以单独回滚
