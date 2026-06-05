import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { formatHHMMTo12h, parseTimeToMinutes } from "@/features/schedules/lib/time"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { SkeletonLine } from "@/shared/components/Skeleton"
import type { Schedule, ScheduleEntry } from "@/shared/types"

/**
 * ShootDaySchedule — the "Shoot day" mini timed-block list on the project-home
 * (Ledger) route. Mirrors the locked mockup `01-A-ledger-desktop.html` zone H
 * (`.sched-mini`): a header ("Shoot day · {date}") followed by compact rows of
 * `time · block label · shot count`.
 *
 * Read-only: this component only subscribes to already-existing schedule data
 * and never writes. It cannot mutate the project.
 *
 * Degradation:
 *  - no clientId / no schedule  → labelled InlineEmpty
 *  - loading                    → skeleton lines
 *  - schedule with no entries   → header + InlineEmpty for the block list
 *
 * Schedule data is fetched ONCE by `ProjectHomePage` and passed down as props
 * (`schedules` + `scheduleEntries`), so this section no longer opens its own
 * `useSchedules`/`useScheduleEntries` subscriptions — that duplicated the
 * parent's listeners on the same paths (fan-out, prohibited by CLAUDE.md Rule 5).
 * The per-day crew-call detail (`useScheduleDayDetails`) is unique to this
 * section and stays local.
 */

const MAX_BLOCKS = 6

export interface ShootDayScheduleProps {
  /** Project whose schedule to show. */
  readonly projectId: string
  /** Client scope; null disables the day-detail subscription (degrades to empty). */
  readonly clientId: string | null
  /** Schedules for this project, fetched once by the parent (ordered createdAt desc). */
  readonly schedules: readonly Schedule[]
  /** True while the parent's schedules subscription is loading. */
  readonly schedulesLoading?: boolean
  /** Entries for the primary schedule, fetched once by the parent. */
  readonly scheduleEntries: readonly ScheduleEntry[]
  /** True while the parent's schedule-entries subscription is loading. */
  readonly entriesLoading?: boolean
}

/** A display block: a timed entry with an aggregated shot tally. */
interface ScheduleBlock {
  readonly key: string
  /** 12h display time, e.g. "7:30 AM"; "" when the entry has no start time. */
  readonly time: string
  /** Sort key (minutes since midnight); large fallback so untimed sort last. */
  readonly sortMinutes: number
  /** Block label (entry title). */
  readonly label: string
  /** Number of shot entries represented by this block. */
  readonly shotCount: number
}

/** Resolve the best available start-time string for an entry. */
function entryTime(entry: ScheduleEntry): string | null {
  return entry.startTime ?? entry.time ?? null
}

/**
 * Reduce raw schedule entries into ordered display blocks. Setup/move/break/
 * banner entries each render as their own block (shotCount 0); consecutive
 * runs are not merged — the entry order from Firestore (`order` asc) is honored.
 * Shot entries that share an identical start time and title collapse into a
 * single block with a summed shot count, matching the mockup's "Flat-lay block
 * · 18 shots" rollup.
 */
function buildBlocks(entries: readonly ScheduleEntry[]): readonly ScheduleBlock[] {
  const byKey = new Map<string, ScheduleBlock>()

  for (const entry of entries) {
    const raw = entryTime(entry)
    const minutes = parseTimeToMinutes(raw)
    const time = raw ? formatHHMMTo12h(raw) : ""
    const label = entry.title?.trim() || "Untitled block"
    const isShot = entry.type === "shot"

    // Collapse same-time + same-title shot rows into one tally; everything else
    // gets a unique key so it always renders as its own line.
    const key = isShot ? `shot:${raw ?? "?"}:${label}` : `entry:${entry.id}`
    const existing = byKey.get(key)

    if (existing) {
      byKey.set(key, {
        ...existing,
        shotCount: existing.shotCount + (isShot ? 1 : 0),
      })
      continue
    }

    byKey.set(key, {
      key,
      time,
      sortMinutes: minutes ?? Number.MAX_SAFE_INTEGER,
      label,
      shotCount: isShot ? 1 : 0,
    })
  }

  return Array.from(byKey.values()).sort((a, b) => a.sortMinutes - b.sortMinutes)
}

