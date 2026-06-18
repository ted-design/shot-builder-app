// Pure helpers for the Capture One digi-tech filename generator.
// Format: <Gender>_<ProductNamePascal>_<Colorway>  e.g. M_MerinoFlexJogger_Forest

// Filesystem / Capture One reserved characters (the only chars we strip — the
// locked rule is "strip only what Capture One dislikes; keep hyphens").
const ILLEGAL_CHARS = /[/\\:*?"<>|\x00-\x1f]/g

/**
 * spaces→PascalCase, hyphens preserved, illegal chars stripped.
 * "Merino Flex Jogger"→"MerinoFlexJogger" · "Button-Up Shirt"→"Button-UpShirt" · "Tee / Crew"→"TeeCrew"
 */
export function toPascalCaseFilename(name: string | null | undefined): string {
  return (name ?? "")
    .replace(ILLEGAL_CHARS, " ") // illegal → space so it becomes a word boundary
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((seg) => (seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : seg))
        .join("-"),
    )
    .join("")
    .replace(/[.\s]+$/g, "") // trailing dot/space — Windows/exFAT silently mangle these
}

/** Gender prefix from the hero product's own ProductFamily.gender. null = unresolved (caller flags it; never a silent "U"). */
export function resolveHeroGenderPrefix(
  gender: string | null | undefined,
): "M" | "W" | "U" | null {
  const g = (gender ?? "").trim().toLowerCase()
  if (g === "women" || g === "woman" || g === "womens" || g === "female" || g === "w") return "W"
  if (g === "men" || g === "man" || g === "mens" || g === "male" || g === "m") return "M"
  if (g === "unisex" || g === "u") return "U"
  return null
}

/** Join a (resolved) prefix + product name + optional colorway into the filename. Omits an empty colorway. */
export function buildCaptureOneName(
  prefix: string,
  productName: string | null | undefined,
  colorway?: string | null,
): string {
  const parts = [prefix, toPascalCaseFilename(productName)]
  const co = toPascalCaseFilename(colorway)
  if (co) parts.push(co)
  return parts.join("_")
}

export interface HeroFilename {
  readonly name: string
  /** false when the hero product's gender couldn't be resolved — render a warning badge. */
  readonly genderResolved: boolean
}

/**
 * Build one hero filename, resolving the gender prefix from the family. When gender is
 * unresolved it falls back to a "U_" prefix and reports genderResolved=false (for the badge).
 */
export function buildHeroFilename(input: {
  readonly gender: string | null | undefined
  readonly productName: string | null | undefined
  readonly colorway?: string | null
}): HeroFilename {
  const prefix = resolveHeroGenderPrefix(input.gender)
  return {
    name: buildCaptureOneName(prefix ?? "U", input.productName, input.colorway),
    genderResolved: prefix !== null,
  }
}
