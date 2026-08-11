import { useMemo } from "react"
import { useShots } from "@/features/shots/hooks/useShots"
import { DEFAULT_TAGS } from "@/shared/lib/defaultTags"
import type { Shot, ShotTag } from "@/shared/types"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"
import { normalizeTagLabel, findCanonicalTag } from "@/shared/lib/tagDedup"

export type AvailableTag = ShotTag & {
  readonly usageCount: number
  readonly isDefault: boolean
}

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

/**
 * Pure aggregation: every tag in use across `shots`, deduped against the
 * canonical default set, ranked by usage. Extracted from the `useAvailableTags`
 * hook body so a consumer that ALREADY has a shots array in hand (e.g. the
 * export report, which fetches shots once via useExportData) can reuse the
 * exact same aggregation without opening a second Firestore subscription —
 * "same source the list uses" without a second `useShots()`.
 */
export function computeAvailableTags(shots: readonly Shot[]): readonly AvailableTag[] {
  const tagMap = new Map<string, AvailableTag>()

  for (const t of DEFAULT_TAGS) {
    tagMap.set(normalizeTagLabel(t.label), { ...t, usageCount: 0, isDefault: true })
  }

  for (const shot of shots) {
    const raw = shot.tags
    if (!Array.isArray(raw)) continue

    for (const maybeTag of raw) {
      const normalized = normalizeTag(maybeTag)
      if (!normalized) continue

      const labelKey = normalizeTagLabel(normalized.label)
      const canonical = findCanonicalTag(normalized.label)
      const next: AvailableTag = {
        id: canonical?.id ?? normalized.id,
        label: canonical?.label ?? normalized.label,
        color: canonical?.color ?? normalized.color,
        category: canonical?.category ?? normalized.category ?? "other",
        usageCount: 1,
        isDefault: Boolean(canonical),
      }

      const existing = tagMap.get(labelKey)
      if (existing) {
        tagMap.set(labelKey, {
          ...existing,
          usageCount: existing.usageCount + 1,
          isDefault: existing.isDefault || next.isDefault,
        })
      } else {
        tagMap.set(labelKey, next)
      }
    }
  }

  return [...tagMap.values()].sort(
    (a, b) => b.usageCount - a.usageCount || a.label.localeCompare(b.label),
  )
}

export function useAvailableTags() {
  const { data: shots, loading, error } = useShots()
  const tags = useMemo<readonly AvailableTag[]>(() => computeAvailableTags(shots), [shots])
  return { tags, loading, error }
}
