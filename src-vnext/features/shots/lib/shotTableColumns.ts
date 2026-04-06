import type { TableColumnConfig } from "@/shared/types/table"
import type { ShotsListFields } from "./shotListFilters"

// ---------------------------------------------------------------------------
// Default column definitions
// ---------------------------------------------------------------------------

/** All possible shot table columns with default pixel widths. */
export const SHOT_TABLE_COLUMNS: readonly TableColumnConfig[] = [
  { key: "heroThumb", label: "Thumb", defaultLabel: "Thumb", visible: true, width: 56, order: 0 },
  { key: "shot", label: "Shot", defaultLabel: "Shot", visible: true, width: 260, order: 1, pinned: true },
  { key: "date", label: "Date", defaultLabel: "Date", visible: true, width: 120, order: 2 },
  { key: "notes", label: "Notes", defaultLabel: "Notes", visible: true, width: 260, order: 3 },
  { key: "location", label: "Location", defaultLabel: "Location", visible: true, width: 160, order: 4 },
  { key: "products", label: "Products", defaultLabel: "Products", visible: true, width: 280, order: 5 },
  { key: "links", label: "Links", defaultLabel: "Links", visible: true, width: 220, order: 6 },
  { key: "talent", label: "Talent", defaultLabel: "Talent", visible: true, width: 220, order: 7 },
  { key: "tags", label: "Tags", defaultLabel: "Tags", visible: true, width: 180, order: 8 },
  { key: "updated", label: "Updated", defaultLabel: "Updated", visible: true, width: 110, order: 9 },
]

// ---------------------------------------------------------------------------
// Mapping between column keys and ShotsListFields keys
// ---------------------------------------------------------------------------

/** Map of column key -> ShotsListFields key (null = always visible / pinned). */
const COLUMN_TO_FIELD: Record<string, keyof ShotsListFields | null> = {
  heroThumb: "heroThumb",
  shot: null, // pinned, always visible
  date: "date",
  notes: "notes",
  location: "location",
  products: "products",
  links: "links",
  talent: "talent",
  tags: "tags",
  updated: "updated",
}

// ---------------------------------------------------------------------------
// Adapter functions
// ---------------------------------------------------------------------------

/** Convert ShotsListFields boolean flags to TableColumnConfig[] for the popover. */
export function fieldsToColumnConfigs(
  fields: ShotsListFields,
  savedWidths?: Record<string, number>,
): readonly TableColumnConfig[] {
  return SHOT_TABLE_COLUMNS.map((col) => {
    const fieldKey = COLUMN_TO_FIELD[col.key]
    const visible = fieldKey == null ? true : fields[fieldKey] ?? col.visible
    const width = savedWidths?.[col.key] ?? col.width
    return { ...col, visible, width }
  })
}

/** Convert a column visibility toggle back to ShotsListFields key. */
export function columnKeyToFieldKey(columnKey: string): keyof ShotsListFields | null {
  return COLUMN_TO_FIELD[columnKey] ?? null
}

// ---------------------------------------------------------------------------
// Share link column configuration
// ---------------------------------------------------------------------------

/** Lightweight column entry persisted in the shotShares Firestore document. */
export interface ShareColumnEntry {
  readonly key: string
  readonly visible: boolean
  readonly order: number
}

/** Columns available for public share views (excludes heroThumb, updated). */
export const PUBLIC_SHARE_COLUMNS: readonly TableColumnConfig[] = [
  { key: "shot", label: "Shot", defaultLabel: "Shot", visible: true, width: 260, order: 0, pinned: true },
  { key: "description", label: "Description", defaultLabel: "Description", visible: true, width: 220, order: 1 },
  { key: "date", label: "Date", defaultLabel: "Date", visible: true, width: 120, order: 2 },
  { key: "location", label: "Location", defaultLabel: "Location", visible: true, width: 160, order: 3 },
  { key: "talent", label: "Talent", defaultLabel: "Talent", visible: true, width: 220, order: 4 },
  { key: "products", label: "Products", defaultLabel: "Products", visible: true, width: 280, order: 5 },
  { key: "tags", label: "Tags", defaultLabel: "Tags", visible: true, width: 180, order: 6 },
  { key: "notes", label: "Notes", defaultLabel: "Notes", visible: false, width: 260, order: 7 },
  { key: "links", label: "Links", defaultLabel: "Links", visible: false, width: 220, order: 8 },
  { key: "status", label: "Status", defaultLabel: "Status", visible: true, width: 110, order: 9 },
]

/** Merge saved share column entries with PUBLIC_SHARE_COLUMNS defaults.
 * Applies saved visibility/order, adds any new default columns missing from saved config. */
export function mergeShareColumnConfig(
  saved: readonly ShareColumnEntry[] | null | undefined,
): readonly TableColumnConfig[] {
  if (!saved || saved.length === 0) return PUBLIC_SHARE_COLUMNS

  const savedMap = new Map(saved.map((e) => [e.key, e]))
  const merged = PUBLIC_SHARE_COLUMNS.map((col) => {
    const entry = savedMap.get(col.key)
    if (!entry) return col
    return {
      ...col,
      visible: typeof entry.visible === "boolean" ? entry.visible : col.visible,
      order: Number.isFinite(entry.order) ? entry.order : col.order,
    }
  })
  return [...merged].sort((a, b) => a.order - b.order)
}
