import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { AlertTriangle, ArrowRight } from "lucide-react"
import type { DuplicateGroup } from "../lib/productDedup"

interface MergeDetectionPanelProps {
  readonly duplicateGroups: ReadonlyArray<DuplicateGroup>
  readonly onSelectGroup: (group: DuplicateGroup) => void
}

function DifferenceChip({ label, values }: {
  readonly label: string
  readonly values: ReadonlyArray<{ readonly value: string }>
}) {
  const uniqueValues = Array.from(new Set(values.map((v) => v.value)))
  if (uniqueValues.length < 2) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] px-2 py-0.5 text-2xs text-[var(--color-status-amber-text)]">
      {label}: {uniqueValues.join(" vs ")}
    </span>
  )
}

export function MergeDetectionPanel({ duplicateGroups, onSelectGroup }: MergeDetectionPanelProps) {
  if (duplicateGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-status-green-bg)]">
          <svg className="h-6 w-6 text-[var(--color-status-green-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="heading-section">No duplicates detected</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          All products have unique style numbers. Nothing to merge.
        </p>
      </div>
    )
  }

  const totalProducts = duplicateGroups.reduce((sum, g) => sum + g.families.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--color-status-amber-text)]" />
        <p className="text-sm text-[var(--color-text)]">
          <span className="font-semibold">{duplicateGroups.length}</span>{" "}
          duplicate group{duplicateGroups.length === 1 ? "" : "s"} detected across{" "}
          <span className="font-semibold">{totalProducts}</span> products
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        {duplicateGroups.map((group) => (
          <DuplicateGroupCard
            key={group.key}
            group={group}
            onSelect={() => onSelectGroup(group)}
          />
        ))}
      </div>
    </div>
  )
}

function DuplicateGroupCard({
  group,
  onSelect,
}: {
  readonly group: DuplicateGroup
  readonly onSelect: () => void
}) {
  const primary = group.families[0]
  if (!primary) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {primary.styleNumber && (
              <Badge variant="outline" className="text-2xs font-mono">
                {primary.styleNumber}
              </Badge>
            )}
            <span className="text-sm font-medium text-[var(--color-text)]">
              {primary.styleName}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {group.families.length} products share this style number
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onSelect}>
          Review & Merge
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      {group.differences.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {group.differences.map((diff) => (
            <DifferenceChip key={diff.field} label={diff.label} values={diff.values} />
          ))}
        </div>
      )}
    </div>
  )
}
