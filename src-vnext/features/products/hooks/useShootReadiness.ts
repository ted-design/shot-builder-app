import { useMemo } from "react"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import {
  computeSuggestedShootWindow,
  isWithinDays,
  isOverdue,
  type ShootReadinessItem,
} from "@/features/products/lib/shootReadiness"
import {
  getShootUrgency,
  getUrgencySortOrder,
} from "@/features/products/lib/shootUrgency"

/**
 * Returns shoot readiness data for product families using 4-tier eligibility:
 *   1. Launch date within 90 days (full tier)
 *   2. Earliest SKU launch date within 90 days (full tier)
 *   3. Has tracked samples (samples_only tier)
 *   4. Has active asset requirements (requirements tier)
 *
 * Uses denormalized family-level fields only to avoid N subscription fan-out
 * (CLAUDE.md Rule 5).
 */
export function useShootReadiness(): {
  readonly items: ReadonlyArray<ShootReadinessItem>
  readonly loading: boolean
} {
  const { data: allFamilies, loading: familiesLoading } = useProductFamilies()

  const items = useMemo(() => {
    const eligible = allFamilies.filter((f) => {
      if (f.archived === true || f.deleted === true) return false

      // Tier 1: Has family-level launch date within 90 days (future)
      const hasUpcomingLaunch =
        f.launchDate != null && isWithinDays(f.launchDate, 90)

      // Tier 1b: Has overdue family-level launch date (past)
      const hasOverdueLaunch =
        f.launchDate != null && isOverdue(f.launchDate)

      // Tier 2: Has earliest SKU-level launch date within 90 days
      const hasUpcomingEarliestLaunch =
        f.earliestLaunchDate != null && isWithinDays(f.earliestLaunchDate, 90)

      // Tier 2b: Has overdue earliest SKU-level launch date
      const hasOverdueEarliestLaunch =
        f.earliestLaunchDate != null && isOverdue(f.earliestLaunchDate)

      // Tier 3: Has tracked samples
      const hasSamples =
        (f.sampleCount ?? 0) > 0 || (f.samplesArrivedCount ?? 0) > 0

      // Tier 4: Has active asset requirements (needed/in_progress)
      const hasActiveRequirements = (f.activeRequirementCount ?? 0) > 0

      return (
        hasUpcomingLaunch ||
        hasOverdueLaunch ||
        hasUpcomingEarliestLaunch ||
        hasOverdueEarliestLaunch ||
        hasSamples ||
        hasActiveRequirements
      )
    })

    if (eligible.length === 0) return []

    const readinessItems: ShootReadinessItem[] = eligible.map((family) => {
      // Prefer the most upcoming (future) launch date to avoid showing
      // past SKU dates when the family launch date is still upcoming.
      const now = Date.now()
      const familyMs = family.launchDate ? family.launchDate.toMillis() : null
      const earliestMs = family.earliestLaunchDate ? family.earliestLaunchDate.toMillis() : null
      let effectiveLaunchDate = family.earliestLaunchDate ?? family.launchDate ?? null
      if (familyMs != null && earliestMs != null && earliestMs < now && familyMs >= now) {
        effectiveLaunchDate = family.launchDate!
      }
      const samplesTotal = family.sampleCount ?? 0
      const samplesArrived = family.samplesArrivedCount ?? 0
      const readinessPct =
        samplesTotal > 0
          ? Math.round((samplesArrived / samplesTotal) * 100)
          : 0

      const shootWindow = computeSuggestedShootWindow({
        launchDate: effectiveLaunchDate,
        samplesTotal,
        samplesArrived,
        earliestSampleEta: family.earliestSampleEta ?? null,
        requestDeadline: null,
      })

      return {
        familyId: family.id,
        familyName: family.styleName,
        gender: family.gender ?? null,
        launchDate: effectiveLaunchDate,
        totalSkus: family.activeSkuCount ?? family.skuCount ?? 0,
        skusWithFlags: family.activeRequirementCount ?? 0,
        samplesArrived,
        samplesTotal,
        readinessPct,
        shootWindow,
        requestDeadline: null,
        earliestSampleEta: family.earliestSampleEta ?? null,
      }
    })

    return [...readinessItems].sort((a, b) => {
      const aUrgency = getShootUrgency(a.launchDate)
      const bUrgency = getShootUrgency(b.launchDate)
      const tierDiff = getUrgencySortOrder(aUrgency) - getUrgencySortOrder(bUrgency)
      if (tierDiff !== 0) return tierDiff
      // Within same tier, sort by readiness (less ready first)
      return a.readinessPct - b.readinessPct
    })
  }, [allFamilies])

  return { items, loading: familiesLoading }
}
