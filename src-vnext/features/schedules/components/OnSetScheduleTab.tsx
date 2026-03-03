import { useState } from "react"
import { parseTimeToMinutes, formatMinutesTo12h } from "@/features/schedules/lib/time"
import type { ScheduleEntry } from "@/shared/types"

type BlockStatus = "done" | "in_progress" | "up_next" | "later"

interface EntryWithStatus {
  entry: ScheduleEntry
  status: BlockStatus
  startMinutes: number | null
  endMinutes: number | null
}

function classifyEntries(
  entries: ScheduleEntry[],
  nowMinute: number,
): EntryWithStatus[] {
  const withTimes = entries.map((entry) => {
    const startMinutes = parseTimeToMinutes(entry.startTime ?? entry.time ?? null)
    const duration = entry.duration ?? 60
    const endMinutes = startMinutes != null ? startMinutes + duration : null
    return { entry, startMinutes, endMinutes }
  })

  let upNextAssigned = false
  const result: EntryWithStatus[] = []

  for (const item of withTimes) {
    const { startMinutes, endMinutes } = item
    let status: BlockStatus = "later"

    if (startMinutes == null) {
      status = "later"
    } else if (endMinutes != null && endMinutes <= nowMinute) {
      status = "done"
    } else if (startMinutes <= nowMinute && (endMinutes == null || endMinutes > nowMinute)) {
      status = "in_progress"
    } else if (!upNextAssigned && startMinutes > nowMinute) {
      status = "up_next"
      upNextAssigned = true
    } else {
      status = "later"
    }

    result.push({ ...item, status })
  }

  return result
}

function getAccentBorderClass(entry: ScheduleEntry): string {
  if (entry.type === "banner") {
    const label = (entry.title ?? "").toLowerCase()
    if (label.includes("setup") || label.includes("hmu") || label.includes("hair")) return "border-l-violet-500"
    if (label.includes("lunch") || label.includes("meal") || label.includes("break")) return "border-l-emerald-500"
    if (label.includes("travel") || label.includes("move")) return "border-l-zinc-400"
    return "border-l-neutral-800 dark:border-l-neutral-200"
  }
  return "border-l-blue-500"
}

function TimeGutter({ minutes, status }: { minutes: number | null; status: BlockStatus }) {
  if (minutes == null) return <div style={{ width: 52 }} />

  const formatted = formatMinutesTo12h(minutes)
  const parts = formatted.split(" ")
  const timePart = parts[0] ?? ""
  const ampm = parts[1] ?? ""

  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 52 }}>
      <span
        className={`text-xs whitespace-nowrap ${status === "in_progress" ? "font-bold text-[var(--color-text)]" : "font-semibold text-[var(--color-text)]"}`}
      >
        {timePart}
      </span>
      <span
        className={`text-3xs ${status === "in_progress" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-text-subtle)]"}`}
      >
        {status === "in_progress" ? "NOW" : ampm}
      </span>
    </div>
  )
}

function BlockStatusBadge({ status }: { status: BlockStatus }) {
  if (status === "done") {
    return (
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-3xs text-[var(--color-text-muted)]">Done</span>
      </div>
    )
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        In Progress
      </span>
    )
  }
  if (status === "up_next") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Up Next
      </span>
    )
  }
  return <span className="text-3xs text-[var(--color-text-muted)]">Later</span>
}

interface ScheduleBlockProps {
  item: EntryWithStatus
  nowMinute: number
}

