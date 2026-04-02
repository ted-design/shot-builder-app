import { useMemo } from "react"
import type { PullSheetBlock } from "../../types/exportBuilder"
import { useExportDataContext } from "../ExportDataProvider"
import type { FulfillmentFirestoreStatus, PullItem } from "@/shared/types"
import { getFulfillmentStatusLabel } from "@/shared/lib/statusMappings"

interface PullSheetBlockViewProps {
  readonly block: PullSheetBlock
}

const FULFILLMENT_BADGE: Record<string, string> = {
  pending: "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)]",
  fulfilled: "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]",
  partial: "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]",
  substituted: "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]",
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
      <div data-testid="pull-sheet-block" className="py-6 text-center text-2xs text-[var(--color-text-subtle)] italic">
        No pull sheets in this project
      </div>
    )
  }

  const items = pull.items

  return (
    <div data-testid="pull-sheet-block" className="overflow-x-auto">
      <p className="mb-2 text-2xs font-semibold text-[var(--color-text)]">
        {pull.name ?? pull.title ?? "Pull Sheet"}
      </p>
      <table
        className="w-full border border-[var(--color-border)] text-left"
        style={{ borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr className="bg-[var(--color-surface-subtle)]">
            <th className="border border-[var(--color-border)] px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Product
            </th>
            <th className="border border-[var(--color-border)] px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Color/SKU
            </th>
            <th className="border border-[var(--color-border)] px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Size
            </th>
            <th className="border border-[var(--color-border)] px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Qty
            </th>
            {showStatus && (
              <th className="border border-[var(--color-border)] px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => {
            const stripeClass = rowIndex % 2 === 1 ? "bg-[var(--color-surface-subtle)]" : ""
            const statusClasses =
              FULFILLMENT_BADGE[item.fulfillmentStatus] ?? "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)]"
            return (
              <tr key={item.id ?? rowIndex} className={stripeClass}>
                <td className="border border-[var(--color-border)] px-3 py-1.5 text-2xs text-[var(--color-text)]">
                  {item.familyName ?? "\u2014"}
                </td>
                <td className="border border-[var(--color-border)] px-3 py-1.5 text-2xs text-[var(--color-text)]">
                  {item.colourName ?? "\u2014"}
                </td>
                <td className="border border-[var(--color-border)] px-3 py-1.5 text-2xs text-[var(--color-text)]">
                  {sizeLabel(item)}
                </td>
                <td className="border border-[var(--color-border)] px-3 py-1.5 text-2xs text-[var(--color-text)]">
                  {totalQuantity(item)}
                </td>
                {showStatus && (
                  <td className="border border-[var(--color-border)] px-3 py-1.5 text-2xs">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-3xs font-medium ${statusClasses}`}>
                      {getFulfillmentStatusLabel(item.fulfillmentStatus as FulfillmentFirestoreStatus)}
                    </span>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-2xs text-[var(--color-text-muted)]">
        {items.length} {items.length === 1 ? "item" : "items"}
      </p>
    </div>
  )
}
