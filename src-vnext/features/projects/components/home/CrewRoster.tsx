import { useMemo } from "react"
import { useCrewLibrary } from "@/features/library/hooks/useCrewLibrary"
import { useScheduleCrewCalls } from "@/features/schedules/hooks/useScheduleCrewCalls"
import { EmptyState } from "@/shared/components/EmptyState"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { SkeletonLine } from "@/shared/components/Skeleton"
import type { CrewRecord, Schedule } from "@/shared/types"

/**
 * Crew roster zone (mockup zone E) for the project-home ledger.
 *
 * Read-only: lists crew from the org crew library and, when the project has a
 * schedule, marks who is on call for it. There is no per-member "confirmed /
 * pending" field in the data model, so we degrade to an on-call / not-scheduled
 * signal derived from the first schedule's crew-call sheet, and to a plain
 * roster (no call status) when the project has no schedule yet.
 *
 * Never mutates: every hook here is a read-only subscription.
 */
interface CrewRosterProps {
  /** Active client scope. `useCrewLibrary` derives its own clientId from auth; this is used for the crew-call lookup. */
  readonly clientId: string | null
  /** Project whose schedule determines who is on call. */
  readonly projectId: string
  /** Schedules for this project, fetched once by the parent (ordered createdAt desc). */
  readonly schedules: readonly Schedule[]
  /** True while the parent's schedules subscription is loading. */
  readonly schedulesLoading?: boolean
}

interface CrewRosterRow {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly initials: string
  /** True when this member appears on the project's call sheet. */
  readonly onCall: boolean
}

function initialsFor(crew: CrewRecord): string {
  const source =
    crew.firstName || crew.lastName
      ? `${crew.firstName ?? ""} ${crew.lastName ?? ""}`.trim()
      : crew.name
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function roleFor(crew: CrewRecord): string {
  return crew.position || crew.department || "Crew"
}

export function CrewRoster({ clientId, projectId, schedules, schedulesLoading = false }: CrewRosterProps) {
  const { data: crew, loading: crewLoading } = useCrewLibrary()

  // The project's primary (most recent) schedule, if any. The parent's
  // useSchedules orders by createdAt desc, so the first entry is the latest.
  const scheduleId = schedules.length > 0 ? schedules[0]!.id : null
  const { data: crewCalls } = useScheduleCrewCalls(
    clientId,
    projectId,
    scheduleId,
  )

  const onCallIds = useMemo(
    () => new Set(crewCalls.map((call) => call.crewMemberId)),
    [crewCalls],
  )

  const rows = useMemo<readonly CrewRosterRow[]>(
    () =>
      crew.map((member) => ({
        id: member.id,
        name: member.name,
        role: roleFor(member),
        initials: initialsFor(member),
        onCall: onCallIds.has(member.id),
      })),
    [crew, onCallIds],
  )

  const hasSchedule = scheduleId !== null
  const confirmedCount = rows.filter((row) => row.onCall).length

  if (crewLoading || schedulesLoading) {
    return (
      <div className="space-y-3" aria-busy="true" data-testid="crew-roster-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine className="h-7 w-7 rounded-full" delay={i} />
            <SkeletonLine className="h-4 w-24" delay={i} />
            <SkeletonLine className="ml-auto h-4 w-16" delay={i} />
          </div>
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No crew yet"
        description="Crew members added to the library will appear here, with their call status once the call sheet is built."
      />
    )
  }

  return (
    <section aria-label="Crew">
      <header className="mb-1 flex items-baseline justify-between">
        <h2
          className="font-bold leading-[0.92] tracking-[-0.01em] text-[var(--color-text)]"
          style={{ fontSize: "21px", fontFamily: "var(--font-display)" }}
        >
          Crew<span className="iconic-period">.</span>
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {hasSchedule
            ? `${rows.length} ${rows.length === 1 ? "role" : "roles"} · ${confirmedCount} on call`
            : `${rows.length} ${rows.length === 1 ? "member" : "members"}`}
        </span>
      </header>

      <ul className="border-t border-[var(--color-border-strong)]">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 border-b border-[var(--color-border)] py-3"
            data-testid="crew-roster-row"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              {row.initials}
            </span>
            <span className="w-28 flex-none text-2xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              {row.role}
            </span>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {row.name}
            </span>
            {hasSchedule && (
              <span className="ml-auto">
                {row.onCall ? (
                  <StatusBadge label="On call" color="green" />
                ) : (
                  <StatusBadge label="Not scheduled" color="gray" />
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {!hasSchedule && (
        <p className="mt-3 text-xs text-[var(--color-text-subtle)]">
          Call status appears once a call sheet is built for this project.
        </p>
      )}
    </section>
  )
}