function ScheduleBlock({ item, nowMinute }: ScheduleBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const { entry, status, startMinutes, endMinutes } = item
  const borderClass = getAccentBorderClass(entry)
  const isDone = status === "done"
  const isActive = status === "in_progress"

  const progressPct =
    isActive && startMinutes != null && endMinutes != null && endMinutes > startMinutes
      ? Math.min(100, Math.round(((nowMinute - startMinutes) / (endMinutes - startMinutes)) * 100))
      : 0

  const elapsedMin =
    isActive && startMinutes != null ? nowMinute - startMinutes : null
  const remainingMin =
    isActive && endMinutes != null ? endMinutes - nowMinute : null

  return (
    <div className={`flex gap-3 ${isDone ? "opacity-50" : ""}`}>
      <TimeGutter minutes={startMinutes} status={status} />
      <div
        className={`flex-1 border-l-[3px] pl-3 pb-3 ${isActive ? "border-l-emerald-500" : borderClass}`}
      >
        <button
          className={`w-full text-left bg-[var(--color-surface)] rounded-lg p-3 ${
            isActive
              ? "border-2 border-emerald-500 pulse-active"
              : "border border-[var(--color-border)]"
          }`}
          onClick={() => setExpanded((prev) => !prev)}
          type="button"
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-sm ${isActive ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}
            >
              {entry.title}
            </span>
            <BlockStatusBadge status={status} />
          </div>

          {entry.notes && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{entry.notes}</p>
          )}

          {isActive && (
            <>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--color-border)]">
                {elapsedMin != null && (
                  <span className="text-3xs text-[var(--color-text-muted)]">
                    Started {elapsedMin}m ago
                  </span>
                )}
                {elapsedMin != null && remainingMin != null && (
                  <span className="text-[var(--color-border)]">|</span>
                )}
                {remainingMin != null && remainingMin > 0 && (
                  <span className="text-3xs text-[var(--color-text-muted)]">
                    ~{remainingMin}m remaining
                  </span>
                )}
              </div>
              <div className="mt-2">
                <div className="h-1 rounded-full overflow-hidden bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {expanded && (
            <div className="pt-2 mt-2 border-t border-[var(--color-border)] space-y-1">
              {entry.type === "shot" && entry.shotId && (
                <p className="text-xs text-[var(--color-text-muted)]">Shot ID: {entry.shotId}</p>
              )}
              {endMinutes != null && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Until: {formatMinutesTo12h(endMinutes)}
                </p>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

interface NowIndicatorProps {
  nowMinute: number
}

function NowIndicator({ nowMinute }: NowIndicatorProps) {
  const formatted = formatMinutesTo12h(nowMinute)
  return (
    <div
      className="flex items-center gap-2 py-1.5 now-line-pulse"
      style={{ marginLeft: 52, paddingLeft: 12 }}
    >
      <div
        className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_rgba(var(--color-accent-rgb,227,30,36),0.4)]"
      />
      <div
        className="flex-1 h-px"
        style={{ background: "linear-gradient(to right, var(--color-accent), transparent)" }}
      />
      <span className="text-3xs font-bold uppercase tracking-wider flex-shrink-0 pr-1 text-[var(--color-accent)]">
        NOW — {formatted}
      </span>
    </div>
  )
}

interface OnSetScheduleTabProps {
  entries: ScheduleEntry[]
  nowMinute: number
}

export function OnSetScheduleTab({ entries, nowMinute }: OnSetScheduleTabProps) {
  const filtered = entries.filter((e) => e.type === "shot" || e.type === "banner")
  const classified = classifyEntries(filtered, nowMinute)

  const nowInsertIndex = classified.findIndex(
    (item) => item.status === "in_progress" || item.status === "up_next" || item.status === "later",
  )

  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          Today's Schedule
        </h3>
        <span className="text-2xs text-[var(--color-text-muted)]">
          {filtered.length} {filtered.length === 1 ? "block" : "blocks"}
        </span>
      </div>

      <div className="flex flex-col gap-0">
        {classified.map((item, idx) => (
          <div key={item.entry.id}>
            {idx === nowInsertIndex && idx > 0 && <NowIndicator nowMinute={nowMinute} />}
            <ScheduleBlock item={item} nowMinute={nowMinute} />
          </div>
        ))}
        {classified.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
            No scheduled entries.
          </p>
        )}
      </div>
    </div>
  )
}
