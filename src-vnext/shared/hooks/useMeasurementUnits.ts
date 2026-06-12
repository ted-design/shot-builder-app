import { useCallback, useSyncExternalStore } from "react"
import type { UnitSystem } from "@/features/library/lib/measurementUnits"

// Global imperial↔metric display preference: localStorage-persisted, synced across consumers
// via a custom event + the native `storage` event; SSR/no-window falls back to 'imperial'.

const STORAGE_KEY = "sb:measurement-units"
const CHANGE_EVENT = "sb:measurement-units-change"
const DEFAULT_SYSTEM: UnitSystem = "imperial"
const VALID: readonly UnitSystem[] = ["imperial", "metric"]

// In-memory fallback that holds the selection when a localStorage write fails (private mode /
// quota), so the UI still reflects the choice. Null when localStorage is authoritative.
let memorySystem: UnitSystem | null = null

function readSystem(): UnitSystem {
  if (memorySystem !== null) return memorySystem
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (stored !== null && (VALID as readonly string[]).includes(stored as string)) {
      return stored as UnitSystem
    }
  } catch {
    // localStorage may be unavailable (private mode, SSR)
  }
  return DEFAULT_SYSTEM
}

function persistSystem(system: UnitSystem): void {
  let persisted = false
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, system)
    persisted = true
  } catch {
    // Write failed — keep the selection in memory below so the UI still updates.
  }
  memorySystem = persisted ? null : system
  try {
    globalThis.dispatchEvent?.(new Event(CHANGE_EVENT))
  } catch {
    // Ignore dispatch errors in non-DOM environments
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof globalThis.addEventListener !== "function") return () => {}
  const onStorage = (e: Event) => {
    if (!(e instanceof StorageEvent) || e.key === STORAGE_KEY) {
      memorySystem = null // another tab wrote localStorage — trust it over the in-memory fallback
      callback()
    }
  }
  globalThis.addEventListener(CHANGE_EVENT, callback)
  globalThis.addEventListener("storage", onStorage)
  return () => {
    globalThis.removeEventListener(CHANGE_EVENT, callback)
    globalThis.removeEventListener("storage", onStorage)
  }
}

function getServerSnapshot(): UnitSystem {
  return DEFAULT_SYSTEM
}

export interface UseMeasurementUnits {
  readonly system: UnitSystem
  readonly setSystem: (system: UnitSystem) => void
  readonly toggle: () => void
}

export function useMeasurementUnits(): UseMeasurementUnits {
  const system = useSyncExternalStore(subscribe, readSystem, getServerSnapshot)

  const setSystem = useCallback((next: UnitSystem) => {
    if (!(VALID as readonly string[]).includes(next)) return
    persistSystem(next)
  }, [])

  const toggle = useCallback(() => {
    persistSystem(readSystem() === "imperial" ? "metric" : "imperial")
  }, [])

  return { system, setSystem, toggle }
}
