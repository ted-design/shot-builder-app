import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import type { ProductAssignment, Shot } from "@/shared/types"

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function formatProductAssignmentLabel(p: ProductAssignment): string {
  const baseName =
    asNonEmptyString(p.familyName) ??
    asNonEmptyString(p.skuName) ??
    asNonEmptyString(p.familyId) ??
    "Product"

  const detailParts: string[] = []
  const colour = asNonEmptyString(p.colourName)
  if (colour) detailParts.push(colour)

  if (p.sizeScope === "all") detailParts.push("All sizes")
  else if (p.sizeScope === "pending" || !p.sizeScope) detailParts.push("Size TBD")
  else if (p.sizeScope === "single") {
    const size = asNonEmptyString(p.size)
    if (size) detailParts.push(size)
  }

  const quantity = typeof p.quantity === "number" ? p.quantity : null
  if (quantity && quantity > 1) detailParts.push(`x${quantity}`)

  if (detailParts.length === 0) return baseName
  return `${baseName} (${detailParts.join(" • ")})`
}

function primaryLookProducts(shot: Shot): readonly ProductAssignment[] | null {
  const looks = shot.looks ?? []
  if (looks.length === 0) return null
  let primary = looks[0]!
  for (const l of looks) {
    const currentOrder = typeof primary.order === "number" ? primary.order : 0
    const nextOrder = typeof l.order === "number" ? l.order : 0
    if (nextOrder < currentOrder) primary = l
  }
  return primary.products ?? []
}

/**
 * Return product labels for the Primary look when looks exist.
 * Falls back to merged legacy-supported assignments when looks are absent.
 */
export function getShotPrimaryLookProductLabels(shot: Shot): string[] {
  const primaryProducts = primaryLookProducts(shot)
  const products = primaryProducts ?? extractShotAssignedProducts(shot)
  return products.map(formatProductAssignmentLabel)
}

export function summarizeLabels(
  labels: readonly string[],
  maxItems: number,
): { readonly preview: string; readonly overflow: number; readonly title: string } {
  const cleaned = labels
    .map((l) => l.trim())
    .filter(Boolean)

  const shown = cleaned.slice(0, Math.max(0, maxItems))
  const overflow = Math.max(0, cleaned.length - shown.length)
  const preview =
    overflow > 0 ? `${shown.join(", ")} +${overflow}` : shown.join(", ")

  return {
    preview,
    overflow,
    title: cleaned.join("\n"),
  }
}

export function resolveIdsToNames(
  ids: readonly string[],
  nameById?: ReadonlyMap<string, string> | null,
): { readonly names: string[]; readonly unknownCount: number } {
  const names: string[] = []
  let unknownCount = 0

  for (const id of ids) {
    const cleaned = asNonEmptyString(id)
    if (!cleaned) continue
    const name = nameById?.get(cleaned) ?? null
    if (name) names.push(name)
    else unknownCount += 1
  }

  return { names, unknownCount }
}
