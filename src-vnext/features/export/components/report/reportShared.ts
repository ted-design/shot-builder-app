// Shared DOM atoms for the report layouts (image-led / production-sheet /
// balanced-rows). One status map + one image resolver so the three layouts
// can't drift in status labeling or image lookup.

import type { ReportShot, ReportShotStatus } from "../../lib/report/reportTypes"

export interface StatusMeta {
  readonly dotClass: string
  readonly label: string
}

export const STATUS_META: Record<ReportShotStatus, StatusMeta> = {
  complete: { dotClass: "sb-status--complete", label: "Shot" },
  todo: { dotClass: "sb-status--todo", label: "To do" },
  in_progress: { dotClass: "sb-status--progress", label: "In progress" },
  on_hold: { dotClass: "sb-status--hold", label: "On hold" },
}

export function statusMeta(status: ReportShotStatus): StatusMeta {
  return STATUS_META[status] ?? STATUS_META.todo
}

/** Resolve an image candidate to a usable src via the sidecar map, else null. */
export function resolveSrc(
  imageMap: ReadonlyMap<string, string>,
  candidate: string | null,
): string | null {
  if (!candidate) return null
  return imageMap.get(candidate) ?? null
}

/** Non-empty string guard for honest "TBD/Pending" rendering. */
export function present(v: string | null | undefined): v is string {
  return v != null && v.trim() !== ""
}

/** On-hold = the one shot status the production sheet flags red ("not cleared to shoot"). */
export function isFlagged(status: ReportShotStatus): boolean {
  return status === "on_hold"
}

/** The shot's primary image candidate. Model sorts looks by order, so looks[0]
 *  is the primary — same definition image-led uses (one canonical primary). */
export function primaryLookImage(shot: ReportShot): string | null {
  return shot.looks[0]?.image ?? null
}
