"use client"

import { useCallback } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Agent } from "@/lib/types"
import { agentLabels } from "@/lib/types"

// =============================================================================
// Types
// =============================================================================

interface SwitchAgentDialogProps {
  /** The new agent to switch to, or null if dialog should be closed */
  newAgent: Agent | null
  /** Current agent name */
  currentAgent: Agent
  /** Callback when dialog is closed (without switching) */
  onClose: () => void
  /** Callback when agent switch is confirmed */
  onConfirm: (newAgent: Agent) => void
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Dialog for confirming agent switch with context loss warning
 *
 * Features:
 * - Warns user about context loss when switching agents mid-conversation
 * - Shows which agent they're switching from and to
 * - Clear explanation of what will happen
 */
export function SwitchAgentDialog({
  newAgent,
  currentAgent,
  onClose,
  onConfirm,
}: SwitchAgentDialogProps) {
  const handleConfirm = useCallback(() => {
    if (!newAgent) return
    onConfirm(newAgent)
    onClose()
  }, [newAgent, onConfirm, onClose])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose()
    }
  }, [onClose])

  return (
    <Dialog open={!!newAgent} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Switch Agent?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/50 p-3">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">Context will be reset</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Switching from <span className="font-semibold text-foreground">{agentLabels[currentAgent]}</span> to{" "}
              <span className="font-semibold text-foreground">{newAgent ? agentLabels[newAgent] : ""}</span> will start a new conversation context.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Your previous messages will remain visible in the chat, but the new agent won't have access to them. This is useful when you want to try a different approach or agent.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
          >
            Switch Agent
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
