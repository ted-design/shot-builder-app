/**
 * Conservative measurement value parser.
 *
 * Handles real-world measurement formats found in talent records:
 *   - Height: `5'9"` or `5'9` → 69 (total inches)
 *   - Inches: `34"` → 34
 *   - Suit/dress with suffix: `40R`, `40L` → 40
 *   - Centimeters: `175cm` → 68.9 (converted to inches)
 *   - Plain numbers: `8.5` → 8.5
 *
 * Returns `null` for anything it cannot confidently parse.
 */

const FEET_INCHES_RE = /^(\d{1,2})'(\d{1,2})"?$/
const INCHES_RE = /^(\d+(?:\.\d+)?)"$/
const CM_RE = /^(\d+(?:\.\d+)?)\s*cm$/i
const SUIT_RE = /^(\d+(?:\.\d+)?)\s*[RSXL]+$/i
const PLAIN_NUMBER_RE = /^(\d+(?:\.\d+)?)$/

const CM_TO_INCHES = 0.393701

export function parseMeasurementValue(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const trimmed = value.trim()
  if (trimmed === "") return null

  // 5'9" or 5'9  → total inches
  const feetMatch = FEET_INCHES_RE.exec(trimmed)
  if (feetMatch) {
    const feet = Number(feetMatch[1])
    const inches = Number(feetMatch[2])
    if (inches >= 12) return null
    return feet * 12 + inches
  }

  // 34" → inches
  const inchesMatch = INCHES_RE.exec(trimmed)
  if (inchesMatch) {
    return Number(inchesMatch[1])
  }

  // 175cm → convert to inches
  const cmMatch = CM_RE.exec(trimmed)
  if (cmMatch) {
    const cm = Number(cmMatch[1])
    return Math.round(cm * CM_TO_INCHES * 10) / 10
  }

  // 40R, 40L, 42XL → strip suffix
  const suitMatch = SUIT_RE.exec(trimmed)
  if (suitMatch) {
    return Number(suitMatch[1])
  }

  // Plain number: 8.5
  const plainMatch = PLAIN_NUMBER_RE.exec(trimmed)
  if (plainMatch) {
    return Number(plainMatch[1])
  }

  // Unparseable — conservative null
  return null
}
