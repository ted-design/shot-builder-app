import { resolvePdfImageSrc } from "@/features/shots/lib/resolvePdfImageSrc"
import type { ReportModel } from "./reportTypes"

// Walk the resolved model for every image candidate (look display images,
// product images, talent headshots), then batch-resolve to data URLs via the
// shared image pipeline. The resulting map (candidate -> dataUrl) is the sidecar
// both renderers read, so screen and PDF show identical images.

/** Options for collectReportImageCandidates. */
export interface CollectImageCandidatesOptions {
  /** Whether to also collect shot.additionalImages (WS-C). The model ALWAYS
   *  derives additionalImages (a cheap, pure computation — see reportModel.ts /
   *  ReportShot.additionalImages), but fetching+transcoding each one is NOT
   *  cheap (resolvePdfImageSrc.ts: a Storage fetch, then for any non-PNG/JPEG —
   *  every app upload is WebP — a createImageBitmap+canvas re-encode). Pass the
   *  SAME effective value ReportView/the PDF export use to decide whether the
   *  row renders (resolveShowAdditionalImages) so a report with the toggle off,
   *  or on image-led (v1-excluded), or on a fully-disabled featureReportConfig
   *  rollback never pays that cost for a row that can never be seen. Default
   *  true only so pre-existing hand-built-model callers/tests keep compiling —
   *  every REAL caller (ShotReportPage) passes an explicit value. */
  readonly includeAdditionalImages?: boolean
}

/** Collect every unique image candidate referenced by the model. `look.image`
 *  already carries the hero-first cover value for the primary look (see
 *  reportModel.ts's resolveLooks), so no separate hero-candidate walk is
 *  needed here. `shot.additionalImages` (WS-C) is gated by
 *  `includeAdditionalImages` (see CollectImageCandidatesOptions) — the model
 *  itself has no flag-shaped hole (deriveShotReportModel always populates it),
 *  but the CALLER decides whether it's worth fetching.
 *
 *  An EXCLUDED shot's additionalImages are never collected regardless of the
 *  toggle: every recipe filters excluded shots out before render (see
 *  reportPdfProductionSheet.tsx / reportPdfBalancedRows.tsx / reportPdfHeights.ts's
 *  `printable`), so that row can never be seen for that shot either way. (The
 *  shot's own cover/product/talent candidates are NOT skipped here — the
 *  on-screen fluid view still shows an excluded shot's cover thumbnail,
 *  struck-through, so skipping those would visibly break that.) */
export function collectReportImageCandidates(
  model: ReportModel,
  { includeAdditionalImages = true }: CollectImageCandidatesOptions = {},
): readonly string[] {
  const set = new Set<string>()
  for (const group of model.groups) {
    for (const shot of group.shots) {
      for (const t of shot.talent) if (t.img) set.add(t.img)
      for (const look of shot.looks) {
        if (look.image) set.add(look.image)
        for (const p of look.products) if (p.img) set.add(p.img)
      }
      if (includeAdditionalImages && !shot.excluded) {
        for (const img of shot.additionalImages ?? []) set.add(img)
      }
    }
  }
  return [...set]
}

/** Batch-resolve image candidates to data URLs (concurrency-limited). */
export async function resolveReportImages(
  candidates: readonly string[],
): Promise<Map<string, string>> {
  if (candidates.length === 0) return new Map()
  const entries: Array<[string, string]> = []
  const CONCURRENCY = 4
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (c) => [c, await resolvePdfImageSrc(c)] as const),
    )
    for (const r of results) {
      if (r.status === "fulfilled" && r.value[1]) entries.push([r.value[0], r.value[1]])
    }
  }
  return new Map(entries)
}
