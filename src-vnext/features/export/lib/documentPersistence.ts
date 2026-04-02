import type { ExportBlock, ExportDocument, ExportTemplate, ExportPage, PageItem } from "../types/exportBuilder"
import { isHStackRow } from "../types/exportBuilder"

const DOCUMENT_KEY_PREFIX = "sb:export-doc:"
const TEMPLATES_KEY = "sb:export-templates"

const PRODUCT_TABLE_KEY_MIGRATION: Record<string, string> = {
  name: "styleName",
  sku: "styleNumber",
  colorway: "gender",
  launchDate: "skuCount",
  status: "classification",
}

function migrateBlockColumns(block: ExportBlock): ExportBlock {
  if (block.type !== "product-table") return block
  const needsMigration = block.columns.some(
    (c) => c.key in PRODUCT_TABLE_KEY_MIGRATION,
  )
  if (!needsMigration) return block
  return {
    ...block,
    columns: block.columns.map((col) => {
      const newKey = PRODUCT_TABLE_KEY_MIGRATION[col.key]
      if (!newKey) return col
      const LABELS: Record<string, string> = {
        styleName: "Style Name",
        styleNumber: "Style #",
        gender: "Gender",
        skuCount: "SKUs",
        classification: "Classification",
      }
      return { ...col, key: newKey, label: LABELS[newKey] ?? col.label }
    }),
  }
}

function migrateProductTableColumns(pages: readonly ExportPage[]): readonly ExportPage[] {
  let changed = false
  const migrated = pages.map((page) => {
    const newItems = page.items.map((item): PageItem => {
      if (isHStackRow(item)) {
        const newCols = item.columns.map((col) => {
          const newBlocks = col.blocks.map(migrateBlockColumns)
          const colChanged = newBlocks.some((b, i) => b !== col.blocks[i])
          if (!colChanged) return col
          changed = true
          return { ...col, blocks: newBlocks }
        })
        const rowChanged = newCols.some((c, i) => c !== item.columns[i])
        return rowChanged ? { ...item, columns: newCols } : item
      }
      const result = migrateBlockColumns(item)
      if (result !== item) changed = true
      return result
    })
    const pageChanged = newItems.some((it, i) => it !== page.items[i])
    return pageChanged ? { ...page, items: newItems } : page
  })
  return changed ? migrated : pages
}

/** Migrate legacy documents that use `blocks` to the new `items` field */
function migrateBlocksToItems(doc: ExportDocument): ExportDocument {
  const needsMigration = doc.pages.some(
    (page) =>
      !(page as unknown as { items?: unknown }).items &&
      (page as unknown as { blocks?: unknown }).blocks,
  )
  if (!needsMigration) return doc

  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if ((page as unknown as { items?: unknown }).items) return page
      const legacyBlocks =
        ((page as unknown as { blocks?: ExportBlock[] }).blocks) ?? []
      return { ...page, items: legacyBlocks }
    }),
  }
}

/**
 * @deprecated Firestore `exportReports` subcollection is the primary store.
 * localStorage is kept as an offline fallback and for legacy data import.
 * See `useExportReports` hook for the Firestore-based persistence.
 */
export function saveDocument(projectId: string, doc: ExportDocument): void {
  try {
    const key = `${DOCUMENT_KEY_PREFIX}${projectId}`
    localStorage.setItem(key, JSON.stringify(doc))
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/**
 * @deprecated Firestore `exportReports` subcollection is the primary store.
 * localStorage is kept as an offline fallback and for legacy data import.
 * See `useExportReports` hook for the Firestore-based persistence.
 */
export function loadDocument(projectId: string): ExportDocument | null {
  try {
    const key = `${DOCUMENT_KEY_PREFIX}${projectId}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const doc = JSON.parse(raw) as ExportDocument
    const withItems = migrateBlocksToItems(doc)
    const migratedPages = migrateProductTableColumns(withItems.pages)
    if (migratedPages === withItems.pages && withItems === doc) return doc
    return { ...withItems, pages: migratedPages }
  } catch {
    return null
  }
}

/** Save a user template to localStorage */
export function saveTemplate(template: ExportTemplate): void {
  try {
    const existing = loadTemplates()
    const filtered = existing.filter((t) => t.id !== template.id)
    const updated = [...filtered, template]
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated))
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/** Load all saved user templates from localStorage */
export function loadTemplates(): ExportTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ExportTemplate[]
  } catch {
    return []
  }
}

/** Delete a saved user template by id */
export function deleteTemplate(templateId: string): void {
  try {
    const existing = loadTemplates()
    const filtered = existing.filter((t) => t.id !== templateId)
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered))
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}
