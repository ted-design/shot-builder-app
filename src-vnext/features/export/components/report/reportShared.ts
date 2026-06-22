// Shared DOM atoms for the report layouts (image-led / production-sheet /
// balanced-rows). One status map + one image resolver so the three layouts
// can't drift in status labeling or image lookup.

import { getShotStatusLabel } from "@/shared/lib/statusMappings"
import type { ReportShot, ReportShotStatus } from "../../lib/report/reportTypes"

export interface StatusMeta {
  readonly dotClass: string
  readonly label: string
}

// Report-specific status DOT classes (reserved green/amber/blue/gray palette).
// Labels come from statusMappings.ts so they match the CLAUDE.md canonical
// (Draft / In Progress / On Hold / Shot) everywhere.
const STATUS_DOT: Record<ReportShotStatus, string> = {
  complete: "sb-status--complete",
  todo: "sb-status--todo",
  in_progress: "sb-status--progress",
  on_hold: "sb-status--hold",
}

export function statusMeta(status: ReportShotStatus): StatusMeta {
  return { dotClass: STATUS_DOT[status] ?? STATUS_DOT.todo, label: getShotStatusLabel(status) }
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
