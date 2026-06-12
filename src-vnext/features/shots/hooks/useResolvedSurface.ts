import { useMemo } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useViewAsPreview } from "@/app/providers/ViewAsPreviewProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { useIsMobile, useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { isFeatureEnabled } from "@/shared/lib/flags"
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
// NOT flag-gated, by design: resolveSurface is pure and the flag-off
// affordances values are pure device derivations identical to today's
// `!isMobile` gates, so always-on is zero-delta. featureShootSurface changes
// the VALUES (5e-II): it is read here and passed as resolveSurface's explicit
// `shootSurfaceEnabled` input — flag OFF keeps every output byte-identical to
// 5e-I. featureSurfaceResolver gates only the list's viewMode/groupKey
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
  // 5e-III View-as: the in-memory preview role (null = not previewing). It
  // interposes ONLY at surface resolution below — it never flows through
  // useEffectiveRole, so the real role above (and every rbac write-gate keyed
  // off it) is unchanged. Preview can only NARROW the presentation surface.
  const { previewRole } = useViewAsPreview()
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()

  // Same 3-valued derivation as ShotListPage's surfaceDevice.
  const device: SurfaceDevice = isMobile ? "mobile" : isDesktop ? "desktop" : "tablet"

  // 5e-II: the flag flips resolver VALUES (affordances device-term drop +
  // shoot chrome). Read here, passed explicitly — same flag read as
  // useShotListState's resolveSurface call site.
  const shootSurfaceEnabled = isFeatureEnabled("featureShootSurface")

  // Never resolve from the global-role guess: while the first member-doc read
  // is in flight (or auth is settling) return no affordances, mirroring the
  // existing render-nothing-while-resolving discipline.
  const resolving = authLoading || roleResolving

  return useMemo(() => {
    if (resolving) return RESOLVING_RESULT
    // 5e-III View-as seam (LIVE): when previewing, substitute the preview role
    // for the real effective role at THIS resolveSurface call only. The
    // url/stored view rungs stay null so the previewed shoot-surface default
    // is never masked by the previewer's own stored view choice. This narrows
    // presentation only — the real role term used by write-gates is untouched.
    const { surface, affordances, chrome } = resolveSurface({
      effectiveRole: previewRole ?? role,
      device,
      // Capability consumers need no view resolution — the list page keeps
      // its own url/stored path through useShotListState.
      urlView: null,
      urlGroup: null,
      storedView: null,
      shootSurfaceEnabled,
    })
    return { surface, affordances, chrome, resolving: false }
  }, [resolving, previewRole, role, device, shootSurfaceEnabled])
}
