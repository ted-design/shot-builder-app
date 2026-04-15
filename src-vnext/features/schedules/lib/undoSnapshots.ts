import type {
  CrewCallSheet,
  LocationBlock,
  ScheduleEntry,
  ScheduleTrack,
  TalentCallSheet,
} from "@/shared/types"

/**
 * Discriminated union of undo snapshots captured across the call sheet
 * builder's destructive surfaces. Each variant carries enough state to
 * fully re-create the removed entity via the existing scheduleWrites
 * helpers (no in-app state mirroring).
 *
 * New variants go here so every consumer gets a type error on unhandled
 * cases — the `exhaustive` switch test in undoSnapshots.test.ts enforces
 * coverage.
 */
export type UndoSnapshot =
  | { readonly kind: "crewCallRemoved"; readonly payload: CrewCallSheet }
  | { readonly kind: "talentCallRemoved"; readonly payload: TalentCallSheet }
  | {
      readonly kind: "locationRemoved"
      readonly payload: { readonly index: number; readonly block: LocationBlock }
    }
  | {
      readonly kind: "tracksCollapsed"
      readonly payload: {
        readonly tracks: ReadonlyArray<ScheduleTrack>
        readonly entryTrackIds: ReadonlyArray<{
          readonly entryId: string
          readonly trackId: string | null
        }>
      }
    }
  | { readonly kind: "scheduleEntryRemoved"; readonly payload: ScheduleEntry }

export interface LocationRemoveCapture {
  readonly snapshot: { readonly index: number; readonly block: LocationBlock }
  readonly next: ReadonlyArray<LocationBlock>
}

/**
 * Capture a `locationRemoved` snapshot for an immutable location array.
 *
 * Returns `null` when no location with `locationId` exists — lets the
 * caller short-circuit without performing the write.
 */
export function takeLocationRemoveSnapshot(
  locations: ReadonlyArray<LocationBlock>,
  locationId: string,
): LocationRemoveCapture | null {
  const index = locations.findIndex((loc) => loc.id === locationId)
  if (index < 0) return null
  const block = locations[index]
  if (!block) return null
  const next: LocationBlock[] = [
    ...locations.slice(0, index),
    ...locations.slice(index + 1),
  ]
  return {
    snapshot: { index, block },
    next,
  }
}

/**
 * Re-insert a previously captured location block at (approximately)
 * its original index. If the array shrank below the captured index
 * between delete and undo, the block is appended. Negative indices
 * clamp to 0.
 */
export function reinsertLocationAtIndex(
  locations: ReadonlyArray<LocationBlock>,
  snapshot: { readonly index: number; readonly block: LocationBlock },
): ReadonlyArray<LocationBlock> {
  const safeIndex = Math.min(Math.max(snapshot.index, 0), locations.length)
  return [
    ...locations.slice(0, safeIndex),
    snapshot.block,
    ...locations.slice(safeIndex),
  ]
}

/**
 * Capture a `tracksCollapsed` snapshot from the current schedule/entries.
 *
 * Tracks are shallow-cloned so later mutation of the source does not
 * leak into the snapshot. Each entry contributes one entryId→trackId
 * pair (null for entries without an assigned track).
 */
export function takeCollapseSnapshot(
  tracks: ReadonlyArray<ScheduleTrack>,
  entries: ReadonlyArray<ScheduleEntry>,
): {
  readonly tracks: ReadonlyArray<ScheduleTrack>
  readonly entryTrackIds: ReadonlyArray<{
    readonly entryId: string
    readonly trackId: string | null
  }>
} {
  return {
    tracks: tracks.map((t) => ({ ...t })),
    entryTrackIds: entries.map((e) => ({
      entryId: e.id,
      trackId: e.trackId ?? null,
    })),
  }
}
