import { DEFAULT_TAGS } from "@/shared/lib/defaultTags"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"
import type { Shot, ShotTag, ShotTagCategory } from "@/shared/types"

/**
 * Normalize a tag label for comparison: trim, collapse whitespace, lowercase.
 */
export function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase()
}

const DEFAULT_TAG_BY_LABEL = new Map<string, ShotTag>(
  DEFAULT_TAGS.map((t) => [normalizeTagLabel(t.label), t]),
)

/**
 * Find the canonical (default) tag for a given label, if one exists.
 * Returns the default tag with its canonical ID, color, and category.
 */
export function findCanonicalTag(label: string): ShotTag | null {
  return DEFAULT_TAG_BY_LABEL.get(normalizeTagLabel(label)) ?? null
}

/**
 * Given a tag, return the canonical version if a default tag with the same
 * label exists, otherwise return the tag as-is with its category resolved.
 */
export function canonicalizeTag(tag: ShotTag): ShotTag {
  const canonical = findCanonicalTag(tag.label)
  if (canonical) {
    return {
      id: canonical.id,
      label: canonical.label,
      color: canonical.color,
      category: canonical.category,
    }
  }
  return {
    id: tag.id,
    label: tag.label.trim().replace(/\s+/g, " "),
    color: tag.color,
    category: resolveShotTagCategory(tag),
  }
}

/**
 * Deduplicate a tag array by normalized label. When duplicates exist,
 * prefer the default tag ID over random IDs. Returns a new array.
 */
export function deduplicateTags(tags: readonly ShotTag[]): readonly ShotTag[] {
  const seen = new Map<string, ShotTag>()
  for (const tag of tags) {
    const key = normalizeTagLabel(tag.label)
    if (!seen.has(key)) {
      seen.set(key, canonicalizeTag(tag))
    }
  }
  return [...seen.values()]
}

/**
 * Tag-filter option list actually reachable by matching against `shot.tags`:
 * one option per DISTINCT id currently on a shot, keyed by that raw id
 * (first-seen label wins), NO default-tag seeding. This is deliberately the
 * SAME shape and semantics as the shot list's own tag-filter options
 * (useShotListState.ts's tagLabelById/tagOptions) — and deliberately
 * DIFFERENT from computeAvailableTags (useAvailableTags.ts), which seeds
 * every DEFAULT_TAGS entry unconditionally and collapses same-labelled tags
 * across different shots down to ONE canonical id. That collapsing is
 * correct for "what tag can I assign to a shot" (computeAvailableTags' job)
 * but wrong for "what tag VALUE should a filter match": filterEngine.ts's
 * evalSetArray matches a filter's selected value against the shot's own
 * stored `tag.id` verbatim, so a filter option must carry an id that
 * actually appears on a shot — never a canonicalized/collapsed stand-in for
 * one, and never a default tag nobody has used yet (which would just filter
 * the report to zero shots with no indication why).
 */
export function computeUsedTagOptions(
  shots: readonly Shot[],
): ReadonlyArray<{ readonly id: string; readonly label: string }> {
  const byId = new Map<string, string>()
  for (const shot of shots) {
    for (const tag of shot.tags ?? []) {
      if (!byId.has(tag.id)) byId.set(tag.id, tag.label)
    }
  }
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
  return Array.from(byId.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => collator.compare(a.label, b.label))
}
