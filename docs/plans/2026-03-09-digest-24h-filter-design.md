# Digest 24 小时过滤设计

日期：2026-03-09
状态：历史设计归档

## 目标

让 `digest` 只展示最近 24 小时的内容，而不是展示一次运行中抓到的全部条目。

## 设计决策

- 优先使用内容的发布时间 `publishedAt`
- 如果没有发布时间，则回退到抓取时间 `fetchedAt`
- 过滤逻辑仅放在 `runDigest`，不改变 `scan` 的行为

## 范围

- 保留 `RawItem.publishedAt` 作为主时间字段
- 在需要时补充 adapter 的时间解析能力，确保 RSS / JSON Feed 仍能写入 `publishedAt`
- `website` fallback 条目仍以抓取时间为准，因为它本身不代表文章级发布时间
- 在进入 normalize 与 ranking 之前，先对 raw items 做 24 小时窗口过滤

## 权衡

- 该改动范围小，不需要改动 persistence 或 ranking contract
- 没有发布时间的 source 仍可能因为抓取时间落入窗口而出现在 digest 中，这是有意识的回退策略
- `website` 类型的时间精度仍弱于 feed 类型，但不会再把历史内容无限带入 digest

## 测试要求

- 为 RSS 的 `pubDate` 与 Atom 的 `published` 增加测试
- 为 JSON Feed 的 `date_published` 增加测试
- 为 `runDigest` 增加测试，证明：
  - 超过 24 小时的内容会被过滤
  - 24 小时内的内容会被保留
  - 缺少 `publishedAt` 时会回退到 `fetchedAt`
