import { useMemo } from "react"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import {
  sortByUrgency,
  isWithinDays,
  type ShootReadinessItem,
} from "@/features/products/lib/shootReadiness"
import { countActiveRequirements } from "@/features/products/lib/assetRequirements"

/**
 * Returns shoot readiness data for families with launch dates in the next 90 days.
 *
 * Uses denormalized family-level fields (activeSkuCount) for colorway counts.
 * Per-family sample/SKU subcollection data is not loaded to avoid N subscription fan-out
 * (CLAUDE.md Rule 5). Full readiness % will require denormalized aggregates on the family doc.
 */
export function useShootReadiness(): {
  readonly items: ReadonlyArray<ShootReadinessItem>
  readonly loading: boolean
} {
  const { data: allFamilies, loading: familiesLoading } = useProductFamilies()

  const items = useMemo(() => {
    const eligible = allFamilies.filter(
      (f) =>
        f.launchDate != null &&
        f.archived !== true &&
        isWithinDays(f.launchDate, 90),
    )

    if (eligible.length === 0) return []

    const readinessItems: ShootReadinessItem[] = eligible.map((family) => ({
      familyId: family.id,
      familyName: family.styleName,
      launchDate: family.launchDate!,
      totalSkus: family.activeSkuCount ?? family.skuCount ?? 0,
      skusWithFlags: 0,
      samplesArrived: 0,
      samplesTotal: 0,
      readinessPct: 0,
    }))

    return sortByUrgency(readinessItems)
  }, [allFamilies])

  return { items, loading: familiesLoading }
}
