export function parseTimeToMinutes(input: string | null | undefined): number | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  const upper = trimmed.toUpperCase()

  // 12h: "6:00 AM", "6 AM", "6:00AM"
  const match12 = upper.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/)
  if (match12) {
    const hoursRaw = Number.parseInt(match12[1]!, 10)
    const minutesRaw = match12[2] ? Number.parseInt(match12[2], 10) : 0
    if (!Number.isFinite(hoursRaw) || !Number.isFinite(minutesRaw)) return null
    if (hoursRaw < 1 || hoursRaw > 12) return null
    if (minutesRaw < 0 || minutesRaw > 59) return null
    const period = match12[3]!

    let hours = hoursRaw % 12
    if (period === "PM") hours += 12
    return hours * 60 + minutesRaw
  }

  // 24h: "06:00", "6:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const hours = Number.parseInt(match24[1]!, 10)
    const minutes = Number.parseInt(match24[2]!, 10)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    if (hours < 0 || hours > 23) return null
    if (minutes < 0 || minutes > 59) return null
    return hours * 60 + minutes
  }

  return null
}

function looksTimeLike(input: string): boolean {
  const upper = input.toUpperCase()
  if (/\d/.test(upper)) return true
  if (upper.includes(":")) return true
  if (upper.includes("AM") || upper.includes("PM")) return true
  return false
}

export function minutesToHHMM(minutes: number): string {
  const clamped = ((Math.floor(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function formatMinutesTo12h(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return ""
  const total = ((Math.floor(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  const ampm = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`
}

export function formatHHMMTo12h(hhmm: string | null | undefined): string {
  const mins = parseTimeToMinutes(hhmm)
  return formatMinutesTo12h(mins)
}

export type ClassifiedTimeInput =
  | { readonly kind: "empty" }
  | { readonly kind: "time"; readonly canonical: string }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "invalid-time" }

export function classifyTimeInput(
  input: string | null | undefined,
  options?: { readonly allowText?: boolean },
): ClassifiedTimeInput {
  const trimmed = (input ?? "").trim()
  if (!trimmed) return { kind: "empty" }

  const minutes = parseTimeToMinutes(trimmed)
  if (minutes != null) {
    return { kind: "time", canonical: minutesToHHMM(minutes) }
  }

  const allowText = options?.allowText === true
  if (allowText && !looksTimeLike(trimmed)) {
    return { kind: "text", text: trimmed }
  }

  return { kind: "invalid-time" }
}
