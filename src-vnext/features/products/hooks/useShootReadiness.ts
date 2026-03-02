import { useMemo } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProductFamilies, useProductSkus } from "@/features/products/hooks/useProducts"
import { useProductSamples } from "@/features/products/hooks/useProductWorkspace"
import type { ProductFamily, ProductSample, ProductSku } from "@/shared/types"
import {
  computeShootReadiness,
  sortByUrgency,
  isWithinDays,
  type ShootReadinessItem,
} from "@/features/products/lib/shootReadiness"

/**
 * Returns shoot readiness data for families with launch dates in the next 90 days.
 *
 * NOTE: This is a simplified version that works with the existing hook infrastructure.
 * It filters families client-side from the full product families subscription.
 * For large product catalogs, a targeted Firestore query would be more efficient.
 */
export function useShootReadiness(): {
  readonly items: ReadonlyArray<ShootReadinessItem>
  readonly loading: boolean
} {
  const { data: allFamilies, loading: familiesLoading } = useProductFamilies()

  const eligibleFamilies = useMemo(() => {
    return allFamilies.filter(
      (f): f is ProductFamily & { launchDate: NonNullable<ProductFamily["launchDate"]> } =>
        f.launchDate != null && isWithinDays(f.launchDate, 90),
    )
  }, [allFamilies])

  // For now, compute readiness from families alone (without per-family SKU/sample fan-out).
  // The widget shows family-level info; per-family subcollection data would require N subscriptions.
  // We pass empty maps and let the widget show launch date + family name only.
  const items = useMemo(() => {
    if (eligibleFamilies.length === 0) return []
    const skusByFamily = new Map<string, ReadonlyArray<ProductSku>>()
    const samplesByFamily = new Map<string, ReadonlyArray<ProductSample>>()
    const raw = computeShootReadiness(eligibleFamilies, skusByFamily, samplesByFamily)
    return sortByUrgency(raw)
  }, [eligibleFamilies])

  return { items, loading: familiesLoading }
}
