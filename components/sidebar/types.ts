export type NavId = string

export interface SidebarProps {
  activeNav: NavId
  onNav: (id: NavId) => void
  collapsed: boolean
  onToggleCollapse: () => void
}
