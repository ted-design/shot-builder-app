import { useMemo } from "react"
import type { ProductTableBlock } from "../../types/exportBuilder"
import { useExportDataContext } from "../ExportDataProvider"
import type { ProductFamily } from "@/shared/types"

interface ProductTableBlockViewProps {
  readonly block: ProductTableBlock
}

function getCellValue(family: ProductFamily, columnKey: string): string {
  switch (columnKey) {
    case "styleName":
      return family.styleName
    case "styleNumber":
      return family.styleNumbers?.[0] ?? family.styleNumber ?? "\u2014"
    case "gender":
      return family.gender ?? "\u2014"
    case "skuCount":
      return family.skuCount != null ? String(family.skuCount) : "\u2014"
    case "classification":
      return family.category ?? "\u2014"
    default:
      return "\u2014"
  }
}

export function ProductTableBlockView({ block }: ProductTableBlockViewProps) {
  const { productFamilies } = useExportDataContext()

  const families = useMemo(
    () => productFamilies.filter((f) => f.deleted !== true),
    [productFamilies],
  )

  const visibleColumns = block.columns.filter((c) => c.visible)
  const style = block.tableStyle

  const borderClass = style?.showBorders ? "border border-gray-200" : ""
  const cellBorderClass = style?.showBorders ? "border border-gray-200" : ""
  const headerBgClass = style?.showHeaderBg ? "bg-gray-50" : ""
  const radiusStyle = style?.cornerRadius
    ? { borderRadius: `${String(style.cornerRadius)}px` }
    : undefined

  if (families.length === 0) {
    return (
      <div data-testid="product-table-block" className="py-6 text-center text-[10px] text-gray-400 italic">
        No products in library
      </div>
    )
  }

  return (
    <div data-testid="product-table-block" className="overflow-x-auto">
      <table
        className={`w-full text-left ${borderClass}`}
        style={{ ...radiusStyle, borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr className={headerBgClass}>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 ${cellBorderClass}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {families.map((family, rowIndex) => {
            const stripeClass =
              style?.stripeRows && rowIndex % 2 === 1 ? "bg-gray-50" : ""
            return (
              <tr key={family.id} className={stripeClass}>
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 text-[10px] text-gray-800 ${cellBorderClass}`}
                  >
                    {getCellValue(family, col.key)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-gray-500">
        {families.length} product {families.length === 1 ? "family" : "families"}
      </p>
    </div>
  )
}
