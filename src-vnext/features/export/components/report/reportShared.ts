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
const STATUS_DOT: Record<ReportShotStatus, string> = {
  complete: "sb-status--complete",
  todo: "sb-status--todo",
  in_progress: "sb-status--progress",
  on_hold: "sb-status--hold",
}

/** Canonical labels (statusMappings.ts) — used by all three report recipes
 *  (image-led, production-sheet, balanced-rows). No per-recipe label exception. */
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
 *  is the primary — same definition image-led uses (one canonical primary).
 *  Already hero-first (see reportModel.ts's resolveLooks) — this reader needs
 *  no changes of its own for the WS-C cover semantics to apply here. */
export function primaryLookImage(shot: ReportShot): string | null {
  return shot.looks[0]?.image ?? null
}

/** Resolve a shot's additional-images candidates (WS-C) to usable srcs via the
 *  sidecar map. A candidate with no resolved src (a failed per-image fetch) is
 *  simply dropped, not rendered as an empty/broken frame — unlike the single
 *  cover thumbnail there is no fixed slot to fill for an optional extra. */
export function resolveAdditionalImageSrcs(
  imageMap: ReadonlyMap<string, string>,
  candidates: readonly string[] | undefined,
): readonly string[] {
  if (!candidates || candidates.length === 0) return []
  const out: string[] = []
  for (const c of candidates) {
    const src = imageMap.get(c)
    if (src) out.push(src)
  }
  return out
}
