"use client"

import { cn } from "@/lib/utils"
import { X, Plus, Trash2, Loader2, Variable, AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface EnvVar {
  key: string
  value: string
}

interface RepoSettingsModalProps {
  open: boolean
  onClose: () => void
  repoId: string
  repoOwner: string
  repoName: string
  initialEnvVars?: Record<string, boolean> // { KEY: hasValue (true/false) }
  onEnvVarsUpdate?: () => void
}

export function RepoSettingsModal({
  open,
  onClose,
  repoId,
  repoOwner,
  repoName,
  initialEnvVars,
  onEnvVarsUpdate,
}: RepoSettingsModalProps) {
  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [keysToDelete, setKeysToDelete] = useState<Set<string>>(new Set())

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ message: string; isError: boolean } | null>(null)

  // Initialize env vars from props when modal opens
  useEffect(() => {
    if (open) {
      // Convert initialEnvVars to array format for editing
      const vars: EnvVar[] = initialEnvVars
        ? Object.keys(initialEnvVars).map((key) => ({ key, value: "" }))
        : []
      setEnvVars(vars)
      setKeysToDelete(new Set())
      setSaveStatus(null)
    }
  }, [open, initialEnvVars])

  if (!open) return null

  function handleAddEnvVar() {
    setEnvVars((prev) => [...prev, { key: "", value: "" }])
  }

  function handleRemoveEnvVar(index: number) {
    const varToRemove = envVars[index]
    // If this is an existing key (has a value in initialEnvVars), mark for deletion
    if (varToRemove.key && initialEnvVars?.[varToRemove.key]) {
      setKeysToDelete((prev) => new Set(prev).add(varToRemove.key))
    }
    setEnvVars((prev) => prev.filter((_, i) => i !== index))
  }

  function handleEnvVarChange(index: number, field: "key" | "value", value: string) {
    setEnvVars((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  async function handleSave() {
    // Validate keys
    const keys = envVars.map((v) => v.key.trim()).filter(Boolean)
    const uniqueKeys = new Set(keys)
    if (keys.length !== uniqueKeys.size) {
      setSaveStatus({ message: "Duplicate environment variable keys", isError: true })
      return
    }

    // Check for invalid key names
    const invalidKey = envVars.find((v) => v.key.trim() && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.key.trim()))
    if (invalidKey) {
      setSaveStatus({ message: `Invalid key name: ${invalidKey.key}`, isError: true })
      return
    }

    setIsSaving(true)
    setSaveStatus(null)

    try {
      // Build payload: only include vars with both key and value
      const envVarsToSave: Record<string, string | null> = {}

      // Add new/updated vars
      for (const { key, value } of envVars) {
        const trimmedKey = key.trim()
        const trimmedValue = value.trim()
        if (trimmedKey && trimmedValue) {
          envVarsToSave[trimmedKey] = trimmedValue
        }
      }

      // Mark deleted keys as null
      for (const key of keysToDelete) {
        envVarsToSave[key] = null
      }

      const response = await fetch(`/api/repo/${repoId}/env-vars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envVars: envVarsToSave }),
      })

      const data = await response.json()
      if (!response.ok) {
        setSaveStatus({
          message: data.error || "Failed to save environment variables",
          isError: true,
        })
        return
      }

      setSaveStatus({
        message: "Settings saved",
        isError: false,
      })
      onEnvVarsUpdate?.()
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch {
      setSaveStatus({
        message: "Failed to save settings",
        isError: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Check if there are any changes to save
  const hasChanges =
    envVars.some((v) => v.key.trim() && v.value.trim()) || keysToDelete.size > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-foreground">Repository Settings</h2>
            <p className="text-xs text-muted-foreground">
              {repoOwner}/{repoName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex cursor-pointer h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation (single tab for now) */}
        <div className="flex border-b border-border px-4">
          <button
            className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium cursor-pointer border-b-2 -mb-px border-primary text-foreground"
          >
            <Variable className="h-3.5 w-3.5" />
            Environment Variables
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 px-4 sm:px-5 py-4 overflow-y-auto">
          {/* Info text */}
          <p className="text-[11px] text-muted-foreground">
            Environment variables defined here will be injected into every sandbox created for this repository.
            Values are encrypted and stored securely.
          </p>

          {/* Warning about agent visibility */}
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              These variables will be visible to the AI agent running in the sandbox. Do not store secrets you don&apos;t want the agent to access.
            </p>
          </div>

          {/* Environment Variables List */}
          <div className="flex flex-col gap-3">
            {envVars.map((envVar, index) => {
              const isExisting = envVar.key && initialEnvVars?.[envVar.key]
              return (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    <Input
                      placeholder="KEY_NAME"
                      value={envVar.key}
                      onChange={(e) => handleEnvVarChange(index, "key", e.target.value.toUpperCase())}
                      className="h-8 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40"
                      disabled={!!isExisting}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <Input
                      type="password"
                      placeholder={isExisting ? "••••••••" : "value"}
                      value={envVar.value}
                      onChange={(e) => handleEnvVarChange(index, "value", e.target.value)}
                      className="h-8 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveEnvVar(index)}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}

            {/* Add button */}
            <button
              onClick={handleAddEnvVar}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground w-fit"
            >
              <Plus className="h-3.5 w-3.5" />
              Add variable
            </button>
          </div>

          {/* Note about existing sandboxes */}
          {envVars.length > 0 && (
            <p className="text-[10px] text-muted-foreground/70">
              Note: Changes will only apply to newly created sandboxes. Existing sandboxes will not be updated.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          {/* Save status */}
          <div className="flex items-center gap-2 text-xs">
            {isSaving && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Saving...</span>
              </>
            )}
            {saveStatus && !isSaving && (
              <span className={saveStatus.isError ? "text-destructive" : "text-green-500"}>
                {saveStatus.message}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
