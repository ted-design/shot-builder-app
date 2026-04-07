import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { CheckCircle2, ExternalLink } from "lucide-react"
import type { MergeResult } from "../lib/productMergeWrites"

interface MergeResultPanelProps {
  readonly result: MergeResult
  readonly winnerName: string
  readonly onViewProduct: () => void
  readonly onClose: () => void
}

function StatRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | number
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--color-text)]">{value}</span>
    </div>
  )
}

export function MergeResultPanel({ result, winnerName, onViewProduct, onClose }: MergeResultPanelProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-status-green-bg)]">
        <CheckCircle2 className="h-8 w-8 text-[var(--color-status-green-text)]" />
      </div>

      {/* Title */}
      <div className="text-center">
        <p className="heading-section text-[var(--color-text)]">Merge complete</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {winnerName} consolidated successfully
        </p>
      </div>

      <Separator />

      {/* Stats */}
      <div className="w-full max-w-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <StatRow label="Colorways created" value={result.skusCreated} />
        <StatRow label="Colorways matched" value={result.skusMerged} />
        <StatRow label="Samples transferred" value={result.samplesTransferred} />
        <StatRow label="Comments transferred" value={result.commentsTransferred} />
        <StatRow label="Documents transferred" value={result.documentsTransferred} />
        <StatRow label="Shots updated" value={result.shotsUpdated} />
        {result.pullsUpdated > 0 && (
          <StatRow label="Pulls updated" value={result.pullsUpdated} />
        )}
        {result.requestsUpdated > 0 && (
          <StatRow label="Requests updated" value={result.requestsUpdated} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onClose}>
          Back to Products
        </Button>
        <Button onClick={onViewProduct}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          View Merged Product
        </Button>
      </div>
    </div>
  )
}
