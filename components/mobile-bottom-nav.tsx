"use client"

import { cn } from "@/lib/utils"
import { GitBranch, MessageSquare, Menu } from "lucide-react"

interface MobileBottomNavProps {
  activeView: "branches" | "chat"
  onViewChange: (view: "branches" | "chat") => void
  onOpenSidebar: () => void
  hasActiveChat: boolean
}

export function MobileBottomNav({
  activeView,
  onViewChange,
  onOpenSidebar,
  hasActiveChat,
}: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80" style={{ paddingBottom: 'var(--safe-area-inset-bottom)' }}>
      <div className="flex h-14 items-center justify-around">
        {/* Repos/Menu Button */}
        <button
          onClick={onOpenSidebar}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground active:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Repos</span>
        </button>

        {/* Branches Tab */}
        <button
          onClick={() => onViewChange("branches")}
          className={cn(
            "flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 transition-colors",
            activeView === "branches"
              ? "text-primary"
              : "text-muted-foreground active:text-foreground"
          )}
        >
          <GitBranch className="h-5 w-5" />
          <span className="text-[10px] font-medium">Branches</span>
        </button>

        {/* Chat Tab */}
        <button
          onClick={() => hasActiveChat && onViewChange("chat")}
          className={cn(
            "flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 transition-colors",
            activeView === "chat"
              ? "text-primary"
              : "text-muted-foreground active:text-foreground",
            !hasActiveChat && "opacity-40 cursor-not-allowed"
          )}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] font-medium">Chat</span>
        </button>
      </div>
    </nav>
  )
}
