import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import type { DayDetails } from "@/shared/types"

interface CallSheetKeyTimesStripProps {
  readonly dayDetails: DayDetails
}

interface KeyTimeItem {
  readonly label: string
  readonly value: string | null | undefined
}

function KeyTimeCell({ item }: { readonly item: KeyTimeItem }) {
  const formatted = item.value ? (formatHHMMTo12h(item.value) || item.value) : "\u2014"
  return (
    <div className="callsheet-key-time-item">
      <span className="callsheet-key-time-label">{item.label}</span>
      {formatted}
    </div>
  )
}

/**
 * Horizontal key times strip — rendered below the schedule section.
 * Shows crew call, shooting call, meals, and estimated wrap times.
 * Uses repeated DOM approach for print (not CSS Paged Media).
 */
export function CallSheetKeyTimesStrip({ dayDetails }: CallSheetKeyTimesStripProps) {
  const items: KeyTimeItem[] = [
    { label: "Crew Call", value: dayDetails.crewCallTime },
    { label: "Shooting Call", value: dayDetails.shootingCallTime },
    { label: "1st Meal", value: dayDetails.firstMealTime },
    { label: "2nd Meal", value: dayDetails.secondMealTime },
    { label: "Est. Wrap", value: dayDetails.estimatedWrap },
  ]

  return (
    <div className="callsheet-key-times">
      {items.map((item) => (
        <KeyTimeCell key={item.label} item={item} />
      ))}
    </div>
  )
}
