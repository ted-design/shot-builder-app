const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function isTimestampLike(value: unknown): value is { readonly toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { readonly toDate?: unknown }).toDate === "function"
  )
}

function parseDateOnlyToUtcDate(value: string): Date | null {
  if (!DATE_ONLY_RE.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function formatShootDate(value: string): string {
  const d = parseDateOnlyToUtcDate(value)
  if (!d) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d)
}

export function normalizeShootDates(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const out: string[] = []
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim()
      if (DATE_ONLY_RE.test(trimmed)) out.push(trimmed)
      continue
    }

    if (isTimestampLike(entry)) {
      try {
        const d = entry.toDate()
        if (!Number.isNaN(d.getTime())) {
          out.push(d.toISOString().slice(0, 10))
        }
      } catch {
        // ignore
      }
    }
  }

  // Stable ordering and de-dupe. YYYY-MM-DD sorts lexicographically.
  return Array.from(new Set(out)).sort()
}

export function formatShootDateRange(dates: readonly string[]): string {
  if (!dates || dates.length === 0) return "No dates set"

  const first = parseDateOnlyToUtcDate(dates[0]!)
  if (!first) return "No dates set"

  if (dates.length === 1) return formatShootDate(dates[0]!)

  const last = parseDateOnlyToUtcDate(dates[dates.length - 1]!) ?? first
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  const startLabel = fmt.format(first)
  const endLabel = fmt.format(last)
  if (startLabel === endLabel) return startLabel
  return `${startLabel} - ${endLabel}`
}
