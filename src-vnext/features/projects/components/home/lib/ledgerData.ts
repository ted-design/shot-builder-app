/**
 * ledgerData — pure, React-free adapters that map already-fetched project data
 * into ledger-row view-models for the Status Ledger on the project-home route.
 *
 * NO hooks, NO React, NO Firestore reads, NO writes. Every function takes data
 * the page has already fetched and returns a plain {@link LedgerRow}. Segment
 * `value`s are raw counts; the consuming component turns them into proportional
 * bar widths (e.g. `flex: value`). A row with a zero total still renders a
 * single muted "empty" segment so the bar never collapses to nothing.
 *
 * Colors are emitted as design-token CSS custom-property *names* (e.g.
 * `--color-success`). The component wraps them in `var(...)`. Never hardcode hex.
 *
 * Mirrors the locked mockup 01-A-ledger-desktop.html:
 *   i. Shot list   — todo / in_progress / on_hold / complete
 *   ii. Casting    — by CastingBoardStatus (booked / hold / shortlist / passed/open)
 *   iii. Pulls     — fulfilled / in-progress / pending samples
 *   iv. Call sheet — shoot days / scheduled blocks
 *   v. Export      — gated until at least one shot is complete
 */

import type {
  CastingBoardEntry,
  CastingBoardStatus,
  Pull,
  Schedule,
  ScheduleEntry,
  Shot,
  ShotFirestoreStatus,
} from "@/shared/types"

// ---------------------------------------------------------------------------
// View-model shape
// ---------------------------------------------------------------------------

/** Design-token CSS custom-property name, e.g. `--color-success`. */
export type ColorVar = `--${string}`

export interface LedgerSegment {
  /** Stable key for React lists, e.g. "complete". */
  readonly key: string
  /** Human label, e.g. "Shot". */
  readonly label: string
  /** Raw count; the component maps this to a proportional bar width. */
  readonly value: number
  /** Design-token name; component renders `var(colorVar)`. */
  readonly colorVar: ColorVar
  /**
   * True for the synthetic muted segment that keeps an all-zero bar from
   * collapsing. Its `value` (1) is a layout placeholder, not a real count, so
   * the legend must NOT print it.
   */
  readonly isPlaceholder?: boolean
}

export interface LedgerRow {
  /** Stable row key, e.g. "shots". */
  readonly key: string
  /** Row title, e.g. "Shot list". */
  readonly label: string
  /** Primary tally for the row (e.g. total shots). */
  readonly count: number
  /** Secondary meta line, e.g. "48 shots · 6 scenes". */
  readonly detail: string
  /** Segmented-bar parts (already ordered for display). */
  readonly segments: readonly LedgerSegment[]
  /**
   * Whether the row is actionable yet. Currently only the export row gates
   * (false until a shot is complete); all other rows are always enabled.
   */
  readonly enabled: boolean
}

// ---------------------------------------------------------------------------
// Token map (semantic stages → design tokens) — single source of truth
// ---------------------------------------------------------------------------

const STAGE_COLOR = {
  done: "--color-success",
  progress: "--color-info",
  hold: "--color-warning",
  todo: "--color-surface-muted",
} as const satisfies Record<string, ColorVar>

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** Pluralize a noun by count (no i18n; English fallback). */
function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

/**
 * Count items by a derived key. Returns a plain record. Pure; does not mutate
 * the input array.
 */
function countBy<T, K extends string>(
  items: ReadonlyArray<T>,
  keyOf: (item: T) => K,
): Record<K, number> {
  return items.reduce(
    (acc, item) => {
      const k = keyOf(item)
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    },
    {} as Record<K, number>,
  )
}

/** Single muted placeholder segment so an all-zero bar still renders. */
function emptySegment(label: string): LedgerSegment {
  return { key: "empty", label, value: 1, colorVar: STAGE_COLOR.todo, isPlaceholder: true }
}

// ---------------------------------------------------------------------------
// i. Shot list
// ---------------------------------------------------------------------------

/** Status counts shape produced by `computeInsights(...).statusCounts`. */
export type ShotStatusCounts = Record<ShotFirestoreStatus, number>

export interface ShotsRowInput {
  /** Pre-computed status counts (from `computeInsights`). */
  readonly statusCounts: ShotStatusCounts
  /** Total shots; defaults to the sum of statusCounts. */
  readonly totalShots?: number
  /** Distinct scene/lane count for the meta line. */
  readonly sceneCount?: number
}

