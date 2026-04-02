import type { Shot, TalentRecord } from "@/shared/types"
import type { ShotGridBlock } from "../types/exportBuilder"

/**
 * Resolve unique product names from a shot's products and looks into a
 * comma-joined display string. Returns "\u2014" when no names are found.
 */
export function resolveProductNamesString(shot: Shot): string {
  const names = resolveProductNamesList(shot)
  return names.length > 0 ? names.join(", ") : "\u2014"
}

/**
 * Resolve unique product names from a shot's products and looks into a
 * readonly array. Used when individual names need separate rendering
 * (e.g. badge chips in ShotDetailBlockView).
 */
export function resolveProductNamesList(shot: Shot): readonly string[] {
  const productNames = shot.products
    .map((p) => p.familyName)
    .filter((n): n is string => Boolean(n))

  const lookNames = (shot.looks ?? [])
    .flatMap((look) => look.products.map((p) => p.familyName))
    .filter((n): n is string => Boolean(n))

  return [...new Set([...productNames, ...lookNames])]
}

/**
 * Resolve talent display names for a shot. Prefers talentIds lookup
 * against the talent records map, falls back to the legacy `talent`
 * string array. Returns "\u2014" when no talent is found.
 */
export function resolveTalentNames(
  shot: Shot,
  talentRecords: readonly TalentRecord[],
): string {
  if (shot.talentIds?.length) {
    const talentMap = new Map(talentRecords.map((t) => [t.id, t.name]))
    const names = shot.talentIds
      .map((id) => talentMap.get(id))
      .filter(Boolean)
    if (names.length > 0) return names.join(", ")
  }

  if (shot.talent?.length) {
    return shot.talent.join(", ")
  }

  return "\u2014"
}

/**
 * Filter shots by status and tag IDs according to the block's filter config.
 * Returns the original array when no filter is set.
 */
export function filterShots(
  shots: readonly Shot[],
  filter: ShotGridBlock["filter"],
): readonly Shot[] {
  if (!filter) return shots

  return shots.filter((shot) => {
    if (filter.status?.length && !filter.status.includes(shot.status)) {
      return false
    }
    if (filter.tagIds?.length) {
      const shotTagIds = shot.tags?.map((t) => t.id) ?? []
      if (!filter.tagIds.some((id) => shotTagIds.includes(id))) {
        return false
      }
    }
    return true
  })
}

/**
 * Sort shots by the given column and direction. Returns the original
 * array when no sortBy is set.
 */
export function sortShots(
  shots: readonly Shot[],
  sortBy: ShotGridBlock["sortBy"],
  sortDirection: ShotGridBlock["sortDirection"],
): readonly Shot[] {
  if (!sortBy) return shots

  const dir = sortDirection === "desc" ? -1 : 1

  return [...shots].sort((a, b) => {
    switch (sortBy) {
      case "shotNumber": {
        const numA = Number(a.shotNumber ?? 0)
        const numB = Number(b.shotNumber ?? 0)
        return (numA - numB) * dir
      }
      case "title":
        return a.title.localeCompare(b.title) * dir
      case "status":
        return a.status.localeCompare(b.status) * dir
      default:
        return 0
    }
  })
}
