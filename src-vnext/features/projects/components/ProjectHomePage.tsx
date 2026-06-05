import { useMemo } from "react"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProject } from "@/features/projects/hooks/useProject"
import { useShots } from "@/features/shots/hooks/useShots"
import { useLanes } from "@/features/shots/hooks/useLanes"
import { useCastingBoard } from "@/features/casting/hooks/useCastingBoard"
import { usePulls } from "@/features/pulls/hooks/usePulls"
import { useSchedules } from "@/features/schedules/hooks/useSchedules"
import { useScheduleEntries } from "@/features/schedules/hooks/useScheduleEntries"
import { computeInsights } from "@/features/shots/lib/shotListFilters"
import { normalizeShootDates } from "@/features/projects/lib/shootDates"
import { buildLedgerRows } from "@/features/projects/components/home/lib/ledgerData"
import { computeNextAction } from "@/features/projects/components/home/lib/computeNextAction"
import { ProjectHero, type ProjectHeroCountdown } from "@/features/projects/components/home/ProjectHero"
import { StatusLedger } from "@/features/projects/components/home/StatusLedger"
import type { LedgerRowViewModel, LedgerTagTone } from "@/features/projects/components/home/LedgerRow"
import { NextActionBar } from "@/features/projects/components/home/NextActionBar"
import { CrewRoster } from "@/features/projects/components/home/CrewRoster"
import { ProductsInShoot } from "@/features/projects/components/home/ProductsInShoot"
import { BriefCard } from "@/features/projects/components/home/BriefCard"
import { ShootDaySchedule } from "@/features/projects/components/home/ShootDaySchedule"
import { SkeletonLine } from "@/shared/components/Skeleton"

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Earliest upcoming shoot date as a local Date, or null when none is upcoming. */
function earliestUpcomingShoot(shootDates: readonly string[], now: Date): Date | null {
  const dates = normalizeShootDates(shootDates) // sorted ascending YYYY-MM-DD
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (const iso of dates) {
    const [y, m, d] = iso.split("-").map(Number)
    if (y == null || m == null || d == null) continue
    const date = new Date(y, m - 1, d)
    if (date.getTime() >= today.getTime()) return date
  }
  return null
}

/** Pre-format a shoot date as "Tuesday, June 9". */
function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

/** Smallest 24h HH:MM start time across schedule entries, or undefined. */
function earliestStartTime(
  entries: ReadonlyArray<{ startTime?: string | null }>,
): string | undefined {
  const times = entries
    .map((e) => e.startTime)
    .filter((t): t is string => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t))
    .sort()
  return times[0]
}

/** Count of unbooked talent/roles (not booked, not passed). */
function countUnbooked(
  entries: ReadonlyArray<{ status: string }>,
): number {
  return entries.filter((e) => e.status !== "booked" && e.status !== "passed").length
}

const ROW_META: Record<string, { index: string; path: string; linkLabel: string }> = {
  shots: { index: "i.", path: "shots", linkLabel: "Open list" },
  casting: { index: "ii.", path: "casting", linkLabel: "Open board" },
  pulls: { index: "iii.", path: "pulls", linkLabel: "Open pulls" },
  callsheet: { index: "iv.", path: "callsheet", linkLabel: "Open call sheet" },
  export: { index: "v.", path: "export", linkLabel: "Open export" },
}

/**
 * Ledger project-home at /projects/:id — the orientation view a producer lands
 * on when opening a project: hero + countdown, a "do this next" bar, the
 * stage-by-stage status ledger, plus crew, products, brief and shoot-day
 * sections. Read-only: every hook here is subscribe-only; the route introduces
 * no writes and cannot mutate the active project.
 */
