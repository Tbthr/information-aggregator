"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  daily: { title: "每日晨报", subtitle: "The Daily · 2026年3月19日" },
  weekly: { title: "周末特刊", subtitle: "The Weekly · Week 11" },
  "view-morning": { title: "晨间必读", subtitle: "自定义视图" },
  "view-fish": { title: "摸鱼快看", subtitle: "自定义视图" },
  saved: { title: "我的收藏夹", subtitle: "已保存的文章" },
  config: { title: "引擎配置", subtitle: "数据源与处理规则" },
}

interface TopbarProps {
  activeNav: string
}

export function Topbar({ activeNav }: TopbarProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("lens-theme")
    if (stored === "dark") {
      document.documentElement.classList.add("dark")
      setIsDark(true)
    }
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("lens-theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("lens-theme", "light")
    }
  }

  const info = PAGE_TITLES[activeNav] ?? { title: activeNav }

  return (
    <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
      <div>
        <h1 className="font-sans font-semibold text-sm text-foreground leading-none">{info.title}</h1>
        {info.subtitle && (
          <p className="text-[10px] font-sans text-muted-foreground mt-0.5">{info.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* 深色/浅色切换 */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
          aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Moon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </header>
  )
}
