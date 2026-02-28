import type { ShotTag, ShotTagCategory } from "@/shared/types"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"

const CATEGORY_ORDER: Record<ShotTagCategory, number> = {
  priority: 0,
  gender: 1,
  media: 2,
  other: 3,
}

/**
 * Sort tags by category for display. Returns a new array — never mutates input.
 * Order: priority → gender → media → other.
 * Uses resolveShotTagCategory for consistent category resolution.
 * Preserves original order within the same category (stable sort).
 */
export function sortTagsByCategory(tags: readonly ShotTag[]): ShotTag[] {
  return [...tags].sort((a, b) => {
    const orderA = CATEGORY_ORDER[resolveShotTagCategory(a)]
    const orderB = CATEGORY_ORDER[resolveShotTagCategory(b)]
    return orderA - orderB
  })
}
