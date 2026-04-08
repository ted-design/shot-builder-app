import type { CastingBoardStatus, CastingVoteDecision } from "@/shared/types"

interface StatusMapping {
  readonly label: string
  readonly colorClass: string
}

export const CASTING_STATUS_MAP: Readonly<
  Record<CastingBoardStatus, StatusMapping>
> = {
  shortlist: { label: "Shortlist", colorClass: "status-gray" },
  hold: { label: "Hold", colorClass: "status-amber" },
  booked: { label: "Booked", colorClass: "status-blue" },
  passed: { label: "Passed", colorClass: "status-red" },
}

export const CASTING_VOTE_LABELS: Readonly<
  Record<CastingVoteDecision, string>
> = {
  approve: "Approve",
  disapprove: "Pass",
  maybe: "Maybe",
  withdrawn: "Withdrawn",
}

export function getCastingStatusLabel(status: CastingBoardStatus): string {
  return CASTING_STATUS_MAP[status]?.label ?? status
}

export function getCastingStatusColor(status: CastingBoardStatus): string {
  return CASTING_STATUS_MAP[status]?.colorClass ?? "status-gray"
}
