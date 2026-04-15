import type { LocationBlock, LocationRole } from "@/shared/types"

export type { LocationRole }

/**
 * Canonical sort order for locations on the printed call sheet and wherever
 * multiple locations render as a group.
 */
export const CANONICAL_ROLE_ORDER: readonly LocationRole[] = [
  "basecamp",
  "parking",
  "hospital",
  "office",
  "shoot",
  "custom",
] as const

const ROLE_DISPLAY_LABELS: Readonly<Record<LocationRole, string>> = {
  basecamp: "Basecamp",
  parking: "Parking",
  hospital: "Hospital",
  office: "Office",
  shoot: "Shoot",
  custom: "Custom",
}

/**
 * Human-readable label for a role chip or section header.
 */
export function roleDisplayLabel(role: LocationRole): string {
  return ROLE_DISPLAY_LABELS[role]
}

/**
 * Infers a location role from a free-text title using case-insensitive
 * substring matching. Only explicit canonical names are recognized — anything
 * unrecognized falls through to "custom". If a title happens to contain more
 * than one canonical name, the first match in this function wins (basecamp
 * beats hospital beats parking beats office beats shoot).
 */
export function inferLocationRole(title: string): LocationRole {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return "custom"
  if (normalized.includes("basecamp")) return "basecamp"
  if (normalized.includes("hospital")) return "hospital"
  if (normalized.includes("parking")) return "parking"
  if (normalized.includes("office")) return "office"
  if (normalized.includes("shoot")) return "shoot"
  return "custom"
}

/**
 * Resolves the effective role of a LocationBlock. If the block carries an
 * explicit role it wins; otherwise the title is used to infer one. Null is
 * treated the same as undefined so Firestore round-trips stay consistent.
 */
export function resolveLocationRole(block: LocationBlock): LocationRole {
  if (block.role) return block.role
  return inferLocationRole(block.title || "")
}

/**
 * Sort comparator that orders locations by their canonical role index. Ties
 * are broken by the original insertion order since JavaScript's Array.sort is
 * stable (ES2019+).
 */
export function compareLocationsByRole(
  a: LocationBlock,
  b: LocationBlock,
): number {
  const aIndex = CANONICAL_ROLE_ORDER.indexOf(resolveLocationRole(a))
  const bIndex = CANONICAL_ROLE_ORDER.indexOf(resolveLocationRole(b))
  return aIndex - bIndex
}
