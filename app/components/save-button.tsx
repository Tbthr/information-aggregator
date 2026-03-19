"use client"

import { useState, useCallback } from "react"
import { Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"

interface SaveButtonProps {
  articleId: string
  isSaved: boolean
  onToggle: (id: string) => void
  size?: "sm" | "md"
  className?: string
}

export function SaveButton({ articleId, isSaved, onToggle, size = "md", className }: SaveButtonProps) {
  const [isPopping, setIsPopping] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle(articleId)
      if (!isSaved) {
        setIsPopping(true)
        setTimeout(() => setIsPopping(false), 500)
      }
    },
    [articleId, isSaved, onToggle]
  )

  return (
    <button
      onClick={handleClick}
      aria-label={isSaved ? "取消收藏" : "收藏文章"}
      className={cn(
        "group flex items-center justify-center rounded-full transition-all duration-200",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "sm" ? "w-7 h-7" : "w-8 h-8",
        className
      )}
    >
      <Bookmark
        className={cn(
          "transition-all duration-200",
          size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
          isPopping && "save-pop",
          isSaved
            ? "fill-[var(--save-active)] stroke-[var(--save-active)]"
            : "stroke-muted-foreground group-hover:stroke-foreground"
        )}
      />
    </button>
  )
}
