"use client"

import { cn } from "@/lib/utils"
import type { Branch } from "@/lib/types"
import { GitPullRequest, Loader2, Pause, Play, History, Diff } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MobileHeaderProps {
  repoOwner: string | null
  repoName: string | null
  branch: Branch | null
  onToggleGitHistory: () => void
  onOpenDiff: () => void
  onCreatePR: () => void
  onSandboxToggle: () => void
  gitHistoryOpen: boolean
  sandboxToggleLoading: boolean
  prLoading: boolean
}

export function MobileHeader({
  repoOwner,
  repoName,
  branch,
  onToggleGitHistory,
  onOpenDiff,
  onCreatePR,
  onSandboxToggle,
  gitHistoryOpen,
  sandboxToggleLoading,
  prLoading,
}: MobileHeaderProps) {
  const isStopped = branch?.status === "stopped"
  const isRunning = branch?.status === "running" || branch?.status === "creating"
  const hasPR = !!branch?.prUrl

  return (
    <TooltipProvider delayDuration={0}>
      <header
        className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2"
        style={{ paddingTop: 'calc(var(--safe-area-inset-top) + 0.5rem)' }}
      >
        {/* Repo/Branch info - left side */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {repoOwner && repoName && (
            <span className="text-[10px] text-muted-foreground truncate">
              {repoOwner}/{repoName}
            </span>
          )}
          {branch && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 text-muted-foreground">
                <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
              </svg>
              <span className="text-xs font-medium text-foreground truncate font-mono">
                {branch.name}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons - right side */}
        {branch?.sandboxId && (
          <div className="flex items-center gap-0.5">
            {/* Sandbox toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSandboxToggle}
                  disabled={sandboxToggleLoading || isRunning}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {sandboxToggleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isStopped ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isStopped ? "Start sandbox" : "Pause sandbox"}
              </TooltipContent>
            </Tooltip>

            {/* Diff button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenDiff}
                  disabled={isRunning}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Diff className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Diff</TooltipContent>
            </Tooltip>

            {/* PR button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onCreatePR}
                  disabled={isRunning || prLoading}
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                    hasPR ? "text-green-400" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {prLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitPullRequest className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {hasPR ? "Open PR" : "Create PR"}
              </TooltipContent>
            </Tooltip>

            {/* Git History toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleGitHistory}
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors",
                    gitHistoryOpen
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <History className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Git log</TooltipContent>
            </Tooltip>
          </div>
        )}
      </header>
    </TooltipProvider>
  )
}
