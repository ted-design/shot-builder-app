import type { Timestamp } from "firebase/firestore"

export type ShootUrgency = "overdue" | "urgent" | "soon" | "upcoming" | "unscheduled"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Determines shoot urgency based on how close the launch date is.
 * Accepts a Firestore Timestamp (the format used by ShootReadinessItem.launchDate).
 */
export function getShootUrgency(
  launchDate: Timestamp | null | undefined,
): ShootUrgency {
  if (!launchDate) return "unscheduled"
  try {
    const launchMs = launchDate.toDate().getTime()
    const nowMs = Date.now()
    const daysUntil = Math.ceil((launchMs - nowMs) / DAY_MS)

    if (daysUntil < 0) return "overdue"
    if (daysUntil <= 7) return "urgent"
    if (daysUntil <= 15) return "soon"
    if (daysUntil <= 30) return "upcoming"
    return "unscheduled"
  } catch {
    return "unscheduled"
  }
}

const URGENCY_LABELS: Readonly<Record<ShootUrgency, string>> = {
  overdue: "OVERDUE",
  urgent: "URGENT",
  soon: "SOON",
  upcoming: "UPCOMING",
  unscheduled: "UNSCHEDULED",
}

export function getUrgencyLabel(urgency: ShootUrgency): string {
  return URGENCY_LABELS[urgency]
}

const URGENCY_COLORS: Readonly<Record<ShootUrgency, string>> = {
  overdue:
    "border border-[var(--color-status-red-border)] bg-[var(--color-status-red-bg)] text-[var(--color-status-red-text)]",
  urgent:
    "border border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]",
  soon:
    "border border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]",
  upcoming:
    "border border-[var(--color-status-blue-border)] bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]",
  unscheduled:
    "border border-[var(--color-status-gray-border)] bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)]",
}

export function getUrgencyColor(urgency: ShootUrgency): string {
  return URGENCY_COLORS[urgency]
}

/**
 * Returns a human-readable string describing the time until/since launch.
 * Examples: "5 days overdue", "3 days left", null for unscheduled.
 */
export function getUrgencyTimeText(
  launchDate: Timestamp | null | undefined,
): string | null {
  if (!launchDate) return null
  try {
    const launchMs = launchDate.toDate().getTime()
    const nowMs = Date.now()
    const diffMs = launchMs - nowMs
    const absDays = Math.abs(Math.ceil(diffMs / DAY_MS))

    if (diffMs < 0) {
      const overdueDays = Math.max(1, absDays)
      return `${overdueDays} day${overdueDays !== 1 ? "s" : ""} overdue`
    }
    return `${absDays} day${absDays !== 1 ? "s" : ""} left`
  } catch {
    return null
  }
}

/** Sort order for urgency tiers: lower = more urgent. */
const URGENCY_ORDER: Readonly<Record<ShootUrgency, number>> = {
  overdue: 0,
  urgent: 1,
  soon: 2,
  upcoming: 3,
  unscheduled: 4,
}

export function getUrgencySortOrder(urgency: ShootUrgency): number {
  return URGENCY_ORDER[urgency]
}