/**
 * Shot-list row — 4 segments todo / in_progress / on_hold / complete.
 * Ordered done → progress → hold → todo to match the mockup legend reading.
 */
export function buildShotsRow(input: ShotsRowInput): LedgerRow {
  const { statusCounts } = input
  const complete = statusCounts.complete ?? 0
  const inProgress = statusCounts.in_progress ?? 0
  const onHold = statusCounts.on_hold ?? 0
  const todo = statusCounts.todo ?? 0

  const total =
    input.totalShots ?? complete + inProgress + onHold + todo

  const segments: LedgerSegment[] = [
    { key: "complete", label: "Shot", value: complete, colorVar: STAGE_COLOR.done },
    { key: "in_progress", label: "In progress", value: inProgress, colorVar: STAGE_COLOR.progress },
    { key: "on_hold", label: "On hold", value: onHold, colorVar: STAGE_COLOR.hold },
    { key: "todo", label: "Draft", value: todo, colorVar: STAGE_COLOR.todo },
  ]

  const detail =
    input.sceneCount != null
      ? `${plural(total, "shot")} · ${plural(input.sceneCount, "scene")}`
      : plural(total, "shot")

  return {
    key: "shots",
    label: "Shot list",
    count: total,
    detail,
    segments: total === 0 ? [emptySegment("No shots yet")] : segments,
    enabled: true,
  }
}

// ---------------------------------------------------------------------------
// ii. Casting
// ---------------------------------------------------------------------------

const CASTING_COLOR = {
  booked: STAGE_COLOR.done,
  hold: STAGE_COLOR.progress,
  shortlist: STAGE_COLOR.hold,
  passed: STAGE_COLOR.todo,
} as const satisfies Record<CastingBoardStatus, ColorVar>

const CASTING_LABEL = {
  booked: "Booked",
  hold: "Hold",
  shortlist: "Shortlist",
  passed: "Passed",
} as const satisfies Record<CastingBoardStatus, string>

/**
 * Casting row — segmented by {@link CastingBoardStatus}. Distinct `roleLabel`s
 * drive the "roles" meta; total entries drive the headline count.
 */
export function buildCastingRow(entries: ReadonlyArray<CastingBoardEntry>): LedgerRow {
  const counts = countBy(entries, (e) => e.status)
  const total = entries.length

  const segments: LedgerSegment[] = (
    ["booked", "hold", "shortlist", "passed"] as const
  ).map((status) => ({
    key: status,
    label: CASTING_LABEL[status],
    value: counts[status] ?? 0,
    colorVar: CASTING_COLOR[status],
  }))

  const roleCount = new Set(
    entries
      .map((e) => (e.roleLabel ?? "").trim())
      .filter((label) => label.length > 0),
  ).size

  const detail =
    roleCount > 0
      ? `${plural(roleCount, "role")} · ${plural(total, "on board", "on board")}`
      : plural(total, "on board", "on board")

  return {
    key: "casting",
    label: "Casting",
    count: total,
    detail,
    segments: total === 0 ? [emptySegment("No talent added")] : segments,
    enabled: true,
  }
}

// ---------------------------------------------------------------------------
// iii. Pulls & samples
// ---------------------------------------------------------------------------

/**
 * Pulls/samples row — aggregates sample readiness across every pull item size.
 * Buckets: fulfilled (arrived) / in-transit (partial+substituted) / pending
 * (not yet in). Headline count = number of pulls; meta = total SKU sizes.
 */
export function buildPullsRow(pulls: ReadonlyArray<Pull>): LedgerRow {
  let arrived = 0
  let inTransit = 0
  let pending = 0

  for (const pull of pulls) {
    for (const item of pull.items ?? []) {
      for (const size of item.sizes ?? []) {
        const status = size.status ?? "pending"
        if (status === "fulfilled") arrived += 1
        else if (status === "partial" || status === "substituted") inTransit += 1
        else pending += 1
      }
    }
  }

  const totalSamples = arrived + inTransit + pending

  const segments: LedgerSegment[] = [
    { key: "arrived", label: "Arrived", value: arrived, colorVar: STAGE_COLOR.done },
    { key: "in_transit", label: "In transit", value: inTransit, colorVar: STAGE_COLOR.progress },
    { key: "pending", label: "Not requested", value: pending, colorVar: STAGE_COLOR.todo },
  ]

  const detail =
    totalSamples > 0
      ? `${plural(pulls.length, "pull")} · ${totalSamples} SKUs`
      : plural(pulls.length, "pull")

  return {
    key: "pulls",
    label: "Pulls & samples",
    count: pulls.length,
    detail,
    segments: totalSamples === 0 ? [emptySegment("No samples requested")] : segments,
    enabled: true,
  }
}

