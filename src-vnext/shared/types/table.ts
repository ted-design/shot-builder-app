/**
 * Shared table column configuration types and normalization.
 * Used by useTableColumns hook for Saturation-pattern interactive tables.
 */

export interface TableColumnConfig {
  readonly key: string
  readonly label: string
  readonly defaultLabel: string
  readonly visible: boolean
  readonly width: number       // pixels, min 60
  readonly order: number
  readonly pinned?: boolean    // always visible, not toggleable
  readonly sortable?: boolean
}

/**
 * Merge saved config with defaults — add new columns, remove deleted ones.
 *
 * - Keeps saved columns that still exist in defaults (preserving saved visibility, width, order)
 * - Adds new default columns that don't exist in saved (at the end)
 * - Removes saved columns that no longer exist in defaults
 * - Returns sorted by `order`
 */
export function normalizeColumns(
  saved: readonly TableColumnConfig[],
  defaults: readonly TableColumnConfig[],
): readonly TableColumnConfig[] {
  const defaultsByKey = new Map(defaults.map((col) => [col.key, col]))
  const savedKeys = new Set(saved.map((col) => col.key))

  // Keep saved columns that still exist in defaults
  const retained: readonly TableColumnConfig[] = saved
    .filter((col) => defaultsByKey.has(col.key))
    .map((col) => {
      const def = defaultsByKey.get(col.key)!
      return {
        ...col,
        // Preserve the default label reference so resets work
        defaultLabel: def.defaultLabel,
        pinned: def.pinned,
        sortable: def.sortable,
      }
    })

  // Find the max order in retained for appending new columns
  const maxOrder = retained.length > 0
    ? Math.max(...retained.map((col) => col.order))
    : -1

  // Add new default columns that weren't in saved
  const added: readonly TableColumnConfig[] = defaults
    .filter((col) => !savedKeys.has(col.key))
    .map((col, idx) => ({
      ...col,
      order: maxOrder + 1 + idx,
    }))

  const merged = [...retained, ...added]

  return [...merged].sort((a, b) => a.order - b.order)
}
