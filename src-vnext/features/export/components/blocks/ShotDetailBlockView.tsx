import { useMemo } from "react"
import { useExportDataContext } from "../ExportDataProvider"
import type { ShotDetailBlock } from "../../types/exportBuilder"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import { resolveProductNamesList } from "../../lib/blockDataResolvers"

interface ShotDetailBlockViewProps {
  readonly block: ShotDetailBlock
}

function statusBadgeClasses(status: string): string {
  const color = getShotStatusColor(status as ShotFirestoreStatus)
  return `bg-[var(--color-status-${color}-bg)] text-[var(--color-status-${color}-text)]`
}

export function ShotDetailBlockView({ block }: ShotDetailBlockViewProps) {
  const { shots } = useExportDataContext()

  const shot = useMemo<Shot | undefined>(() => {
    if (block.shotId) {
      return shots.find((s) => s.id === block.shotId)
    }
    return undefined
  }, [shots, block.shotId])

  if (block.shotId && !shot) {
    return (
      <div
        data-testid="shot-detail-block"
        className="rounded border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-subtle)]"
      >
        Shot not found — it may have been deleted.
      </div>
    )
  }

  if (!shot) {
    return (
      <div
        data-testid="shot-detail-block"
        className="rounded border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-subtle)]"
      >
        Select a shot in the settings panel.
      </div>
    )
  }

  const statusLabel = getShotStatusLabel(shot.status as ShotFirestoreStatus)
  const statusClasses = statusBadgeClasses(shot.status)
  const showHeroImage = block.showHeroImage !== false
  const showDescription = block.showDescription !== false
  const showNotes = block.showNotes !== false
  const showProducts = block.showProducts !== false
  const productNames = showProducts ? resolveProductNamesList(shot) : []

  return (
    <div data-testid="shot-detail-block" className="flex gap-4">
      {showHeroImage && (
        <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded bg-[var(--color-surface-muted)]">
          <span className="text-xs text-[var(--color-text-subtle)]">Hero Image</span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">
            #{String(shot.shotNumber ?? "0").padStart(3, "0")} {shot.title}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>

        {showDescription && shot.description && (
          <p className="text-sm text-[var(--color-text-muted)]">{shot.description}</p>
        )}

        {showNotes && shot.notes && (
          <p className="text-xs text-[var(--color-text-subtle)]">{shot.notes}</p>
        )}

        {showProducts && productNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {productNames.map((name) => (
              <span
                key={name}
                className="inline-flex rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
