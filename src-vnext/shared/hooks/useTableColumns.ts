import { useCallback, useRef, useSyncExternalStore } from "react"
import { type TableColumnConfig, normalizeColumns } from "@/shared/types/table"

/**
 * Persist table column configuration in localStorage with cross-tab sync.
 * Uses `useSyncExternalStore` (same pattern as `usePersistedViewMode`).
 *
 * StorageKey format: `sb:${storageKey}` (e.g., `sb:talent-table-config`).
 */
export function useTableColumns(
  storageKey: string,
  defaultColumns: readonly TableColumnConfig[],
): {
  readonly columns: readonly TableColumnConfig[]
  readonly visibleColumns: readonly TableColumnConfig[]
  readonly setColumnWidth: (key: string, width: number) => void
  readonly toggleVisibility: (key: string) => void
  readonly reorderColumns: (orderedKeys: readonly string[]) => void
  readonly resetToDefaults: () => void
} {
  const fullKey = `sb:${storageKey}`

  // Cache the snapshot to satisfy useSyncExternalStore's referential equality requirement.
  // Only recompute when the raw localStorage string changes.
  const cacheRef = useRef<{
    raw: string | null
    result: readonly TableColumnConfig[]
  }>({ raw: undefined as unknown as string | null, result: defaultColumns })

  const subscribe = useCallback(
    (callback: () => void): (() => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === fullKey) callback()
      }
      globalThis.addEventListener("storage", handler)
      return () => globalThis.removeEventListener("storage", handler)
    },
    [fullKey],
  )

  const getSnapshot = useCallback((): readonly TableColumnConfig[] => {
    let raw: string | null = null
    try {
      raw = globalThis.localStorage?.getItem(fullKey) ?? null
    } catch {
      // localStorage may be unavailable
    }

    // Return cached result if localStorage value hasn't changed
    if (raw === cacheRef.current.raw) {
      return cacheRef.current.result
    }

    let result: readonly TableColumnConfig[]
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          result = normalizeColumns(parsed as readonly TableColumnConfig[], defaultColumns)
        } else {
          result = defaultColumns
        }
      } catch {
        result = defaultColumns
      }
    } else {
      result = defaultColumns
    }

    cacheRef.current = { raw, result }
    return result
  }, [fullKey, defaultColumns])

  const getServerSnapshot = useCallback(
    (): readonly TableColumnConfig[] => defaultColumns,
    [defaultColumns],
  )

  const columns = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const persist = useCallback(
    (next: readonly TableColumnConfig[]) => {
      try {
        globalThis.localStorage?.setItem(fullKey, JSON.stringify(next))
        globalThis.dispatchEvent(
          new StorageEvent("storage", { key: fullKey }),
        )
      } catch {
        // Ignore storage errors
      }
    },
    [fullKey],
  )

  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      const clamped = Math.max(60, Math.min(600, width))
      const next = columns.map((col) =>
        col.key === key ? { ...col, width: clamped } : col,
      )
      persist(next)
    },
    [columns, persist],
  )

  const toggleVisibility = useCallback(
    (key: string) => {
      const next = columns.map((col) =>
        col.key === key && !col.pinned ? { ...col, visible: !col.visible } : col,
      )
      persist(next)
    },
    [columns, persist],
  )

  const reorderColumns = useCallback(
    (orderedKeys: readonly string[]) => {
      const byKey = new Map(columns.map((col) => [col.key, col]))
      const next = orderedKeys.map((key, idx) => {
        const col = byKey.get(key)
        if (!col) return null
        return { ...col, order: idx }
      }).filter((col): col is TableColumnConfig => col !== null)

      // Include any columns not in orderedKeys at the end
      const orderedSet = new Set(orderedKeys)
      let nextOrder = next.length
      for (const col of columns) {
        if (!orderedSet.has(col.key)) {
          next.push({ ...col, order: nextOrder++ })
        }
      }

      persist(next)
    },
    [columns, persist],
  )

  const resetToDefaults = useCallback(() => {
    try {
      globalThis.localStorage?.removeItem(fullKey)
      globalThis.dispatchEvent(
        new StorageEvent("storage", { key: fullKey }),
      )
    } catch {
      // Ignore storage errors
    }
  }, [fullKey])

  const visibleColumns = columns
    .filter((col) => col.visible)
    .toSorted((a, b) => a.order - b.order)

  return {
    columns,
    visibleColumns,
    setColumnWidth,
    toggleVisibility,
    reorderColumns,
    resetToDefaults,
  }
}
