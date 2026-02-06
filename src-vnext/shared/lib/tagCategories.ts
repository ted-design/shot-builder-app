import { DEFAULT_TAGS } from "@/shared/lib/defaultTags"
import type { ShotTag, ShotTagCategory } from "@/shared/types"

const SHOT_TAG_CATEGORIES: ReadonlySet<ShotTagCategory> = new Set([
  "priority",
  "gender",
  "media",
  "other",
])

const DEFAULT_TAG_CATEGORY_BY_ID = new Map<string, ShotTagCategory>(
  DEFAULT_TAGS.map((tag) => [tag.id, tag.category ?? "other"]),
)

export function normalizeShotTagCategory(value: unknown): ShotTagCategory | undefined {
  if (typeof value !== "string") return undefined
  return SHOT_TAG_CATEGORIES.has(value as ShotTagCategory)
    ? (value as ShotTagCategory)
    : undefined
}

export function resolveShotTagCategory(tag: Pick<ShotTag, "id" | "category">): ShotTagCategory {
  return normalizeShotTagCategory(tag.category) ??
    DEFAULT_TAG_CATEGORY_BY_ID.get(tag.id) ??
    "other"
}

export function getShotTagCategoryLabel(category: ShotTagCategory): string {
  switch (category) {
    case "priority":
      return "Priority Tag"
    case "gender":
      return "Gender"
    case "media":
      return "Media"
    case "other":
    default:
      return "Other"
  }
}
