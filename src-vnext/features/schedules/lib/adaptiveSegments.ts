import { formatMinutesTo12h } from "@/features/schedules/lib/time"
import type {
  ProjectedScheduleRow,
  ScheduleProjection,
} from "@/features/schedules/lib/projection"
import type { ScheduleTrack } from "@/shared/types"

// ─── Types ────────────────────────────────────────────────────────────

export interface BannerSegment {
  readonly kind: "banner"
  readonly key: string
  readonly row: ProjectedScheduleRow
  readonly startMin: number
  readonly durationMinutes: number
  readonly title: string
}

export interface GapSegment {
  readonly kind: "gap"
  readonly key: string
  readonly startMin: number
  readonly endMin: number
  readonly label: string
}

export interface DenseBlock {
  readonly kind: "dense"
  readonly key: string
  readonly startMin: number
  readonly endMin: number
  readonly pxPerMin: number
  readonly rowsByTrack: ReadonlyMap<string, readonly ProjectedScheduleRow[]>
}

export type TimelineSegment = BannerSegment | GapSegment | DenseBlock

export interface AdaptiveTimelineLayout {
  readonly segments: readonly TimelineSegment[]
  readonly tracks: readonly ScheduleTrack[]
  readonly unscheduledRows: readonly ProjectedScheduleRow[]
}

// ─── Constants ────────────────────────────────────────────────────────

const DENSE_PX_PER_MIN = 8
const MODERATE_PX_PER_MIN = 6
const SPARSE_PX_PER_MIN = 4
const MIN_BLOCK_HEIGHT_PX = 120
const GAP_MERGE_TOLERANCE_MIN = 5

// ─── Helpers ──────────────────────────────────────────────────────────

interface TimeInterval {
  readonly startMin: number
  readonly endMin: number
}

function mergeIntervals(
  intervals: readonly TimeInterval[],
  tolerance: number,
): readonly TimeInterval[] {
  if (intervals.length === 0) return []

  const sorted = intervals.slice().sort((a, b) => a.startMin - b.startMin)
  const merged: TimeInterval[] = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!
    const last = merged[merged.length - 1]!
    if (current.startMin <= last.endMin + tolerance) {
      merged[merged.length - 1] = {
        startMin: last.startMin,
        endMin: Math.max(last.endMin, current.endMin),
      }
    } else {
      merged.push(current)
    }
  }

  return merged
}

function computePxPerMin(totalEvents: number, durationMinutes: number): number {
  if (durationMinutes <= 0) return DENSE_PX_PER_MIN

  const eventsPerMin = totalEvents / durationMinutes

  let rate: number
  if (eventsPerMin >= 0.1) {
    rate = DENSE_PX_PER_MIN
  } else if (eventsPerMin >= 0.04) {
    rate = MODERATE_PX_PER_MIN
  } else {
    rate = SPARSE_PX_PER_MIN
  }

  const naturalHeight = durationMinutes * rate
  if (naturalHeight < MIN_BLOCK_HEIGHT_PX) {
    return Math.ceil(MIN_BLOCK_HEIGHT_PX / durationMinutes)
  }

  return rate
}

function formatGapLabel(durationMinutes: number): string {
  if (durationMinutes < 60) {
    return `${durationMinutes} min gap`
  }
  const hours = Math.floor(durationMinutes / 60)
  const mins = durationMinutes % 60
  if (mins === 0) {
    return `${hours}h gap`
  }
  return `${hours}h ${mins}m gap`
}

// ─── Main Algorithm ───────────────────────────────────────────────────

