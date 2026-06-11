import { useMemo } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { useIsMobile, useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { resolveSurface } from "@/features/shots/lib/resolveSurface"
import type {
  Affordances,
  Chrome,
  SurfaceDevice,
  SurfaceKind,
} from "@/features/shots/lib/resolveSurface"

// 5e-I shared surface hook — the capability-consumer call site for
// resolveSurface (the detail page does no surface resolution of its own; the
// list page keeps its url/stored view path through useShotListState).
//
// NOT flag-gated, by design: resolveSurface is pure and the 5e-I affordances
// values are pure device derivations identical to today's `!isMobile` gates,
// so always-on is zero-delta. featureShootSurface changes the VALUES at
// 5e-II; featureSurfaceResolver gates only the list's viewMode/groupKey
// substitution (inside useShotListState) — untouched here.
//
// Output stays presentation-only (resolveSurface header law): consumers
// replace ONLY the device term of an existing gate — the rbac/global-claim
// term stays at the consumer.

export interface UseResolvedSurfaceResult {
  readonly surface: SurfaceKind | null
  readonly affordances: Affordances | null
  readonly chrome: Chrome | null
  /** Mirrors the surfaceContext null-while-(authLoading || roleResolving) gate. */
  readonly resolving: boolean
}

const RESOLVING_RESULT: UseResolvedSurfaceResult = {
  surface: null,
  affordances: null,
  chrome: null,
  resolving: true,
}

export function useResolvedSurface(): UseResolvedSurfaceResult {
  const { loading: authLoading } = useAuth()
  const { role, resolving: roleResolving } = useEffectiveRole()
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()

  // Same 3-valued derivation as ShotListPage's surfaceDevice.
  const device: SurfaceDevice = isMobile ? "mobile" : isDesktop ? "desktop" : "tablet"

  // Never resolve from the global-role guess: while the first member-doc read
  // is in flight (or auth is settling) return no affordances, mirroring the
  // existing render-nothing-while-resolving discipline.
  const resolving = authLoading || roleResolving

  return useMemo(() => {
    if (resolving) return RESOLVING_RESULT
    // 5e-III View-as seam: the preview role interposes on effectiveRole HERE.
    const { surface, affordances, chrome } = resolveSurface({
      effectiveRole: role,
      device,
      // Capability consumers need no view resolution — the list page keeps
      // its own url/stored path through useShotListState.
      urlView: null,
      urlGroup: null,
      storedView: null,
    })
    return { surface, affordances, chrome, resolving: false }
  }, [resolving, role, device])
}
