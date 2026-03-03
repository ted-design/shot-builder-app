/** Normalize unknown input to trimmed lowercase string, or null */
export function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

/** Normalize whitespace: convert \r\n to \n, collapse runs of whitespace */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim()
}

/** Convert snake_case/kebab-case to Title Case */
export function humanizeLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Parse comma-separated string into trimmed non-empty array */
export function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}
