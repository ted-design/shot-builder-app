import { resolvePdfImageSrc } from "@/features/shots/lib/resolvePdfImageSrc"
import type { ExportBlock } from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"

/**
 * Collect all image URLs from blocks and project data,
 * then batch-resolve them to data URLs for PDF embedding.
 */
export async function resolveExportImages(
  blocks: readonly ExportBlock[],
  data: ExportData,
): Promise<Map<string, string>> {
  const urls = new Set<string>()

  // Collect from image blocks
  for (const block of blocks) {
    if (block.type === "image" && block.src) {
      urls.add(block.src)
    }
  }

  // Collect hero images for shot-detail and shot-grid blocks
  const hasShotGrid = blocks.some((b) => b.type === "shot-grid")
  if (hasShotGrid) {
    // Shot-grid may render thumbnails — pre-resolve all shot hero images
    for (const shot of data.shots) {
      if (shot.heroImage?.path) urls.add(shot.heroImage.path)
    }
  }
  for (const block of blocks) {
    if (block.type === "shot-detail") {
      const shot = block.shotId
        ? data.shots.find((s) => s.id === block.shotId)
        : null
      if (shot?.heroImage?.path) urls.add(shot.heroImage.path)
    }
  }

  if (urls.size === 0) return new Map()

  // Resolve in parallel with concurrency limit of 4
  const entries: Array<[string, string]> = []
  const urlArray = Array.from(urls)
  const CONCURRENCY = 4

  for (let i = 0; i < urlArray.length; i += CONCURRENCY) {
    const batch = urlArray.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const resolved = await resolvePdfImageSrc(url)
        return [url, resolved] as const
      }),
    )
    for (const result of results) {
      if (result.status === "fulfilled" && result.value[1]) {
        entries.push([result.value[0], result.value[1]])
      }
    }
  }

  return new Map(entries)
}
