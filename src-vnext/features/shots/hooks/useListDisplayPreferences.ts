import { useCallback, useSyncExternalStore } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListDisplayPreferences {
  readonly showThumbnail: boolean
  readonly showShotNumber: boolean
  readonly showDescription: boolean
  readonly showStatusBadge: boolean
}

type PreferenceKey = keyof ListDisplayPreferences

// ---------------------------------------------------------------------------
// Storage key + defaults
// ---------------------------------------------------------------------------

const STORAGE_KEY = "sb:three-panel:list-prefs"

const DEFAULTS: ListDisplayPreferences = {
  showThumbnail: true,
  showShotNumber: true,
  showDescription: true,
  showStatusBadge: true,
}

// ---------------------------------------------------------------------------
// External store (singleton)
// ---------------------------------------------------------------------------

let cachedPrefs: ListDisplayPreferences | null = null
const listeners = new Set<() => void>()

function readFromStorage(): ListDisplayPreferences {
  if (cachedPrefs) return cachedPrefs
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ListDisplayPreferences>
      cachedPrefs = { ...DEFAULTS, ...parsed }
    } else {
      cachedPrefs = DEFAULTS
    }
  } catch {
    cachedPrefs = DEFAULTS
  }
  return cachedPrefs
}

function writeToStorage(next: ListDisplayPreferences): void {
  cachedPrefs = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Silently ignore storage errors (quota, private browsing)
  }
  for (const fn of listeners) fn()
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot(): ListDisplayPreferences {
  return readFromStorage()
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useListDisplayPreferences(): readonly [
  ListDisplayPreferences,
  (key: PreferenceKey) => void,
] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const togglePref = useCallback((key: PreferenceKey) => {
    const current = readFromStorage()
    writeToStorage({ ...current, [key]: !current[key] })
  }, [])

  return [prefs, togglePref] as const
}
