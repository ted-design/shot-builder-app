import { COMPACT_HEIGHT, TimelineBlockCard } from "@/features/schedules/components/TimelineBlockCard"
import type { OverlapGroup } from "@/features/schedules/lib/overlapGroups"
import type { Shot } from "@/shared/types"

// ─── Types ────────────────────────────────────────────────────────────

interface TimelineBlockGroupProps {
  readonly group: OverlapGroup
  readonly blockStartMin: number
  readonly pxPerMin: number
  readonly shotMap: ReadonlyMap<string, Shot>
  readonly selectedEntryId: string | null
  readonly onClickEntry: (entryId: string) => void
  readonly viewMode: "compressed" | "proportional"
}

// ─── Helpers ──────────────────────────────────────────────────────────

function computeCardHeight(
  durationMinutes: number | null,
  pxPerMin: number,
  viewMode: "compressed" | "proportional",
  isIsolated: boolean,
): number {
  if (viewMode === "compressed" && isIsolated) {
    return COMPACT_HEIGHT
  }
  const mins = durationMinutes ?? 15
  return Math.max(COMPACT_HEIGHT, Math.round(mins * pxPerMin))
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * Renders one OverlapGroup:
 * - Isolated (1 entry): single full-width card at COMPACT_HEIGHT (compressed) or proportional
 * - Overlapping (2+ entries): side-by-side sub-columns, each card proportional to duration
 */
export function TimelineBlockGroup({
  group,
  blockStartMin,
  pxPerMin,
  shotMap,
  selectedEntryId,
  onClickEntry,
  viewMode,
}: TimelineBlockGroupProps) {
  const { entries, isIsolated, startMin, endMin } = group

  // Group top offset from block start
  const topPx = (startMin - blockStartMin) * pxPerMin
  // Container height spans the full group time range
  const groupHeightPx = Math.max(
    COMPACT_HEIGHT,
    (endMin - startMin) * pxPerMin,
  )

  return (
    <div
      className="absolute left-1 right-1"
      style={{ top: `${topPx}px`, height: `${groupHeightPx}px` }}
    >
      {isIsolated ? (
        // Single card — full width, compact or proportional
        <TimelineBlockCard
          row={entries[0]!}
          shot={entries[0]!.entry.shotId ? shotMap.get(entries[0]!.entry.shotId) : undefined}
          heightPx={computeCardHeight(entries[0]!.durationMinutes, pxPerMin, viewMode, true)}
          isSelected={selectedEntryId === entries[0]!.id}
          onClick={onClickEntry}
        />
      ) : (
        // Multiple cards — side-by-side sub-columns
        <div className="flex h-full gap-1">
          {entries.map((row) => {
            const shot = row.entry.shotId ? shotMap.get(row.entry.shotId) : undefined
            const cardTopOffset = (row.startMin! - startMin) * pxPerMin
            const cardHeight = computeCardHeight(row.durationMinutes, pxPerMin, viewMode, false)

            return (
              <div
                key={row.id}
                className="relative min-w-0 flex-1"
                style={{ height: `${groupHeightPx}px` }}
              >
                <div
                  className="absolute inset-x-0"
                  style={{ top: `${cardTopOffset}px` }}
                >
                  <TimelineBlockCard
                    row={row}
                    shot={shot}
                    heightPx={cardHeight}
                    isSelected={selectedEntryId === row.id}
                    onClick={onClickEntry}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