export function buildAdaptiveLayout(
  projection: ScheduleProjection,
): AdaptiveTimelineLayout {
  const { rows, tracks } = projection

  // Step 1: Split into timed/untimed and banners/regular
  const unscheduledRows: ProjectedScheduleRow[] = []
  const bannerRows: ProjectedScheduleRow[] = []
  const timedRows: ProjectedScheduleRow[] = []

  for (const row of rows) {
    if (row.startMin == null) {
      unscheduledRows.push(row)
      continue
    }
    if (row.isBanner) {
      bannerRows.push(row)
      continue
    }
    timedRows.push(row)
  }

  // If no timed rows and no banners, return empty layout
  if (timedRows.length === 0 && bannerRows.length === 0) {
    return { segments: [], tracks, unscheduledRows }
  }

  // Step 2: Collect intervals from timed rows
  const intervals: TimeInterval[] = timedRows
    .filter((r): r is ProjectedScheduleRow & { startMin: number } => r.startMin != null)
    .map((r) => ({
      startMin: r.startMin,
      endMin: r.endMin ?? r.startMin + (r.durationMinutes ?? 15),
    }))

  // Step 3: Merge overlapping intervals with tolerance
  const activeWindows = mergeIntervals(intervals, GAP_MERGE_TOLERANCE_MIN)

  // Step 4: Build dense blocks from active windows
  const denseBlocks: Array<{
    readonly startMin: number
    readonly endMin: number
    readonly eventCount: number
    readonly rowsByTrack: Map<string, ProjectedScheduleRow[]>
  }> = activeWindows.map((window) => {
    const blockRows = timedRows.filter((r) => {
      if (r.startMin == null) return false
      return r.startMin >= window.startMin && r.startMin < window.endMin
    })

    const rowsByTrack = new Map<string, ProjectedScheduleRow[]>()
    for (const track of tracks) {
      rowsByTrack.set(track.id, [])
    }
    for (const row of blockRows) {
      const trackRows = rowsByTrack.get(row.trackId)
      if (trackRows) {
        trackRows.push(row)
      } else {
        // Row belongs to an unknown track — assign to first track
        const firstTrack = tracks[0]
        if (firstTrack) {
          rowsByTrack.get(firstTrack.id)?.push(row)
        }
      }
    }

    return {
      startMin: window.startMin,
      endMin: window.endMin,
      eventCount: blockRows.length,
      rowsByTrack,
    }
  })

  // Step 5: Build timeline segments
  const segments: TimelineSegment[] = []

  // Collect all time-anchored items (banners + dense blocks) and sort by startMin
  type TimeAnchor =
    | { readonly kind: "banner"; readonly row: ProjectedScheduleRow; readonly startMin: number }
    | { readonly kind: "dense"; readonly blockIndex: number; readonly startMin: number; readonly endMin: number }

  const anchors: TimeAnchor[] = []

  for (const row of bannerRows) {
    if (row.startMin != null) {
      anchors.push({ kind: "banner", row, startMin: row.startMin })
    }
  }

  for (let i = 0; i < denseBlocks.length; i++) {
    const block = denseBlocks[i]!
    anchors.push({
      kind: "dense",
      blockIndex: i,
      startMin: block.startMin,
      endMin: block.endMin,
    })
  }

  anchors.sort((a, b) => a.startMin - b.startMin)

  // Build segments by iterating anchors and inserting gaps between them
  let cursor: number | null = null

  for (const anchor of anchors) {
    // Insert gap if there's a time gap between cursor and this anchor
    if (cursor != null && anchor.startMin > cursor) {
      const gapDuration = anchor.startMin - cursor
      segments.push({
        kind: "gap",
        key: `gap-${cursor}-${anchor.startMin}`,
        startMin: cursor,
        endMin: anchor.startMin,
        label: formatGapLabel(gapDuration),
      })
    }

    if (anchor.kind === "banner") {
      const row = anchor.row
      const duration = row.durationMinutes ?? 0
      segments.push({
        kind: "banner",
        key: `banner-${row.id}`,
        row,
        startMin: row.startMin!,
        durationMinutes: duration,
        title: row.entry.title,
      })
      const bannerEnd = row.startMin! + duration
      cursor = cursor == null ? bannerEnd : Math.max(cursor, bannerEnd)
    } else {
      const block = denseBlocks[anchor.blockIndex]!
      const pxPerMin = computePxPerMin(block.eventCount, block.endMin - block.startMin)
      segments.push({
        kind: "dense",
        key: `dense-${block.startMin}-${block.endMin}`,
        startMin: block.startMin,
        endMin: block.endMin,
        pxPerMin,
        rowsByTrack: block.rowsByTrack,
      })
      cursor = cursor == null ? block.endMin : Math.max(cursor, block.endMin)
    }
  }

  return { segments, tracks, unscheduledRows }
}

// ─── Card Height Utilities ────────────────────────────────────────────

export interface VisibleFields {
  readonly showDescription: boolean
  readonly showProducts: boolean
  readonly showTalent: boolean
  readonly showLocation: boolean
  readonly showNotes: boolean
  readonly showTags: boolean
}

const BASE_CARD_HEIGHT = 54  // header (20) + title (18) + padding (16)
const META_ROW_HEIGHT = 18

export function computeMinCardHeight(fields: VisibleFields): number {
  let additionalRows = 0
  if (fields.showDescription) additionalRows++
  if (fields.showProducts) additionalRows++
  if (fields.showTalent) additionalRows++
  if (fields.showLocation) additionalRows++
  if (fields.showNotes) additionalRows++
  if (fields.showTags) additionalRows++

  // Always show at least header + title + up to 2 meta rows
  const visibleRows = Math.min(additionalRows, 2)
  return BASE_CARD_HEIGHT + visibleRows * META_ROW_HEIGHT
}

export function computeCardHeight(
  durationMinutes: number,
  pxPerMin: number,
  fields: VisibleFields,
): number {
  const natural = durationMinutes * pxPerMin
  const min = computeMinCardHeight(fields)
  return Math.max(natural, min)
}

// ─── Format Helpers ───────────────────────────────────────────────────

export function formatTimeShort(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h < 12 ? "a" : "p"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`
}

export { formatMinutesTo12h }
