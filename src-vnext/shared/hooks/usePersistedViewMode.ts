import { useCallback, useSyncExternalStore } from "react"

/**
 * Persist a view mode string in localStorage with cross-tab sync.
 * Uses `useSyncExternalStore` so React re-renders on storage changes.
 */
export function usePersistedViewMode<T extends string>(
  storageKey: string,
  defaultMode: T,
  validModes: readonly T[],
): [T, (mode: T) => void] {
  const subscribe = useCallback(
    (callback: () => void): (() => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === storageKey) callback()
      }
      globalThis.addEventListener("storage", handler)
      return () => globalThis.removeEventListener("storage", handler)
    },
    [storageKey],
  )

  const getSnapshot = useCallback((): T => {
    try {
      const stored = globalThis.localStorage?.getItem(storageKey)
      if (stored !== null && (validModes as readonly string[]).includes(stored)) {
        return stored as T
      }
    } catch {
      // localStorage may be unavailable
    }
    return defaultMode
  }, [storageKey, defaultMode, validModes])

  const getServerSnapshot = useCallback((): T => defaultMode, [defaultMode])

  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setMode = useCallback(
    (mode: T) => {
      try {
        globalThis.localStorage?.setItem(storageKey, mode)
        globalThis.dispatchEvent(
          new StorageEvent("storage", { key: storageKey }),
        )
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey],
  )

  return [current, setMode]
}
