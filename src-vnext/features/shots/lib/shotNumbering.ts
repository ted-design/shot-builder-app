import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import type { Shot } from "@/shared/types"

const BATCH_CHUNK_SIZE = 250

/**
 * Scans all shots and returns the highest numeric suffix found in shot numbers.
 * Shot numbers follow the pattern `01`, `02`, etc. (legacy: `SH-001`).
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
 * Formats a numeric shot number into a zero-padded string.
 * Pads to at least 2 digits: 1 -> "01", 42 -> "42", 100 -> "100".
 */
export function formatShotNumber(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Computes the next shot number for a new shot in the given project.
 * Convenience wrapper combining `computeMaxShotNumber` + `formatShotNumber`.
 */
export function nextShotNumber(shots: ReadonlyArray<Shot>): string {
  return formatShotNumber(computeMaxShotNumber(shots) + 1)
}

/**
 * Renumber all shots sequentially starting from 01 based on their current display order.
 * Also updates `sortOrder` to bake in the display order permanently.
 * Skips shots that already have the correct number and sortOrder.
 * Chunks at 250 to stay within Firestore batch limits.
 */
const MAX_RENUMBER_SHOTS = 2000

export async function renumberShots(
  shots: ReadonlyArray<Shot>,
  clientId: string,
  startNumber: number = 1,
): Promise<number> {
  if (startNumber < 1) {
    throw new Error("startNumber must be >= 1")
  }
  if (shots.length > MAX_RENUMBER_SHOTS) {
    throw new Error(`Cannot renumber more than ${MAX_RENUMBER_SHOTS} shots at once.`)
  }
  const updates: ReadonlyArray<{ shotId: string; newNumber: string; newSortOrder: number }> = shots.reduce<
    Array<{ shotId: string; newNumber: string; newSortOrder: number }>
  >((acc, shot, i) => {
    const newNumber = formatShotNumber(i + startNumber)
    const newSortOrder = i
    if (shot.shotNumber === newNumber && shot.sortOrder === newSortOrder) return acc
    return [...acc, { shotId: shot.id, newNumber, newSortOrder }]
  }, [])

  if (updates.length === 0) return 0

  for (let start = 0; start < updates.length; start += BATCH_CHUNK_SIZE) {
    const chunk = updates.slice(start, start + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const { shotId, newNumber, newSortOrder } of chunk) {
      const path = shotPath(shotId, clientId)
      const ref = doc(db, path[0]!, ...path.slice(1))
      batch.update(ref, {
        shotNumber: newNumber,
        sortOrder: newSortOrder,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }

  return updates.length
}

/**
 * Preview what renumbering would change. Returns an array of changes
 * for shots that would change, plus the total count that would be unchanged.
 */
export function previewRenumber(
  shots: ReadonlyArray<Shot>,
  startNumber: number = 1,
): {
  readonly changes: ReadonlyArray<{
    readonly shotId: string
    readonly title: string
    readonly currentNumber: string
    readonly newNumber: string
  }>
  readonly unchangedCount: number
} {
  const safeStart = Math.max(1, startNumber)
  let unchangedCount = 0
  const changes = shots.reduce<
    Array<{ shotId: string; title: string; currentNumber: string; newNumber: string }>
  >((acc, shot, i) => {
    const newNumber = formatShotNumber(i + safeStart)
    if (shot.shotNumber === newNumber && shot.sortOrder === i) {
      unchangedCount++
      return acc
    }
    return [...acc, {
      shotId: shot.id,
      title: shot.title || "Untitled",
      currentNumber: shot.shotNumber ?? "\u2014",
      newNumber,
    }]
  }, [])

  return { changes, unchangedCount }
}

/**
 * Suggests a start number for renumbering a filtered subset of shots.
 * If all shots are visible (no filter), returns 1.
 * Otherwise returns max hidden shot number + 1 so filtered shots
 * continue after the hidden range.
 */
export function suggestStartNumber(
  allShots: ReadonlyArray<Shot>,
  filteredShots: ReadonlyArray<Shot>,
): number {
  if (filteredShots.length === allShots.length) return 1
  const filteredIds = new Set(filteredShots.map((s) => s.id))
  const hiddenShots = allShots.filter((s) => !filteredIds.has(s.id))
  const maxHidden = computeMaxShotNumber(hiddenShots)
  return maxHidden > 0 ? maxHidden + 1 : 1
}
