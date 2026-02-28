import type { Timestamp } from "firebase/firestore"

/**
 * Formats a Firestore Timestamp as a relative time string.
 * e.g. "just now", "5m ago", "2h ago", "3d ago", "2w ago"
 */
export function formatRelativeTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp || typeof timestamp.toMillis !== "function") return ""

  const now = Date.now()
  const then = timestamp.toMillis()
  const diffMs = now - then

  if (diffMs < 0) return "just now"

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${years}y ago`
}
