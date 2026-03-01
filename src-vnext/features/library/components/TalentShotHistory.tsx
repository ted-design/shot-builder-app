import { useMemo } from "react"
import { ImageIcon } from "lucide-react"
import type { TalentShotHistoryEntry } from "@/features/library/lib/talentShotHistory"
import { useTalentShotHistory } from "@/features/library/hooks/useTalentShotHistory"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import type { ShotFirestoreStatus } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  try {
    // Handle YYYY-MM-DD as local date (avoid timezone shift)
    const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const d = parts
      ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
      : new Date(dateStr)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

interface GroupedShots {
  readonly projectId: string
  readonly projectName: string
  readonly shots: readonly TalentShotHistoryEntry[]
}

function groupByProject(entries: readonly TalentShotHistoryEntry[]): readonly GroupedShots[] {
  const map = new Map<string, { projectName: string; shots: TalentShotHistoryEntry[] }>()

  for (const entry of entries) {
    const key = entry.projectId || "unknown"
    const existing = map.get(key)
    if (existing) {
      existing.shots.push(entry)
    } else {
      map.set(key, {
        projectName: entry.projectName || entry.projectId || "Unknown Project",
        shots: [entry],
      })
    }
  }

  return Array.from(map.entries()).map(([projectId, group]) => ({
    projectId,
    projectName: group.projectName,
    shots: group.shots,
  }))
}

// ---------------------------------------------------------------------------
// Shot row (desktop)
// ---------------------------------------------------------------------------

function ShotHistoryRow({ entry }: { readonly entry: TalentShotHistoryEntry }) {
  const status = entry.shotStatus as ShotFirestoreStatus
  const label = getShotStatusLabel(status)
  const color = getShotStatusColor(status)

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:bg-[var(--color-surface-subtle)]">
      {/* Thumbnail placeholder */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
        {entry.heroImageUrl ? (
          <img
            src={entry.heroImageUrl}
            alt={entry.shotTitle}
            className="h-full w-full rounded object-cover"
          />
        ) : (
          <ImageIcon className="h-4 w-4 text-[var(--color-text-subtle)]" />
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {entry.shotNumber ? (
            <span className="text-2xs font-semibold tabular-nums text-[var(--color-text-muted)]">
              #{entry.shotNumber}
            </span>
          ) : null}
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {entry.shotTitle || "Untitled shot"}
          </span>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {formatDate(entry.shootDate)}
        </div>
      </div>

      {/* Status badge */}
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ${statusBadgeClass(color)}`}>
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shot row (mobile — compact)
// ---------------------------------------------------------------------------

function ShotHistoryRowCompact({ entry }: { readonly entry: TalentShotHistoryEntry }) {
  const status = entry.shotStatus as ShotFirestoreStatus
  const label = getShotStatusLabel(status)
  const color = getShotStatusColor(status)

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-2 last:border-b-0">
      {entry.shotNumber ? (
        <span className="w-9 flex-shrink-0 text-2xs font-semibold tabular-nums text-[var(--color-text-muted)]">
          #{entry.shotNumber}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-[var(--color-text)]">
          {entry.shotTitle || "Untitled shot"}
        </div>
      </div>
      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-medium ${statusBadgeClass(color)}`}>
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TalentShotHistoryProps {
  readonly talentId: string
  readonly clientId: string
}

export function TalentShotHistory({ talentId, clientId }: TalentShotHistoryProps) {
  const { entries, loading, error } = useTalentShotHistory(talentId, clientId)
  const isMobile = useIsMobile()

  const groups = useMemo(() => groupByProject(entries), [entries])

  const totalShots = entries.length
  const totalProjects = groups.length

  if (loading) {
    return <LoadingState loading />
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-[var(--color-error)]">
        {error instanceof Error ? error.message : "Failed to load shot history"}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-subtle)]">
          <ImageIcon className="h-5 w-5 text-[var(--color-text-subtle)]" />
        </div>
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">
          No shot history
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-subtle)]">
          This talent hasn&apos;t been assigned to any shots yet.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 text-xs text-[var(--color-text-muted)]">
        {totalShots} shot{totalShots === 1 ? "" : "s"} across {totalProjects} project{totalProjects === 1 ? "" : "s"}
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.projectId}>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {group.projectName}
            </div>

            {isMobile ? (
              <div>
                {group.shots.map((entry) => (
                  <ShotHistoryRowCompact key={entry.shotId} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {group.shots.map((entry) => (
                  <ShotHistoryRow key={entry.shotId} entry={entry} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
