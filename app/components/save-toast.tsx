"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Bookmark, X } from "lucide-react"

interface SaveToastProps {
  message: string
  visible: boolean
  onClose: () => void
}

export function SaveToast({ message, visible, onClose }: SaveToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onClose, 2200)
      return () => clearTimeout(t)
    }
  }, [visible, onClose])

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5",
        "bg-foreground text-background px-4 py-2.5 rounded-full shadow-lg",
        "text-sm font-sans transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <Bookmark className="w-3.5 h-3.5 fill-[var(--save-active)] stroke-[var(--save-active)]" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
