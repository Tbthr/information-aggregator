export type NavId = string

export interface CustomView {
  id: string
  name: string
  icon: string
  order?: number
}

export interface Pack {
  id: string
  name: string
  description?: string | null
}

// FilterJson 配置类型
export interface ViewFilter {
  timeWindow?: "today" | "week" | "month"
  sortBy?: "ranked" | "recent"
}

export interface SidebarProps {
  activeNav: NavId
  onNav: (id: NavId) => void
  savedCount: number
  collapsed: boolean
  onToggleCollapse: () => void
}
