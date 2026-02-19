import { useMemo } from "react"
import {
  buildAdaptiveLayout,
  type AdaptiveTimelineLayout,
} from "@/features/schedules/lib/adaptiveSegments"
import { buildScheduleProjection } from "@/features/schedules/lib/projection"
import type { Schedule, ScheduleEntry } from "@/shared/types"

export function useAdaptiveSegments(
  schedule: Schedule | null,
  entries: readonly ScheduleEntry[],
): AdaptiveTimelineLayout {
  return useMemo(() => {
    const projection = buildScheduleProjection({
      schedule,
      entries,
      mode: "time",
    })
    return buildAdaptiveLayout(projection)
  }, [schedule, entries])
}
