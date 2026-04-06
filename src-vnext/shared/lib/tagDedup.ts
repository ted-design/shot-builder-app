import { DEFAULT_TAGS } from "@/shared/lib/defaultTags"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"
import type { ShotTag, ShotTagCategory } from "@/shared/types"

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
