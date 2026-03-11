"use client"

import { useState, useCallback } from "react"
import type { Settings } from "./types"
import { defaultSettings } from "./types"

const SETTINGS_KEY = "agenthub:settings"

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function useSettings() {
  const [settings, setSettingsRaw] = useState<Settings>(() => {
    return { ...defaultSettings, ...loadFromLocalStorage(SETTINGS_KEY, defaultSettings) }
  })

  const setSettings = useCallback((newSettings: Settings) => {
    setSettingsRaw(newSettings)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
  }, [])

  return { settings, setSettings }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
