import { useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { Settings2 } from "lucide-react"
import type { ProductFamily } from "@/shared/types"
import type { TableColumnConfig } from "@/shared/types/table"
import { ProductImage } from "@/features/products/components/ProductImage"
import { cn } from "@/shared/lib/utils"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"
import { useTableColumns } from "@/shared/hooks/useTableColumns"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import { Button } from "@/ui/button"

// ---------------------------------------------------------------------------
// Default column configuration
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: readonly TableColumnConfig[] = [
  { key: "preview", label: "Preview", defaultLabel: "Preview", visible: true, width: 56, order: 0, pinned: true },
  { key: "style", label: "Style", defaultLabel: "Style", visible: true, width: 220, order: 1, pinned: true, sortable: true },
  { key: "styleNumber", label: "Style #", defaultLabel: "Style #", visible: true, width: 120, order: 2, sortable: true },
  { key: "category", label: "Category", defaultLabel: "Category", visible: true, width: 140, order: 3 },
  { key: "colorways", label: "Colorways", defaultLabel: "Colorways", visible: true, width: 100, order: 4 },
  { key: "status", label: "Status", defaultLabel: "Status", visible: true, width: 100, order: 5 },
  { key: "updated", label: "Updated", defaultLabel: "Updated", visible: true, width: 120, order: 6 },
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUpdatedAt(value: ProductFamily["updatedAt"]): string {
  if (!value?.toDate) return "—"
  return value.toDate().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCategoryPath(family: ProductFamily): string {
  const parts = [
    family.gender ?? null,
    family.productType ?? null,
    family.productSubcategory ?? null,
  ]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => humanizeClassificationKey(p))

  return parts.length > 0 ? parts.join(" · ") : "—"
}

function formatColorways(family: ProductFamily): string {
  const activeSkuCount = family.activeSkuCount ?? null
  const skuCount = family.skuCount ?? null
  if (activeSkuCount !== null) return `${activeSkuCount} active`
  if (skuCount !== null) return `${skuCount}`
  return "—"
}

function formatStatus(family: ProductFamily): string {
  const status = (family.status ?? "active").toLowerCase()
  const parts: string[] = []
  if (family.deleted) parts.push("Deleted")
  if (family.archived) parts.push("Archived")
  if (status !== "active") parts.push(status.split("_").join(" "))
  if (parts.length === 0) return "Active"
  return parts.join(" · ")
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function renderCell(
  family: ProductFamily,
  columnKey: string,
  href: string,
): React.ReactNode {
  switch (columnKey) {
    case "preview":
      return (
        <td key="preview" className="px-3 py-2">
          <Link to={href} className="inline-flex">
            <ProductImage
              src={family.thumbnailImagePath ?? family.headerImagePath}
              alt={family.styleName}
              size="sm"
            />
          </Link>
        </td>
      )
    case "style":
      return (
        <td key="style" className="px-3 py-2">
          <Link
            to={href}
            className={cn(
              "font-medium text-[var(--color-text)] hover:underline",
              family.deleted ? "opacity-70" : "",
            )}
          >
            {family.styleName}
          </Link>
        </td>
      )
    case "styleNumber":
      return (
        <td key="styleNumber" className="px-3 py-2 text-[var(--color-text-muted)]">
          {family.styleNumber ?? "—"}
        </td>
      )
    case "category":
      return (
        <td key="category" className="px-3 py-2 text-[var(--color-text-muted)]">
          {formatCategoryPath(family)}
        </td>
      )
    case "colorways":
      return (
        <td key="colorways" className="px-3 py-2 text-[var(--color-text-muted)]">
          {formatColorways(family)}
        </td>
      )
    case "status":
      return (
        <td key="status" className="px-3 py-2 text-[var(--color-text-muted)]">
          {formatStatus(family)}
        </td>
      )
    case "updated":
      return (
        <td key="updated" className="px-3 py-2 text-[var(--color-text-muted)]">
          {formatUpdatedAt(family.updatedAt)}
        </td>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductFamiliesTable({
  families,
}: {
  readonly families: ReadonlyArray<ProductFamily>
}) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  const tableRef = useRef<HTMLTableElement>(null)

  const {
    columns,
    visibleColumns,
    setColumnWidth,
    toggleVisibility,
    reorderColumns,
    resetToDefaults,
  } = useTableColumns("products-table", DEFAULT_COLUMNS)

  const { startResize } = useColumnResize({ onWidthChange: setColumnWidth })

  const { activeRowIndex, onTableKeyDown } = useTableKeyboardNav({
    tableRef,
    rowCount: families.length,
  })

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-end border-b border-[var(--color-border)] px-3 py-1.5">
        <ColumnSettingsPopover
          columns={columns}
          onToggleVisibility={toggleVisibility}
          onReorder={reorderColumns}
          onReset={resetToDefaults}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Column settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </ColumnSettingsPopover>
      </div>

      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          onKeyDown={onTableKeyDown}
          tabIndex={0}
          className="min-w-full text-sm"
        >
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className="bg-[var(--color-surface-subtle)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              {visibleColumns.map((col) => (
                <ResizableHeader
                  key={col.key}
                  columnKey={col.key}
                  width={col.width}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left"
                >
                  {col.label}
                </ResizableHeader>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {families.map((family, i) => {
              const href = `/products/${family.id}?returnTo=${encodeURIComponent(returnTo)}`

              return (
                <tr
                  key={family.id}
                  className="hover:bg-[var(--color-surface-subtle)]"
                  data-active-row={activeRowIndex === i ? "" : undefined}
                >
                  {visibleColumns.map((col) => renderCell(family, col.key, href))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
