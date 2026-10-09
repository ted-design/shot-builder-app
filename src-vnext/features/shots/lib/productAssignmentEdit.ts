import { assignmentColourwayId } from "@/shared/lib/colourwayImage"
import type { ProductAssignment } from "@/shared/types"

/** Fields that describe one colourway. `thumbUrl` is written as `skuImageUrl ?? familyImageUrl`. */
const COLOURWAY_FIELDS: ReadonlyArray<keyof ProductAssignment> = [
  "skuId",
  "colourId",
  "skuName",
  "colourName",
  "skuImageUrl",
  "thumbUrl",
]

/** The colourway's stored photo fields. */
const COLOURWAY_IMAGE_FIELDS: ReadonlyArray<keyof ProductAssignment> = ["skuImageUrl", "thumbUrl"]

/** Fields that describe the product family. */
const FAMILY_FIELDS: ReadonlyArray<keyof ProductAssignment> = ["familyName", "familyImageUrl"]

/**
 * Apply an edit to an existing product assignment. If the edit changes the
 * colourway (or the family), the previous colourway's fields are dropped first,
 * so its name and photo can't survive on the new colourway. Choosing no
 * colourway makes the assignment family-level. Family fields are kept unless
 * the family itself changed; slot fields (quantity, size, isHero…) carry over.
 *
 * `refreshColourwayImages`: the colourway was (re)picked from the live catalog,
 * so the edit carries its current photo or none. Stored photo fields are then
 * dropped even when the colourway id is unchanged (its photo may have been removed).
 */
export function applyAssignmentEdit(
  existing: ProductAssignment,
  edit: Partial<ProductAssignment> & Pick<ProductAssignment, "familyId">,
  options: { readonly refreshColourwayImages?: boolean } = {},
): ProductAssignment {
  const familyChanged = existing.familyId !== edit.familyId
  const colourwayChanged =
    familyChanged || assignmentColourwayId(existing) !== assignmentColourwayId(edit)
  const dropped = new Set<string>([
    ...(colourwayChanged ? COLOURWAY_FIELDS : []),
    ...(familyChanged ? FAMILY_FIELDS : []),
    ...(options.refreshColourwayImages ? COLOURWAY_IMAGE_FIELDS : []),
  ])
  const kept = Object.fromEntries(Object.entries(existing).filter(([key]) => !dropped.has(key)))
  return { ...kept, ...edit } as ProductAssignment
}
