"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil } from "lucide-react"
import { getIconComponent } from "./icon-map"
import { NavButton } from "./nav-button"
import type { NavId, CustomView } from "./types"

interface SortableViewItemProps {
  view: CustomView
  active: boolean
  collapsed: boolean
  onNav: (id: NavId) => void
  onEdit: (view: CustomView) => void
}

export function SortableViewItem({ view, active, collapsed, onNav, onEdit }: SortableViewItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <NavButton
        active={active}
        collapsed={collapsed}
        onClick={() => onNav(view.id)}
        icon={getIconComponent(view.icon)}
        label={view.name}
      />
      {!collapsed && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded hover:bg-accent cursor-grab active:cursor-grabbing"
            title="拖拽排序"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(view)
            }}
            className="p-1 rounded hover:bg-accent"
            title="编辑视图"
          >
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}
