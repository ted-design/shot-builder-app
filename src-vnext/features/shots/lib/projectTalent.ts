import type { Shot } from "@/shared/types"

/**
 * Talent ids that count as "project talent" for the shot-list talent filter:
 * anyone on one of the project's shots (read the way filterEngine matches the
 * talent filter) plus anyone linked to the project via talent.projectIds.
 * Shots are included because talent can be put on shots without the
 * projectIds backlink being written.
 */
export function collectProjectTalentIds(
  shots: readonly Pick<Shot, "talent" | "talentIds">[],
  talentRecords: readonly { id: string; projectIds?: readonly string[] }[],
  projectId: string,
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const shot of shots) {
    for (const t of shot.talentIds ?? shot.talent) {
      if (typeof t === "string" && t.trim().length > 0) ids.add(t)
    }
  }
  for (const t of talentRecords) {
    if (t.projectIds?.includes(projectId)) ids.add(t.id)
  }
  return ids
}
