"use client"

import { cn } from "@/lib/utils"
import type { Repo } from "@/lib/types"
import { Plus, X, LogOut, Settings, Box, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Quota {
  current: number
  max: number
  remaining: number
}

interface MobileSidebarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repos: Repo[]
  activeRepoId: string | null
  userAvatar?: string | null
  userName?: string | null
  userLogin?: string | null
  onSelectRepo: (repoId: string) => void
  onRemoveRepo: (repoId: string) => void
  onOpenSettings: () => void
  onOpenAddRepo: () => void
  onSignOut?: () => void
  quota?: Quota | null
}

export function MobileSidebarDrawer({
  open,
  onOpenChange,
  repos,
  activeRepoId,
  userAvatar,
  userName,
  userLogin,
  onSelectRepo,
  onRemoveRepo,
  onOpenSettings,
  onOpenAddRepo,
  onSignOut,
  quota,
}: MobileSidebarDrawerProps) {
  const [removeModalRepo, setRemoveModalRepo] = useState<Repo | null>(null)

  const handleSelectRepo = (repoId: string) => {
    onSelectRepo(repoId)
    onOpenChange(false)
  }

  const handleAddRepo = () => {
    onOpenAddRepo()
    onOpenChange(false)
  }

  const handleOpenSettings = () => {
    onOpenSettings()
    onOpenChange(false)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="left">
        <DrawerContent
          className="h-full w-[280px] max-w-[85vw] rounded-none border-r border-border"
          style={{ paddingTop: 'var(--safe-area-inset-top)' }}
        >
          <div className="flex h-full flex-col bg-sidebar">
            {/* Header with user info */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {userAvatar ? (
                <img src={userAvatar} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono text-sm font-bold">
                  {userName?.[0]?.toUpperCase() || userLogin?.[0]?.toUpperCase() || "?"}
                </span>
              )}
              <div className="flex flex-1 flex-col min-w-0">
                {userName && (
                  <span className="text-sm font-medium text-foreground truncate">
                    {userName}
                  </span>
                )}
                {userLogin && (
                  <span className="text-xs text-muted-foreground truncate">@{userLogin}</span>
                )}
              </div>
            </div>

            {/* Quota display */}
            {quota && (
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Box className="h-3 w-3" />
                    Sandboxes
                  </span>
                  <span className="font-mono">{quota.current}/{quota.max}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      quota.current / quota.max > 0.8 ? "bg-orange-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min((quota.current / quota.max) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Repos list */}
            <div className="flex-1 overflow-y-auto py-2">
              <div className="px-3 pb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Repositories
                </span>
              </div>
              {repos.map((repo) => {
                const isActive = repo.id === activeRepoId
                const hasRunning = repo.branches.some((b) => b.status === "running" || b.status === "creating")
                const nameParts = repo.name.split("-")
                const initials = nameParts.length > 1
                  ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                  : repo.name.slice(0, 2).toUpperCase()

                return (
                  <div key={repo.id} className="group relative px-2">
                    <button
                      onClick={() => handleSelectRepo(repo.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      {/* Repo avatar */}
                      <span className={cn(
                        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
                        isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                      )}>
                        {initials}
                        {hasRunning && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-primary" />
                        )}
                      </span>

                      {/* Repo info */}
                      <div className="flex flex-1 flex-col items-start min-w-0">
                        <span className="text-sm font-medium truncate w-full text-left">{repo.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate w-full text-left">{repo.owner}</span>
                      </div>

                      {/* Arrow indicator */}
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground/50"
                      )} />
                    </button>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (repo.branches.length === 0) {
                          onRemoveRepo(repo.id)
                          return
                        }
                        setRemoveModalRepo(repo)
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground/50 transition-all opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}

              {/* Add repo button */}
              <div className="px-2 pt-1">
                <button
                  onClick={handleAddRepo}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="text-sm">Add repository</span>
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-border p-2" style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom) + 0.5rem)' }}>
              <button
                onClick={handleOpenSettings}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm">API Settings</span>
              </button>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm">Sign out</span>
                </button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Remove repo confirmation modal */}
      <Dialog open={!!removeModalRepo} onOpenChange={(open) => !open && setRemoveModalRepo(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Remove repository?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {removeModalRepo && removeModalRepo.branches.length > 0 ? (
              <>This will delete {removeModalRepo.branches.length} chat{removeModalRepo.branches.length !== 1 ? "s" : ""} and their sandboxes for <span className="font-semibold text-foreground">{removeModalRepo.owner}/{removeModalRepo.name}</span>. Branches on GitHub will not be affected.</>
            ) : (
              <>Remove <span className="font-semibold text-foreground">{removeModalRepo?.owner}/{removeModalRepo?.name}</span> from the sidebar?</>
            )}
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setRemoveModalRepo(null)}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (removeModalRepo) {
                  onRemoveRepo(removeModalRepo.id)
                  setRemoveModalRepo(null)
                }
              }}
              className="cursor-pointer flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
