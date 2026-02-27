import type { Timestamp } from "firebase/firestore"

export function formatDateTime(ts: Timestamp | undefined | null): string {
  if (!ts) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(ts.toDate())
  } catch {
    return "—"
  }
}

export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day, 12, 0, 0, 0)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let idx = 0
  let value = bytes
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  const rounded = idx === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[idx]}`
}

export function normalizeNotesSnippet(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes === "string") {
    const trimmed = notes.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(notes)) {
    const parts = notes
      .flatMap((n) => (typeof n === "string" ? [n] : []))
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return null
    return parts.join(" · ")
  }
  return null
}

export function sampleSortKey(sample: { readonly updatedAt?: Timestamp | null; readonly createdAt?: Timestamp | null }): number {
  const ts = sample.updatedAt ?? sample.createdAt
  if (!ts) return 0
  try {
    return ts.toDate().getTime()
  } catch {
    return 0
  }
}

/** Returns true if sample ETA is past due (status is requested or in_transit and ETA < now) */
export function isSampleOverdue(sample: { readonly status: string; readonly eta?: Timestamp | null }): boolean {
  if (!sample.eta) return false
  if (sample.status !== "requested" && sample.status !== "in_transit") return false
  try {
    return sample.eta.toDate().getTime() < Date.now()
  } catch {
    return false
  }
}

/** Returns true if sample ETA is within N days (status is requested or in_transit) */
export function isSampleDueSoon(sample: { readonly status: string; readonly eta?: Timestamp | null }, withinDays = 2): boolean {
  if (!sample.eta) return false
  if (sample.status !== "requested" && sample.status !== "in_transit") return false
  try {
    const etaMs = sample.eta.toDate().getTime()
    const now = Date.now()
    if (etaMs < now) return false // overdue, not "due soon"
    return etaMs - now <= withinDays * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}
