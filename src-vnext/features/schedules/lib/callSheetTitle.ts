import type { Schedule } from "@/shared/types"

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
}

export function deriveDefaultCallSheetTitle(schedule: Schedule): string {
  if (schedule.date) {
    return schedule.date.toDate().toLocaleDateString("en-US", DATE_FORMAT_OPTIONS)
  }
  const trimmed = schedule.name.trim()
  if (trimmed.length > 0) {
    return trimmed
  }
  return "Call Sheet"
}
