import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lens - 信息聚合器',
  description: 'AI 驱动的 RSS/JSON 信息聚合器',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
