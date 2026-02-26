import type { Shot } from "@/shared/types"

/**
 * Scans all shots and returns the highest numeric suffix found in shot numbers.
 * Shot numbers follow the pattern `SH-001`, `SH-042`, etc.
 * Returns 0 if no shots have numbers.
 */
export function computeMaxShotNumber(shots: ReadonlyArray<Shot>): number {
  let max = 0
  for (const shot of shots) {
    const num = shot.shotNumber
    if (!num) continue
    const match = num.match(/(\d+)$/)
    if (match) {
      const n = parseInt(match[1]!, 10)
      if (n > max) max = n
    }
  }
  return max
}

/**
 * Formats a numeric shot number into the canonical `SH-###` string.
 * Pads to at least 3 digits: 1 -> "SH-001", 42 -> "SH-042", 1000 -> "SH-1000".
 */
export function formatShotNumber(n: number): string {
  return `SH-${String(n).padStart(3, "0")}`
}

/**
 * Computes the next shot number for a new shot in the given project.
 * Convenience wrapper combining `computeMaxShotNumber` + `formatShotNumber`.
 */
export function nextShotNumber(shots: ReadonlyArray<Shot>): string {
  return formatShotNumber(computeMaxShotNumber(shots) + 1)
}
