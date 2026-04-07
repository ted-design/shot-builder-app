import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { ArrowRightLeft, Crown, Loader2 } from "lucide-react"
import type { ProductFamily } from "@/shared/types"
import { cn } from "@/shared/lib/utils"

interface MergeComparePanelProps {
  readonly winner: ProductFamily
  readonly loser: ProductFamily
  readonly planLoading: boolean
  readonly onSwap: () => void
  readonly onPlanMerge: () => void
}

function formatDate(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "--"
  const asAny = ts as { toDate?: () => Date; seconds?: number }
  if (typeof asAny.toDate === "function") {
    return asAny.toDate().toLocaleDateString()
  }
  if (typeof asAny.seconds === "number") {
    return new Date(asAny.seconds * 1000).toLocaleDateString()
  }
  return "--"
}

interface CompareField {
  readonly label: string
  readonly winnerValue: string
  readonly loserValue: string
}

function buildCompareFields(winner: ProductFamily, loser: ProductFamily): ReadonlyArray<CompareField> {
  return [
    { label: "Style Name", winnerValue: winner.styleName, loserValue: loser.styleName },
    { label: "Style Number", winnerValue: winner.styleNumber ?? "--", loserValue: loser.styleNumber ?? "--" },
    { label: "Category", winnerValue: winner.category ?? "--", loserValue: loser.category ?? "--" },
    { label: "Gender", winnerValue: winner.gender ?? "--", loserValue: loser.gender ?? "--" },
    { label: "Product Type", winnerValue: winner.productType ?? "--", loserValue: loser.productType ?? "--" },
    { label: "Colorways", winnerValue: String(winner.skuCount ?? 0), loserValue: String(loser.skuCount ?? 0) },
    { label: "Samples", winnerValue: String(winner.sampleCount ?? 0), loserValue: String(loser.sampleCount ?? 0) },
    { label: "Active Reqs", winnerValue: String(winner.activeRequirementCount ?? 0), loserValue: String(loser.activeRequirementCount ?? 0) },
    { label: "Shot Refs", winnerValue: String(winner.shotIds?.length ?? 0), loserValue: String(loser.shotIds?.length ?? 0) },
    { label: "Created", winnerValue: formatDate(winner.createdAt), loserValue: formatDate(loser.createdAt) },
    { label: "Updated", winnerValue: formatDate(winner.updatedAt), loserValue: formatDate(loser.updatedAt) },
  ]
}

function ProductCard({
  family,
  isWinner,
}: {
  readonly family: ProductFamily
  readonly isWinner: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border p-4",
        isWinner
          ? "border-[var(--color-status-green-border)] bg-[var(--color-status-green-bg)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      <div className="flex items-center gap-2">
        {isWinner && <Crown className="h-4 w-4 text-[var(--color-status-green-text)]" />}
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          {isWinner ? "Keep (winner)" : "Merge into winner (loser)"}
        </span>
      </div>
      <p className="text-sm font-semibold text-[var(--color-text)]">
        {family.styleName}
      </p>
      {family.styleNumber && (
        <Badge variant="outline" className="w-fit text-2xs font-mono">
          {family.styleNumber}
        </Badge>
      )}
      <p className="text-2xs text-[var(--color-text-muted)]">
        ID: {family.id}
      </p>
    </div>
  )
}

export function MergeComparePanel({
  winner,
  loser,
  planLoading,
  onSwap,
  onPlanMerge,
}: MergeComparePanelProps) {
  const fields = buildCompareFields(winner, loser)

  return (
    <div className="flex flex-col gap-4">
      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ProductCard family={winner} isWinner />
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Swap winner and loser"
            onClick={onSwap}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>
        <ProductCard family={loser} isWinner={false} />
      </div>

      <Separator />

      {/* Field comparison table */}
      <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-subtle)]">
                Field
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-status-green-text)]">
                Winner
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-subtle)]">
                Loser
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const isDifferent = f.winnerValue !== f.loserValue
              return (
                <tr
                  key={f.label}
                  className={cn(
                    "border-b border-[var(--color-border)] last:border-b-0",
                    isDifferent && "bg-[var(--color-status-amber-bg)]",
                  )}
                >
                  <td className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                    {f.label}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-[var(--color-text)]">
                    {f.winnerValue}
                  </td>
                  <td className={cn(
                    "px-3 py-1.5 text-xs",
                    isDifferent
                      ? "text-[var(--color-status-amber-text)]"
                      : "text-[var(--color-text-muted)]",
                  )}>
                    {f.loserValue}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Separator />

      {/* Action */}
      <div className="flex justify-end">
        <Button onClick={onPlanMerge} disabled={planLoading}>
          {planLoading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {"Planning merge\u2026"}
            </>
          ) : (
            "Plan Merge"
          )}
        </Button>
      </div>
    </div>
  )
}