export default function ProjectHomePage() {
  const { projectId } = useProjectScope()
  const { clientId } = useAuth()

  const { data: project, loading: projectLoading } = useProject(projectId)
  const { data: shots } = useShots()
  const { data: lanes } = useLanes()
  const { entries: castingEntries } = useCastingBoard(projectId, clientId)
  const { data: pulls } = usePulls()
  // Fetch schedules + entries ONCE here and pass them down to CrewRoster and
  // ShootDaySchedule as props. Those sections used to open their own
  // useSchedules/useScheduleEntries subscriptions on the same paths — duplicate
  // listeners (fan-out) that CLAUDE.md Rule 5 prohibits.
  const { data: schedules, loading: schedulesLoading } = useSchedules(clientId, projectId)
  const firstScheduleId = schedules[0]?.id ?? null
  const { data: scheduleEntries, loading: scheduleEntriesLoading } = useScheduleEntries(
    clientId,
    projectId,
    firstScheduleId,
  )

  const insights = useMemo(() => computeInsights(shots), [shots])

  const countdown = useMemo<ProjectHeroCountdown | null>(() => {
    if (!project) return null
    const now = new Date()
    const shootDate = earliestUpcomingShoot(project.shootDates, now)
    if (!shootDate) return null
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = Math.max(
      0,
      Math.ceil((shootDate.getTime() - today.getTime()) / MS_PER_DAY),
    )
    return {
      days,
      dateLabel: formatLongDate(shootDate),
      callTime: earliestStartTime(scheduleEntries),
    }
  }, [project, scheduleEntries])

  const ledgerRows = useMemo<readonly LedgerRowViewModel[]>(() => {
    const rows = buildLedgerRows({
      statusCounts: insights.statusCounts,
      totalShots: shots.length,
      sceneCount: lanes.length,
      castingEntries,
      pulls,
      schedules,
      scheduleEntries,
    })
    const unbooked = countUnbooked(castingEntries)
    const samples = pulls.reduce(
      (acc, pull) => {
        for (const item of pull.items) {
          for (const s of item.sizes) {
            const qty = s.quantity ?? 0
            acc.total += qty
            acc.arrived += Math.min(s.fulfilled ?? 0, qty)
          }
        }
        return acc
      },
      { total: 0, arrived: 0 },
    )

    return rows.map((row) => {
      const meta = ROW_META[row.key]
      let tag: { label: string; tone: LedgerTagTone } | undefined
      let flagged = false

      switch (row.key) {
        case "shots": {
          const total = shots.length
          tag =
            total > 0 && insights.statusCounts.complete === total
              ? { label: "List locked", tone: "ok" }
              : { label: "Building list", tone: "info" }
          break
        }
        case "casting":
          if (unbooked > 0) {
            tag = {
              label: `${unbooked} ${unbooked === 1 ? "role" : "roles"} unbooked`,
              tone: "crit",
            }
            flagged = true
          } else if (castingEntries.length > 0) {
            tag = { label: "Cast locked", tone: "ok" }
          } else {
            tag = { label: "No casting yet", tone: "todo" }
          }
          break
        case "pulls":
          tag =
            samples.total === 0
              ? { label: "No samples yet", tone: "todo" }
              : {
                  label: `${samples.arrived}/${samples.total} samples in`,
                  tone: samples.arrived === samples.total ? "ok" : "info",
                }
          break
        case "callsheet":
          tag =
            schedules.length > 0
              ? { label: "Draft", tone: "info" }
              : { label: "Not started", tone: "todo" }
          break
        case "export":
          tag = row.enabled
            ? { label: "Ready", tone: "ok" }
            : { label: "Locked", tone: "todo" }
          break
        default:
          tag = undefined
      }

      return {
        row,
        index: meta?.index,
        tag,
        flagged,
        to: meta ? `/projects/${projectId}/${meta.path}` : undefined,
        linkLabel: meta?.linkLabel,
      }
    })
  }, [insights, shots, lanes, castingEntries, pulls, schedules, scheduleEntries, projectId])

  const nextAction = useMemo(() => {
    const samplesMissing = pulls.reduce(
      (acc, pull) =>
        acc +
        pull.items.reduce(
          (sum, item) =>
            sum + item.sizes.filter((s) => (s.fulfilled ?? 0) < s.quantity).length,
          0,
        ),
      0,
    )
    return computeNextAction({
      projectId,
      shotCounts: insights.statusCounts,
      casting: { unbooked: countUnbooked(castingEntries) },
      samples: { missing: samplesMissing },
      // TODO: `sent` is a stub — the schedule model has no "sent" field yet, so
      // we hardcode false. Wire to real data when call-sheet send state exists;
      // until then computeNextAction's build-shot-list branch only fires via the
      // empty-project path.
      schedule: { hasCallSheet: schedules.length > 0, sent: false },
      shootDate: project ? earliestUpcomingShoot(project.shootDates, new Date()) : null,
    })
  }, [projectId, insights, castingEntries, pulls, schedules, project])

  // Hero eyebrow. There is no client/brand-name entity (project.clientId is the
  // auth-org id, not a brand), so we orient from real loaded data — scene/shot
  // counts — rather than fabricating a brand line. Rejoins the status pill into
  // the eyebrow row in ProjectHero instead of leaving a bare floating pill.
  const heroEyebrow = useMemo(() => {
    const parts: string[] = []
    if (lanes.length > 0) {
      parts.push(`${lanes.length} ${lanes.length === 1 ? "scene" : "scenes"}`)
    }
    parts.push(`${shots.length} ${shots.length === 1 ? "shot" : "shots"}`)
    return parts.join(" · ")
  }, [lanes.length, shots.length])

  if (projectLoading || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8" data-testid="project-home-loading">
        <SkeletonLine className="h-3 w-40" />
        <SkeletonLine className="mt-4 h-10 w-80" />
        <SkeletonLine className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-10 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8" data-testid="project-home">
      <ProjectHero project={project} eyebrow={heroEyebrow} countdown={countdown} />

      {nextAction && (
        <div className="mt-8">
          <NextActionBar action={nextAction} />
        </div>
      )}

      <div className="mt-10">
        <StatusLedger rows={ledgerRows} subline="This project only · live" />
      </div>

      {/*
        Two independently-stacked columns (NOT a symmetric grid): a wide main
        column + a fixed 320px rail. Each column self-stacks, so an unequal
        section height in one column can no longer void out a short section
        beside it (the old `lg:grid-cols-2` bug).
      */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-10">
          <CrewRoster
            clientId={clientId}
            projectId={projectId}
            schedules={schedules}
            schedulesLoading={schedulesLoading}
          />
          <ProductsInShoot shots={shots} />
        </div>
        <div className="flex flex-col gap-8">
          <BriefCard briefUrl={project.briefUrl} notes={project.notes} />
          {/* Use the auth-derived clientId throughout (not project.clientId) so an
              admin viewing another org's project stays consistent with CrewRoster. */}
          <ShootDaySchedule
            projectId={projectId}
            clientId={clientId}
            schedules={schedules}
            schedulesLoading={schedulesLoading}
            scheduleEntries={scheduleEntries}
            entriesLoading={scheduleEntriesLoading}
          />
        </div>
      </div>
    </div>
  )
}