/** Header label: "Shoot day · Jun 9" when the schedule has a date. */
function scheduleHeading(schedule: Schedule | undefined): string {
  const ts = schedule?.date
  if (!ts) return "Shoot day"
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(ts.toDate())
    return `Shoot day · ${formatted}`
  } catch {
    return "Shoot day"
  }
}

export function ShootDaySchedule({
  projectId,
  clientId,
  schedules,
  schedulesLoading = false,
  scheduleEntries,
  entriesLoading = false,
}: ShootDayScheduleProps) {
  // The mockup shows a single shoot-day mini schedule; surface the first
  // schedule (the parent's useSchedules already orders by createdAt desc).
  const schedule = schedules[0]
  const scheduleId = schedule?.id ?? null

  const { data: dayDetails } = useScheduleDayDetails(
    clientId,
    projectId,
    scheduleId,
  )

  const heading = "Shoot day"

  if (schedulesLoading) {
    return (
      <section aria-label="Shoot day schedule">
        <MiniHeading>{heading}</MiniHeading>
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-4 w-full" delay={0} />
          <SkeletonLine className="h-4 w-5/6" delay={1} />
          <SkeletonLine className="h-4 w-2/3" delay={2} />
        </div>
      </section>
    )
  }

  if (!clientId || !schedule) {
    return (
      <section aria-label="Shoot day schedule">
        <MiniHeading>{heading}</MiniHeading>
        <InlineEmpty
          title="No schedule yet"
          description="Build a call sheet to plan the shoot day."
        />
      </section>
    )
  }

  const blocks = buildBlocks(scheduleEntries)
  const crewCall = formatHHMMTo12h(dayDetails?.crewCallTime)

  return (
    <section aria-label="Shoot day schedule">
      <MiniHeading>{scheduleHeading(schedule)}</MiniHeading>

      {crewCall && (
        <ScheduleRow
          time={crewCall}
          label="Crew call · setup"
          countLabel=""
          muted
        />
      )}

      {entriesLoading ? (
        <div className="flex flex-col gap-2 pt-1">
          <SkeletonLine className="h-4 w-full" delay={0} />
          <SkeletonLine className="h-4 w-3/4" delay={1} />
        </div>
      ) : blocks.length === 0 ? (
        <InlineEmpty
          title="No blocks scheduled"
          description="Add shots to the schedule to see the day's timeline."
        />
      ) : (
        blocks.slice(0, MAX_BLOCKS).map((block) => (
          <ScheduleRow
            key={block.key}
            time={block.time}
            label={block.label}
            countLabel={
              block.shotCount > 0
                ? `${block.shotCount} ${block.shotCount === 1 ? "shot" : "shots"}`
                : ""
            }
          />
        ))
      )}
    </section>
  )
}

function MiniHeading({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-3xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
      {children}
    </div>
  )
}

interface ScheduleRowProps {
  readonly time: string
  readonly label: string
  readonly countLabel: string
  readonly muted?: boolean
}

function ScheduleRow({ time, label, countLabel, muted }: ScheduleRowProps) {
  return (
    <div className="flex items-baseline gap-2.5 border-b border-[var(--color-border)] py-1.5 text-xs last:border-b-0">
      <span
        className="w-16 flex-none text-sm text-[var(--color-text)]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {time || "—"}
      </span>
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span
        className={
          "ml-auto tabular-nums " +
          (muted
            ? "text-[var(--color-text-subtle)]"
            : "text-[var(--color-text-secondary)]")
        }
      >
        {countLabel || (muted ? "··" : "")}
      </span>
    </div>
  )
}
