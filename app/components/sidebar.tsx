"use client"

import { cn } from "@/lib/utils"
import {
  Sun,
  BookOpen,
  Coffee,
  Zap,
  Plus,
  Bookmark,
  Settings,
  ChevronRight,
  Rss,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"

export type NavId =
  | "daily"
  | "weekly"
  | "view-morning"
  | "view-fish"
  | "saved"
  | "config"

interface SidebarProps {
  activeNav: NavId
  onNav: (id: NavId) => void
  savedCount: number
  collapsed: boolean
  onToggleCollapse: () => void
}

const EDITIONS = [
  { id: "daily" as NavId, label: "每日晨报", sublabel: "The Daily", icon: Sun },
  { id: "weekly" as NavId, label: "周末特刊", sublabel: "The Weekly", icon: BookOpen },
]

const MY_VIEWS = [
  { id: "view-morning" as NavId, label: "晨间必读", icon: Coffee },
  { id: "view-fish" as NavId, label: "摸鱼快看", icon: Zap },
]

export function Sidebar({ activeNav, onNav, savedCount, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <nav
      className={cn(
        "h-full flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out overflow-hidden shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
      aria-label="主导航"
    >
      {/* Logo & Toggle */}
      <div className={cn(
        "flex items-center border-b border-sidebar-border h-14",
        collapsed ? "justify-center px-0" : "px-4 justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Rss className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-base text-sidebar-foreground tracking-tight">Lens</span>
          </div>
        )}
        {collapsed && (
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Rss className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
            aria-label="收起侧边栏"
          >
            <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 展开按钮（折叠时） */}
      {collapsed && (
        <button
          onClick={onToggleCollapse}
          className="mt-2 mx-auto p-1.5 rounded hover:bg-sidebar-accent transition-colors"
          aria-label="展开侧边栏"
        >
          <PanelLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      <div className="flex-1 overflow-y-auto py-3 space-y-5">
        {/* 简报 */}
        <section>
          {!collapsed && (
            <p className="px-4 mb-1 text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
              简报
            </p>
          )}
          {EDITIONS.map(({ id, label, sublabel, icon: Icon }) => (
            <NavButton
              key={id}
              active={activeNav === id}
              collapsed={collapsed}
              onClick={() => onNav(id)}
              icon={<Icon className="w-4 h-4 shrink-0" />}
              label={label}
              sublabel={sublabel}
            />
          ))}
        </section>

        {/* 我的视图 */}
        <section>
          {!collapsed && (
            <div className="px-4 mb-1 flex items-center justify-between">
              <p className="text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
                我的视图
              </p>
              <button className="hover:text-foreground text-muted-foreground transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {MY_VIEWS.map(({ id, label, icon: Icon }) => (
            <NavButton
              key={id}
              active={activeNav === id}
              collapsed={collapsed}
              onClick={() => onNav(id)}
              icon={<Icon className="w-4 h-4 shrink-0" />}
              label={label}
            />
          ))}
        </section>
      </div>

      {/* 底部工具区 */}
      <div className="border-t border-sidebar-border py-3">
        <NavButton
          active={activeNav === "saved"}
          collapsed={collapsed}
          onClick={() => onNav("saved")}
          icon={<Bookmark className="w-4 h-4 shrink-0" />}
          label="我的收藏夹"
          badge={savedCount > 0 ? savedCount : undefined}
        />
        <NavButton
          active={activeNav === "config"}
          collapsed={collapsed}
          onClick={() => onNav("config")}
          icon={<Settings className="w-4 h-4 shrink-0" />}
          label="引擎配置"
        />
      </div>
    </nav>
  )
}

interface NavButtonProps {
  active: boolean
  collapsed: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sublabel?: string
  badge?: number
}

function NavButton({ active, collapsed, onClick, icon, label, sublabel, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 transition-colors duration-150 relative",
        collapsed ? "justify-center px-0 py-2.5" : "px-4 py-2",
        active
          ? "text-sidebar-foreground bg-sidebar-accent"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
      <span className={cn(active ? "text-primary" : "")}>{icon}</span>
      {!collapsed && (
        <div className="flex-1 text-left">
          <span className="font-sans text-sm leading-none">{label}</span>
          {sublabel && (
            <span className="block text-[10px] text-muted-foreground mt-0.5 font-sans">{sublabel}</span>
          )}
        </div>
      )}
      {!collapsed && badge !== undefined && (
        <span className="text-[10px] font-sans font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1"
          style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}>
          {badge}
        </span>
      )}
      {collapsed && active && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
    </button>
  )
}
