export function normalizeColorName(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}

export function buildColorKey(value: unknown): string {
  const normalized = normalizeColorName(value)
  if (!normalized) return "color"
  const key = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return key || "color"
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null

  const withHash = raw.startsWith("#") ? raw : `#${raw}`
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null
  return withHash.toUpperCase()
}

export function isValidHexColor(value: unknown): boolean {
  return normalizeHexColor(value) !== null
}

