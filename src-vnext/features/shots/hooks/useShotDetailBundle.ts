import { useShot } from "@/features/shots/hooks/useShot"
import { useLanes } from "@/features/shots/hooks/useLanes"
import type { Lane, Shot } from "@/shared/types"

// Phase 0.2 compound-query bundle for the shot detail page.
//
// Co-locates the two live subscriptions that belong to "viewing one shot
// in context": the shot doc itself, and the project-level lanes
// collection needed for SceneContextBanner + SceneDetailSheet. Consumers
// that used to read useShots() / useProjects() at this level should pull
// that data lazily on-demand (see ShotLifecycleActionsMenu +
// SceneDetailSheet) instead of keeping a live subscription open.

type ErrorLike = string | { message?: string } | null | undefined

function normaliseError(err: ErrorLike): string | null {
  if (err == null) return null
  if (typeof err === "string") return err
  return err.message ?? "Unknown error"
}

// Stable empty maps returned when the lanes read is permission-denied, so the
// identity is constant across renders (no spurious downstream re-renders) and
// no stale lane data leaks through. useFirestoreCollection keeps its previous
// `data` on a snapshot error, so on an in-app navigation from a lanes-readable
// project to a non-member one, useLanes would otherwise still expose the prior
// project's lanes — these constants force the degraded empty state instead.
const EMPTY_LANE_BY_ID: ReadonlyMap<string, Lane> = new Map()
const EMPTY_LANE_NAME_BY_ID: ReadonlyMap<string, string> = new Map()
const EMPTY_LANES: ReadonlyArray<Lane> = []

export interface ShotDetailBundle {
  readonly shot: Shot | null
  /**
   * Ordered project lanes (sortOrder asc) — SceneDetailSheet's siblingLanes
   * input for duplicate scene-number detection (5a unified editor). Empty on
   * a swallowed permission-denied, same as laneById.
   */
  readonly lanes: ReadonlyArray<Lane>
  readonly laneById: ReadonlyMap<string, Lane>
  readonly laneNameById: ReadonlyMap<string, string>
  readonly loading: boolean
  readonly error: string | null
  /**
   * Soft signal that lanes could not be read because the current user lacks
   * permission (Firestore "permission-denied"). This is NOT fatal: the shot
   * itself is readable via the wide /shots rule, so the page should still
   * render. When true, laneById/laneNameById are simply empty (scene context
   * degrades — the SceneContextBanner returns null for an empty map). Genuine
   * lanes errors (network, missing-index/failed-precondition, etc.) are NOT
   * swallowed — they surface through `error` and stay fatal so a real
   * regression (e.g. a missing composite index on the lanes orderBy) is not
   * hidden as a silent scene-banner disappearance.
   */
  readonly lanesUnavailable: boolean
}

export function useShotDetailBundle(shotId: string | undefined): ShotDetailBundle {
  const shot = useShot(shotId)
  const lanes = useLanes()

  // The shot doc is the load-bearing entity: its errors are ALWAYS fatal.
  // Lanes degrade gracefully ONLY on a rules-denied read — a non-member
  // global crew/warehouse/viewer can read the shot (wide /shots rule) but is
  // denied the project-scoped lanes read. Swallow that one case so the page
  // renders without scene context, instead of blanking the whole shot page.
  const lanesError = lanes.error
  const lanesPermissionDenied = lanesError?.code === "permission-denied"
  const error =
    normaliseError(shot.error) ??
    (lanesPermissionDenied ? null : normaliseError(lanesError))

  return {
    shot: shot.data,
    // On a swallowed permission-denied, force the empty maps — useLanes may
    // still hold the previous project's lanes (the hook retains data on error),
    // and we must not surface stale scene context to a non-member.
    lanes: lanesPermissionDenied ? EMPTY_LANES : lanes.data,
    laneById: lanesPermissionDenied ? EMPTY_LANE_BY_ID : lanes.laneById,
    laneNameById: lanesPermissionDenied ? EMPTY_LANE_NAME_BY_ID : lanes.laneNameById,
    loading: shot.loading || lanes.loading,
    error,
    lanesUnavailable: lanesPermissionDenied,
  }
}
