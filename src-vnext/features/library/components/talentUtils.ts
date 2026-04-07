import type { TalentRecord } from "@/shared/types"

export type TalentImage = NonNullable<TalentRecord["galleryImages"]>[number]
export type CastingSession = NonNullable<TalentRecord["castingSessions"]>[number]

export function buildDisplayName(talent: TalentRecord): string {
  const name = talent.name?.trim()
  if (name) return name
  const first = (talent.firstName ?? "").trim()
  const last = (talent.lastName ?? "").trim()
  const combined = `${first} ${last}`.trim()
  return combined || "Unnamed talent"
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return `${first}${last}`.toUpperCase()
}

export function normalizeImages(raw: TalentRecord["galleryImages"] | undefined): TalentImage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((img, index) => {
      if (!img || typeof img !== "object") return null
      const id = typeof img.id === "string" && img.id.trim().length > 0 ? img.id.trim() : null
      const path = typeof img.path === "string" && img.path.trim().length > 0 ? img.path.trim() : null
      if (!id || !path) return null
      const order = typeof img.order === "number" ? img.order : index
      const downloadURL =
        typeof img.downloadURL === "string" && img.downloadURL.trim().length > 0
          ? img.downloadURL.trim()
          : null
      const description =
        typeof img.description === "string" ? img.description : null
      return { ...img, id, path, downloadURL, description, order }
    })
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) as TalentImage[]
}

export function normalizeSessions(raw: TalentRecord["castingSessions"] | undefined): CastingSession[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s) => {
      if (!s || typeof s !== "object") return null
      const id = typeof s.id === "string" && s.id.trim().length > 0 ? s.id.trim() : null
      const date = typeof s.date === "string" ? s.date.trim() : ""
      if (!id || !date) return null
      const title = typeof s.title === "string" ? s.title : null
      const projectId =
        typeof s.projectId === "string" && s.projectId.trim().length > 0 ? s.projectId.trim() : null
      const location =
        typeof s.location === "string" && s.location.trim().length > 0 ? s.location.trim() : null
      const brief = typeof s.brief === "string" && s.brief.trim().length > 0 ? s.brief.trim() : null
      const decision =
        typeof s.decision === "string" && s.decision.trim().length > 0 ? s.decision.trim() : null
      const rawRating = (s as { rating?: unknown }).rating
      const parsedRating =
        typeof rawRating === "number"
          ? rawRating
          : typeof rawRating === "string"
            ? Number.parseInt(rawRating, 10)
            : null
      const rating =
        typeof parsedRating === "number" && Number.isFinite(parsedRating) && parsedRating >= 1 && parsedRating <= 5
          ? parsedRating
          : null
      const notes = typeof s.notes === "string" ? s.notes : null
      const images = normalizeImages(s.images as TalentRecord["galleryImages"])
      return { ...s, id, date, title, projectId, location, brief, decision, rating, notes, images }
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date)) as CastingSession[]
}

export const MEASUREMENT_PLACEHOLDERS: Readonly<Record<string, string>> = {
  height: `e.g. 5'9"`,
  bust: `e.g. 34"`,
  waist: `e.g. 25"`,
  chest: `e.g. 42"`,
  hips: `e.g. 35"`,
  inseam: `e.g. 32"`,
  dress: "e.g. 2",
  shoes: "e.g. 8",
  collar: `e.g. 15.5"`,
  sleeve: `e.g. 34"`,
  suit: "e.g. 40R",
}

export const SELECT_NONE = "__none__"

export const CASTING_DECISION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "shortlist", label: "Shortlist" },
  { value: "hold", label: "Hold" },
  { value: "pass", label: "Pass" },
  { value: "booked", label: "Booked" },
]
