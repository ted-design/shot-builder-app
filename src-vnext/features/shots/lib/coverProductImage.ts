import type { ProductAssignment, Shot, ShotLook } from "@/shared/types"

/** The product assignment explicitly chosen as a look's cover. */
export function findExplicitCoverAssignment(shot: Shot): ProductAssignment | null {
  const looks = shot.looks ?? []
  if (looks.length === 0) return null

  const fromLook = (look: ShotLook | undefined): ProductAssignment | null => {
    if (!look) return null
    const heroId = look.heroProductId
    if (typeof heroId !== "string" || heroId.length === 0) return null
    return (
      look.products.find(
        (p) => p.skuId === heroId || p.colourId === heroId || p.familyId === heroId,
      ) ?? null
    )
  }

  if (typeof shot.activeLookId === "string" && shot.activeLookId.length > 0) {
    const active = looks.find((l) => l.id === shot.activeLookId)
    if (active) return fromLook(active)
  }

  for (const look of looks) {
    const found = fromLook(look)
    if (found) return found
  }
  return null
}
