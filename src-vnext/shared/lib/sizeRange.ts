/** Known apparel size order for contiguous range detection. */
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"] as const

const SIZE_INDEX = new Map(SIZE_ORDER.map((s, i) => [s, i]))

/**
 * Compress an array of size strings into a human-readable range.
 *
 * Examples:
 *   ["S", "M", "L", "XL"]                    → "S - XL"
 *   ["S/30", "S/32", "M/30", "M/32"]         → 'S - M / 30", 32"'
 *   ["28", "30", "32", "34"]                  → "28 - 34"
 *   ["One Size"]                              → "One Size"
 *   []                                        → null
 */
export function compressSizeRange(sizes: ReadonlyArray<string>): string | null {
  if (sizes.length === 0) return null
  if (sizes.length === 1) return sizes[0]

  // Detect inseam composite sizes (contain "/" with a known base size or numeric base AND a numeric inseam)
  const hasInseamComposite = sizes.some((s) => {
    if (!s.includes("/")) return false
    const [base, inseam] = s.split("/")
    const baseIsKnown = SIZE_INDEX.has(base) || Number.isFinite(parseFloat(base))
    return baseIsKnown && Number.isFinite(parseFloat(inseam))
  })

  if (hasInseamComposite) {
    return compressCompositeSizes(sizes)
  }

  return compressSimpleSizes([...sizes])
}

function compressCompositeSizes(sizes: ReadonlyArray<string>): string {
  const bases = new Set<string>()
  const inseams = new Set<string>()

  for (const s of sizes) {
    const slashIdx = s.indexOf("/")
    if (slashIdx === -1) {
      bases.add(s)
      continue
    }
    bases.add(s.slice(0, slashIdx))
    inseams.add(s.slice(slashIdx + 1))
  }

  const baseArr = [...bases]
  const allBasesNumeric = baseArr.every((b) => Number.isFinite(parseFloat(b)))
  const baseRange = allBasesNumeric
    ? compressNumericRange(baseArr)
    : compressOrderedRange(baseArr)
  if (inseams.size === 0) return baseRange

  const sortedInseams = [...inseams].sort((a, b) => {
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return a.localeCompare(b)
  })

  const inseamPart = sortedInseams.map((i) => `${i}"`).join(", ")
  return `${baseRange} / ${inseamPart}`
}

function compressSimpleSizes(sizes: string[]): string {
  // Check if all are known apparel sizes
  const allKnown = sizes.every((s) => SIZE_INDEX.has(s))
  if (allKnown) {
    return compressOrderedRange(sizes)
  }

  // Check if all numeric
  const allNumeric = sizes.every((s) => Number.isFinite(parseFloat(s)))
  if (allNumeric) {
    const sorted = [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b))
    return sorted.length >= 2 ? `${sorted[0]} - ${sorted[sorted.length - 1]}` : sorted[0]
  }

  // Fallback: comma-join with truncation
  if (sizes.length > 5) {
    return `${sizes.slice(0, 5).join(", ")} +${sizes.length - 5}`
  }
  return sizes.join(", ")
}

function compressNumericRange(sizes: string[]): string {
  const sorted = [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b))
  return sorted.length >= 2 ? `${sorted[0]} - ${sorted[sorted.length - 1]}` : sorted[0]
}

function compressOrderedRange(sizes: string[]): string {
  const sorted = [...sizes].sort((a, b) => {
    const ai = SIZE_INDEX.get(a) ?? Infinity
    const bi = SIZE_INDEX.get(b) ?? Infinity
    return ai - bi
  })

  if (sorted.length < 2) return sorted[0] ?? ""

  // Check contiguity: every adjacent pair must be consecutive in SIZE_ORDER
  const indices = sorted.map((s) => SIZE_INDEX.get(s)).filter((i): i is number => i !== undefined)
  const isContiguous = indices.length === sorted.length &&
    indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1)

  if (isContiguous) {
    return `${sorted[0]} - ${sorted[sorted.length - 1]}`
  }

  // Non-contiguous: comma-join
  if (sorted.length > 5) {
    return `${sorted.slice(0, 5).join(", ")} +${sorted.length - 5}`
  }
  return sorted.join(", ")
}
