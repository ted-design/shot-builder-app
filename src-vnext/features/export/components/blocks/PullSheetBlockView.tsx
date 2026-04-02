import { useMemo } from "react"
import type { PullSheetBlock } from "../../types/exportBuilder"
import { useExportDataContext } from "../ExportDataProvider"
import type { PullItem } from "@/shared/types"

interface PullSheetBlockViewProps {
  readonly block: PullSheetBlock
}

const FULFILLMENT_BADGE: Record<string, string> = {
  picked: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  out_of_stock: "bg-red-100 text-red-700",
}

function totalQuantity(item: PullItem): number {
  return item.sizes.reduce((sum, s) => sum + s.quantity, 0)
}

function sizeLabel(item: PullItem): string {
  return item.sizes.map((s) => s.size).join(", ") || "\u2014"
}

export function PullSheetBlockView({ block }: PullSheetBlockViewProps) {
  const { pulls } = useExportDataContext()

  const pull = useMemo(() => {
    if (pulls.length === 0) return null
    if (block.pullId) return pulls.find((p) => p.id === block.pullId) ?? null
    return pulls[0] ?? null
  }, [pulls, block.pullId])

  const showStatus = block.showFulfillmentStatus !== false

  if (!pull) {
    return (
      <div data-testid="pull-sheet-block" className="py-6 text-center text-[10px] text-gray-400 italic">
        No pull sheets in this project
      </div>
    )
  }

  const items = pull.items

  return (
    <div data-testid="pull-sheet-block" className="overflow-x-auto">
      <p className="mb-2 text-[10px] font-semibold text-gray-800">
        {pull.name ?? pull.title ?? "Pull Sheet"}
      </p>
      <table
        className="w-full border border-gray-200 text-left"
        style={{ borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Product
            </th>
            <th className="border border-gray-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Color/SKU
            </th>
            <th className="border border-gray-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Size
            </th>
            <th className="border border-gray-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Qty
            </th>
            {showStatus && (
              <th className="border border-gray-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => {
            const stripeClass = rowIndex % 2 === 1 ? "bg-gray-50" : ""
            const statusClasses =
              FULFILLMENT_BADGE[item.fulfillmentStatus] ?? "bg-gray-100 text-gray-700"
            return (
              <tr key={item.id ?? rowIndex} className={stripeClass}>
                <td className="border border-gray-200 px-3 py-1.5 text-[10px] text-gray-800">
                  {item.familyName ?? "\u2014"}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-[10px] text-gray-800">
                  {item.colourName ?? "\u2014"}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-[10px] text-gray-800">
                  {sizeLabel(item)}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-[10px] text-gray-800">
                  {totalQuantity(item)}
                </td>
                {showStatus && (
                  <td className="border border-gray-200 px-3 py-1.5 text-[10px]">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium ${statusClasses}`}>
                      {item.fulfillmentStatus}
                    </span>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-gray-500">
        {items.length} {items.length === 1 ? "item" : "items"}
      </p>
    </div>
  )
}
