import { resolvePdfImageSrc } from "@/features/shots/lib/resolvePdfImageSrc"
import type { ReportModel } from "./reportTypes"

// Walk the resolved model for every image candidate (look display images,
// product images, talent headshots), then batch-resolve to data URLs via the
// shared image pipeline. The resulting map (candidate -> dataUrl) is the sidecar
// both renderers read, so screen and PDF show identical images.

/** Collect every unique image candidate referenced by the model. */
export function collectReportImageCandidates(model: ReportModel): readonly string[] {
  const set = new Set<string>()
  for (const group of model.groups) {
    for (const shot of group.shots) {
      for (const t of shot.talent) if (t.img) set.add(t.img)
      for (const look of shot.looks) {
        if (look.image) set.add(look.image)
        for (const p of look.products) if (p.img) set.add(p.img)
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
