import type { CrewCallSheet, TalentCallSheet } from "@/shared/types"

export function filterCrewCallsByTrack(
  calls: readonly CrewCallSheet[],
  trackId: string | null,
): readonly CrewCallSheet[] {
  if (trackId === null) return calls
  return calls.filter(c => c.trackId == null || c.trackId === trackId)
}

export function filterTalentCallsByTrack(
  calls: readonly TalentCallSheet[],
  trackId: string | null,
): readonly TalentCallSheet[] {
  if (trackId === null) return calls
  return calls.filter(c => c.trackId == null || c.trackId === trackId)
}
