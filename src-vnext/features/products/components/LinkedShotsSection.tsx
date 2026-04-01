import { useNavigate } from "react-router-dom"
import { Camera, ImageIcon } from "lucide-react"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import type { LinkedShotGroup, LinkedShotEntry } from "@/features/products/hooks/useLinkedShots"
import type { ShotFirestoreStatus } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(color: string): string {
  switch (color) {
    case "blue":
      return "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]"
    case "green":
      return "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]"
    case "amber":
      return "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]"
    default:
      return "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]"
  }
}

// ---------------------------------------------------------------------------
// Shot thumbnail — resolves Storage paths via useStorageUrl
// ---------------------------------------------------------------------------

function ShotThumb({ path, alt }: { readonly path: string | null; readonly alt: string }) {
  const resolved = useStorageUrl(path ?? undefined)

  if (!resolved) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ImageIcon className="h-4 w-4 text-[var(--color-text-subtle)]" />
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className="h-full w-full rounded object-cover"
    />
  )
}

// ---------------------------------------------------------------------------
// Shot row
// ---------------------------------------------------------------------------

function LinkedShotRow({ entry }: { readonly entry: LinkedShotEntry }) {
  const navigate = useNavigate()
  const label = getShotStatusLabel(entry.status)
  const color = getShotStatusColor(entry.status as ShotFirestoreStatus)

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:bg-[var(--color-surface-subtle)]"
      onClick={() => navigate(`/projects/${entry.projectId}/shots/${entry.shotId}`)}
    >
      {/* Thumbnail */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
        <ShotThumb path={entry.heroImageUrl} alt={entry.title} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {entry.shotNumber && (
            <span className="text-2xs font-semibold tabular-nums text-[var(--color-text-muted)]">
              #{entry.shotNumber}
            </span>
          )}
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {entry.title || "Untitled shot"}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ${statusBadgeClass(color)}`}
      >
        {label}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface LinkedShotsSectionProps {
  readonly groups: readonly LinkedShotGroup[]
  readonly totalCount: number
  readonly loading: boolean
  readonly error: string | null
}

export function LinkedShotsSection({
  groups,
  totalCount,
  loading,
  error,
}: LinkedShotsSectionProps) {
  if (loading) {
    return <LoadingState loading />
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-[var(--color-error)]">
        {error}
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <InlineEmpty
        icon={<Camera className="h-8 w-8" />}
        title="No shots reference this product"
        description="Shots will appear here when this product is added to a project's shot list."
      />
    )
  }

  return (
    <div>
      <div className="mb-3 text-xs text-[var(--color-text-muted)]">
        {totalCount} shot{totalCount === 1 ? "" : "s"} across{" "}
        {groups.length} project{groups.length === 1 ? "" : "s"}
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.projectId}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {group.projectName}
              </span>
              <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-2xs text-[var(--color-text-muted)]">
                {group.shots.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {group.shots.map((entry) => (
                <LinkedShotRow key={entry.shotId} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
