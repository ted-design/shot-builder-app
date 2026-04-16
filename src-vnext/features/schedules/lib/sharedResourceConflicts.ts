import type { TalentCallSheet, TalentRecord } from "@/shared/types"

export interface SharedResourceConflict {
  readonly resourceType: "talent"
  readonly resourceId: string
  readonly resourceName: string
  readonly trackIds: readonly string[]
}

export function detectSharedResourceConflicts(
  talentCalls: readonly TalentCallSheet[],
  talentLookup: readonly TalentRecord[],
): readonly SharedResourceConflict[] {
  // Build talent name map
  const nameMap = new Map<string, string>()
  for (const t of talentLookup) {
    nameMap.set(t.id, t.name)
  }

  // Group scoped calls by talentId -> Set of trackIds
  const tracksByTalent = new Map<string, Set<string>>()
  for (const call of talentCalls) {
    if (call.trackId == null) continue // unscoped -> skip
    const existing = tracksByTalent.get(call.talentId)
    if (existing) {
      existing.add(call.trackId)
    } else {
      tracksByTalent.set(call.talentId, new Set([call.trackId]))
    }
  }

  const conflicts: SharedResourceConflict[] = []
  for (const [talentId, trackIdSet] of tracksByTalent) {
    if (trackIdSet.size < 2) continue
    conflicts.push({
      resourceType: "talent",
      resourceId: talentId,
      resourceName: nameMap.get(talentId) ?? talentId,
      trackIds: [...trackIdSet].sort(),
    })
  }

  return conflicts
}