// ---------------------------------------------------------------------------
// iv. Call sheet
// ---------------------------------------------------------------------------

export interface CallSheetRowInput {
  /** Schedules for the project (one per shoot day). */
  readonly schedules: ReadonlyArray<Schedule>
  /**
   * All schedule entries (blocks) across those schedules, already fetched.
   * "shot"/"setup"/"move" count as placed blocks; "break"/"banner" are excluded
   * from the "scheduled" tally but still shown as part of the day.
   */
  readonly entries?: ReadonlyArray<ScheduleEntry>
}

/**
 * Call-sheet row — shoot days vs. scheduled blocks. Two segments: blocks placed
 * (scheduled) vs. remaining/unscheduled. No "sent" field exists, so the row
 * never claims a sent state (the consuming component shows draft-only).
 */
export function buildCallSheetRow(input: CallSheetRowInput): LedgerRow {
  const dayCount = input.schedules.length
  const entries = input.entries ?? []
  const placed = entries.filter(
    (e) => e.type === "shot" || e.type === "setup" || e.type === "move",
  ).length
  const other = entries.length - placed

  const segments: LedgerSegment[] = [
    { key: "placed", label: "Blocks placed", value: placed, colorVar: STAGE_COLOR.done },
    { key: "other", label: "Other / TBC", value: other, colorVar: STAGE_COLOR.todo },
  ]

  const detail =
    dayCount > 0
      ? `${plural(dayCount, "shoot day")} · ${plural(entries.length, "block")}`
      : "No schedule yet"

  return {
    key: "callsheet",
    label: "Call sheet",
    count: dayCount,
    detail,
    segments: dayCount === 0 ? [emptySegment("Not started")] : segments,
    enabled: dayCount > 0,
  }
}

// ---------------------------------------------------------------------------
// v. Export & share (gated)
// ---------------------------------------------------------------------------

/**
 * Export row — gated until at least one shot is complete (you can't export
 * before the shoot has produced captures). When gated, renders a single muted
 * segment and `enabled: false`.
 */
export function buildExportRow(statusCounts: ShotStatusCounts): LedgerRow {
  const complete = statusCounts.complete ?? 0
  const gated = complete === 0

  return {
    key: "export",
    label: "Export & share",
    count: complete,
    detail: gated ? "After shoot · not started" : `${plural(complete, "shot")} ready`,
    segments: gated
      ? [emptySegment("Opens once shots are captured")]
      : [
          {
            key: "ready",
            label: "Ready to export",
            value: complete,
            colorVar: STAGE_COLOR.done,
          },
        ],
    enabled: !gated,
  }
}

// ---------------------------------------------------------------------------
// Top-level assembler
// ---------------------------------------------------------------------------

export interface LedgerDataInput {
  readonly statusCounts: ShotStatusCounts
  readonly totalShots?: number
  readonly sceneCount?: number
  readonly castingEntries: ReadonlyArray<CastingBoardEntry>
  readonly pulls: ReadonlyArray<Pull>
  readonly schedules: ReadonlyArray<Schedule>
  readonly scheduleEntries?: ReadonlyArray<ScheduleEntry>
}

/**
 * Build the full ordered ledger (shots → casting → pulls → call sheet → export)
 * from already-fetched data. Pure; safe to call on every render.
 */
export function buildLedgerRows(input: LedgerDataInput): readonly LedgerRow[] {
  return [
    buildShotsRow({
      statusCounts: input.statusCounts,
      totalShots: input.totalShots,
      sceneCount: input.sceneCount,
    }),
    buildCastingRow(input.castingEntries),
    buildPullsRow(input.pulls),
    buildCallSheetRow({ schedules: input.schedules, entries: input.scheduleEntries }),
    buildExportRow(input.statusCounts),
  ]
}
