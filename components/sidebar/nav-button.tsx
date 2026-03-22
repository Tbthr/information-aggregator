import { cn } from "@/lib/utils"
import type { NavId } from "./types"

interface NavButtonProps {
  active: boolean
  collapsed: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sublabel?: string
  badge?: number
}

export function NavButton({ active, collapsed, onClick, icon, label, sublabel, badge }: NavButtonProps) {
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
