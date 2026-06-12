import { useCallback, useSyncExternalStore } from "react"
import type { UnitSystem } from "@/features/library/lib/measurementUnits"

/**
 * Global measurement-unit preference (imperial ↔ metric), persisted to
 * localStorage and synced across every mounted consumer.
 *
 * A custom `sb:measurement-units-change` event is dispatched on change so all
 * in-page consumers update together; the hook also listens to the native
 * `storage` event for cross-tab sync. SSR / no-window environments fall back
 * to the default ('imperial') and never throw.
 */

const STORAGE_KEY = "sb:measurement-units"
const CHANGE_EVENT = "sb:measurement-units-change"
const DEFAULT_SYSTEM: UnitSystem = "imperial"
const VALID: readonly UnitSystem[] = ["imperial", "metric"]

function readSystem(): UnitSystem {
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
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, system)
  } catch {
    // Ignore storage write errors
  }
  try {
    globalThis.dispatchEvent?.(new Event(CHANGE_EVENT))
  } catch {
    // Ignore dispatch errors in non-DOM environments
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof globalThis.addEventListener !== "function") return () => {}
  const onStorage = (e: Event) => {
    if (!(e instanceof StorageEvent) || e.key === STORAGE_KEY) callback()
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
