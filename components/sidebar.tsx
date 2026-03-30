"use client"

import { cn } from "@/lib/utils"
import {
  Sun,
  BookOpen,
  Settings,
  Rss,
  PanelLeftClose,
  PanelLeft,
  AtSign,
  FileText,
} from "lucide-react"

// Re-export types for external consumers
export type { NavId } from "./sidebar/types"
export type { SidebarProps } from "./sidebar/types"

// Internal imports
import type { NavId, SidebarProps } from "./sidebar/types"
import { NavButton } from "./sidebar/nav-button"

const EDITIONS = [
  { id: "daily" as NavId, label: "每日晨报", sublabel: "The Daily", icon: Sun },
  { id: "weekly" as NavId, label: "周末特刊", sublabel: "The Weekly", icon: BookOpen },
]

const SOCIAL_NAV = [
  { id: "x" as NavId, label: "X / Twitter", sublabel: "Social", icon: AtSign },
]

export function Sidebar({ activeNav, onNav, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <nav
      className={cn(
        "h-full flex flex-col border-r border-sidebar-border/30 bg-sidebar/95 backdrop-blur-md transition-all duration-300 ease-in-out overflow-hidden shrink-0 animate-slide-in-left",
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

        {/* 社交 */}
        <section>
          {!collapsed && (
            <p className="px-4 mb-1 text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
              社交
            </p>
          )}
          {SOCIAL_NAV.map(({ id, label, sublabel, icon: Icon }) => (
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
      </div>

      {/* 底部工具区 */}
      <div className="border-t border-sidebar-border py-3">
        <NavButton
          active={activeNav === "settings/reports"}
          collapsed={collapsed}
          onClick={() => onNav("settings/reports")}
          icon={<FileText className="w-4 h-4 shrink-0" />}
          label="报告设置"
        />
        <NavButton
          active={activeNav === "config"}
          collapsed={collapsed}
          onClick={() => onNav("config")}
          icon={<Settings className="w-4 h-4 shrink-0" />}
          label="设置"
        />
      </div>
    </nav>
  )
}
