import { Link, useLocation } from "react-router-dom"
import type { ProductFamily } from "@/shared/types"
import { ProductImage } from "@/features/products/components/ProductImage"
import type { ProductTableColumnVisibility } from "@/features/products/lib/productPreferences"
import { cn } from "@/shared/lib/utils"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"

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

export function ProductFamiliesTable({
  families,
  columns,
}: {
  readonly families: ReadonlyArray<ProductFamily>
  readonly columns: ProductTableColumnVisibility
}) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-subtle)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              {columns.preview && <th className="w-14 px-3 py-2 text-left">Preview</th>}
              <th className="min-w-[220px] px-3 py-2 text-left">Style</th>
              {columns.styleNumber && <th className="px-3 py-2 text-left">Style #</th>}
              {columns.category && <th className="min-w-[220px] px-3 py-2 text-left">Category</th>}
              {columns.colorways && <th className="px-3 py-2 text-left">Colorways</th>}
              {columns.status && <th className="min-w-[180px] px-3 py-2 text-left">Status</th>}
              {columns.updatedAt && <th className="px-3 py-2 text-left">Updated</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {families.map((family) => {
              const href = `/products/${family.id}?returnTo=${encodeURIComponent(returnTo)}`

              return (
                <tr key={family.id} className="hover:bg-[var(--color-surface-subtle)]">
                  {columns.preview && (
                    <td className="px-3 py-2">
                      <Link to={href} className="inline-flex">
                        <ProductImage
                          src={family.thumbnailImagePath ?? family.headerImagePath}
                          alt={family.styleName}
                          size="sm"
                        />
                      </Link>
                    </td>
                  )}
                  <td className="px-3 py-2">
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
                  {columns.styleNumber && (
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {family.styleNumber ?? "—"}
                    </td>
                  )}
                  {columns.category && (
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {formatCategoryPath(family)}
                    </td>
                  )}
                  {columns.colorways && (
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {formatColorways(family)}
                    </td>
                  )}
                  {columns.status && (
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {formatStatus(family)}
                    </td>
                  )}
                  {columns.updatedAt && (
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {formatUpdatedAt(family.updatedAt)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
