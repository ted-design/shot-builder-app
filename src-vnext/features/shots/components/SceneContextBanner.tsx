import { getSceneColor } from "@/features/shots/lib/sceneColors"
import type { Lane } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SceneContextBannerProps {
  readonly laneId: string | undefined | null
  readonly laneById: ReadonlyMap<string, Lane>
  readonly onViewScene?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DIRECTION_PREVIEW = 100

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SceneContextBanner({
  laneId,
  laneById,
  onViewScene,
}: SceneContextBannerProps) {
  if (!laneId) return null

  const lane = laneById.get(laneId)
  if (!lane) return null

  const resolvedColor = getSceneColor(lane.color)
  const directionPreview =
    lane.direction && lane.direction.length > MAX_DIRECTION_PREVIEW
      ? `${lane.direction.slice(0, MAX_DIRECTION_PREVIEW)}\u2026`
      : lane.direction

  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-1.5 bg-[var(--color-surface-subtle)]"
      style={{ borderLeft: `3px solid ${resolvedColor}` }}
      data-testid="scene-context-banner"
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ background: resolvedColor }}
      />

      <span className="text-sm font-medium text-[var(--color-text)] truncate">
        {lane.sceneNumber != null && (
          <span className="text-[var(--color-text-subtle)] mr-1">
            #{lane.sceneNumber}
          </span>
        )}
        {lane.name}
      </span>

      {directionPreview && (
        <span className="hidden sm:inline text-xs text-[var(--color-text-muted)] truncate flex-1 min-w-0">
          {directionPreview}
        </span>
      )}

      {onViewScene && (
        <button
          type="button"
          onClick={onViewScene}
          className="flex-shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors ml-auto"
          data-testid="scene-view-link"
        >
          View scene &rsaquo;
        </button>
      )}
    </div>
  )
}
