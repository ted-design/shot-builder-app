import { useMemo } from "react"
import { buildOverlapGroups, type OverlapGroup } from "@/features/schedules/lib/overlapGroups"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"

/**
 * Derives overlap groups from projected schedule rows.
 * Memoized — recomputes only when rows reference changes.
 */
export function useOverlapGroups(
  rows: readonly ProjectedScheduleRow[],
): readonly OverlapGroup[] {
  return useMemo(() => buildOverlapGroups(rows), [rows])
}
