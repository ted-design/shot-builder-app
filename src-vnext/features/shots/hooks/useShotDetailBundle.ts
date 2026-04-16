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

export interface ShotDetailBundle {
  readonly shot: Shot | null
  readonly laneById: ReadonlyMap<string, Lane>
  readonly laneNameById: ReadonlyMap<string, string>
  readonly loading: boolean
  readonly error: string | null
}

export function useShotDetailBundle(shotId: string | undefined): ShotDetailBundle {
  const shot = useShot(shotId)
  const lanes = useLanes()

  const error = normaliseError(shot.error) ?? normaliseError(lanes.error)

  return {
    shot: shot.data,
    laneById: lanes.laneById,
    laneNameById: lanes.laneNameById,
    loading: shot.loading || lanes.loading,
    error,
  }
}
