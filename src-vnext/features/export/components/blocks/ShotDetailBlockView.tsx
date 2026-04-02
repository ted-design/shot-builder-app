import { useMemo } from "react"
import { useExportDataContext } from "../ExportDataProvider"
import type { ShotDetailBlock } from "../../types/exportBuilder"
import type { Shot } from "@/shared/types"

interface ShotDetailBlockViewProps {
  readonly block: ShotDetailBlock
}

const STATUS_LABELS: Record<string, string> = {
  todo: "Draft",
  in_progress: "In Progress",
  on_hold: "On Hold",
  complete: "Shot",
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  complete: "bg-green-100 text-green-700",
}

function resolveProductNames(shot: Shot): readonly string[] {
  const productNames = shot.products
    .map((p) => p.familyName)
    .filter((n): n is string => Boolean(n))

  const lookNames = (shot.looks ?? [])
    .flatMap((look) => look.products.map((p) => p.familyName))
    .filter((n): n is string => Boolean(n))

  return [...new Set([...productNames, ...lookNames])]
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
        className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400"
      >
        Shot not found — it may have been deleted.
      </div>
    )
  }

  if (!shot) {
    return (
      <div
        data-testid="shot-detail-block"
        className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400"
      >
        Select a shot in the settings panel.
      </div>
    )
  }

  const statusLabel = STATUS_LABELS[shot.status] ?? shot.status
  const statusClasses = STATUS_BADGE_CLASSES[shot.status] ?? "bg-gray-100 text-gray-700"
  const showDescription = block.showDescription !== false
  const showNotes = block.showNotes !== false
  const showProducts = block.showProducts !== false
  const productNames = showProducts ? resolveProductNames(shot) : []

  return (
    <div data-testid="shot-detail-block" className="flex gap-4">
      {/* Hero image placeholder */}
      <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded bg-gray-200">
        <span className="text-xs text-gray-400">Hero Image</span>
      </div>

      {/* Metadata */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            #{String(shot.shotNumber ?? "0").padStart(3, "0")} {shot.title}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>

        {showDescription && shot.description && (
          <p className="text-sm text-gray-600">{shot.description}</p>
        )}

        {showNotes && shot.notes && (
          <p className="text-xs text-gray-400">{shot.notes}</p>
        )}

        {showProducts && productNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {productNames.map((name) => (
              <span
                key={name}
                className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
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
