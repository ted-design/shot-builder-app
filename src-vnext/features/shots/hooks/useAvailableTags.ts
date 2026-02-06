import { useMemo } from "react"
import { useShots } from "@/features/shots/hooks/useShots"
import { DEFAULT_TAGS } from "@/shared/lib/defaultTags"
import type { ShotTag } from "@/shared/types"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"

export type AvailableTag = ShotTag & {
  readonly usageCount: number
  readonly isDefault: boolean
}

const DEFAULT_TAG_INDEX = new Map(DEFAULT_TAGS.map((t) => [t.id, t]))

function normalizeTag(raw: unknown): ShotTag | null {
  if (!raw || typeof raw !== "object") return null
  const t = raw as { id?: unknown; label?: unknown; color?: unknown; category?: unknown }
  if (typeof t.id !== "string") return null
  if (typeof t.label !== "string") return null
  if (typeof t.color !== "string") return null
  const label = t.label.trim()
  if (!label) return null
  return {
    id: t.id,
    label,
    color: t.color,
    category: resolveShotTagCategory({ id: t.id, category: t.category as ShotTag["category"] }),
  }
}

export function useAvailableTags() {
  const { data: shots, loading, error } = useShots()

  const tags = useMemo<readonly AvailableTag[]>(() => {
    const tagMap = new Map<string, AvailableTag>()

    for (const t of DEFAULT_TAGS) {
      tagMap.set(t.id, { ...t, usageCount: 0, isDefault: true })
    }

    for (const shot of shots) {
      const raw = shot.tags
      if (!Array.isArray(raw)) continue

      for (const maybeTag of raw) {
        const normalized = normalizeTag(maybeTag)
        if (!normalized) continue

        const defaultTag = DEFAULT_TAG_INDEX.get(normalized.id) ?? null
        const next: AvailableTag = {
          id: normalized.id,
          label: normalized.label || defaultTag?.label || "Untitled",
          color: normalized.color || defaultTag?.color || "gray",
          category: normalized.category ?? defaultTag?.category ?? "other",
          usageCount: 1,
          isDefault: Boolean(defaultTag),
        }

        const existing = tagMap.get(normalized.id)
        if (existing) {
          tagMap.set(normalized.id, {
            ...existing,
            label: next.label || existing.label,
            color: next.color || existing.color,
            category: next.category ?? existing.category,
            usageCount: existing.usageCount + 1,
            isDefault: existing.isDefault || next.isDefault,
          })
        } else {
          tagMap.set(normalized.id, next)
        }
      }
    }

    return [...tagMap.values()].sort(
      (a, b) => b.usageCount - a.usageCount || a.label.localeCompare(b.label),
    )
  }, [shots])

  return { tags, loading, error }
}
