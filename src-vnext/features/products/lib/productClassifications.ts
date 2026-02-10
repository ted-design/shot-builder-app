import type { ProductClassification, ProductFamily } from "@/shared/types"

export interface ProductClassificationOption {
  readonly key: string
  readonly label: string
}

export interface ProductClassificationScaffold {
  readonly genders: ReadonlyArray<ProductClassificationOption>
  readonly typesByGender: Record<string, ReadonlyArray<ProductClassificationOption>>
  readonly subcategoriesByGenderAndType: Record<string, Record<string, ReadonlyArray<ProductClassificationOption>>>
}

const KNOWN_GENDER_LABELS: Record<string, string> = {
  men: "Men",
  women: "Women",
  unisex: "Unisex",
  other: "Other",
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
}

export function normalizeClassificationKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function normalizeClassificationGender(value: string | null | undefined): string | null {
  const normalized = normalizeClassificationKey(value)
  if (!normalized) return null
  if (normalized === "mens" || normalized === "men's") return "men"
  if (normalized === "womens" || normalized === "women's") return "women"
  return normalized
}

export function humanizeClassificationKey(key: string | null | undefined): string {
  if (!key) return ""
  return key
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function slugifyClassificationKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildProductClassificationId(args: {
  readonly gender: string
  readonly typeKey: string
  readonly subcategoryKey?: string | null
}): string {
  const gender = normalizeClassificationGender(args.gender)
  const typeKey = normalizeClassificationKey(args.typeKey)
  const subcategoryKey = normalizeClassificationKey(args.subcategoryKey ?? null)
  if (!gender) throw new Error("Gender is required.")
  if (!typeKey) throw new Error("Type is required.")
  return subcategoryKey
    ? `${gender}__${typeKey}__${subcategoryKey}`
    : `${gender}__${typeKey}`
}

function ensureOption(
  map: Map<string, string>,
  key: string | null,
  label: string | null,
  overwrite = false,
) {
  if (!key) return
  if (!overwrite && map.has(key)) return
  const nextLabel = label && label.trim().length > 0 ? label.trim() : humanizeClassificationKey(key)
  map.set(key, nextLabel)
}

export function deriveProductClassificationScaffold(args: {
  readonly classifications: ReadonlyArray<ProductClassification>
  readonly families: ReadonlyArray<ProductFamily>
}): ProductClassificationScaffold {
  const { classifications, families } = args

  const genderLabels = new Map<string, string>()
  const typeLabelsByGender = new Map<string, Map<string, string>>()
  const subLabelsByGenderType = new Map<string, Map<string, Map<string, string>>>()

  const ensureGender = (genderKey: string, label: string | null, overwrite = false) => {
    ensureOption(
      genderLabels,
      genderKey,
      label ?? KNOWN_GENDER_LABELS[genderKey] ?? humanizeClassificationKey(genderKey),
      overwrite,
    )
  }

  const ensureType = (
    genderKey: string,
    typeKey: string,
    label: string | null,
    overwrite = false,
  ) => {
    const forGender = typeLabelsByGender.get(genderKey) ?? new Map<string, string>()
    ensureOption(forGender, typeKey, label, overwrite)
    typeLabelsByGender.set(genderKey, forGender)
  }

  const ensureSubcategory = (
    genderKey: string,
    typeKey: string,
    subKey: string,
    label: string | null,
    overwrite = false,
  ) => {
    const byType = subLabelsByGenderType.get(genderKey) ?? new Map<string, Map<string, string>>()
    const subOptions = byType.get(typeKey) ?? new Map<string, string>()
    ensureOption(subOptions, subKey, label, overwrite)
    byType.set(typeKey, subOptions)
    subLabelsByGenderType.set(genderKey, byType)
  }

  for (const family of families) {
    const genderKey = normalizeClassificationGender(family.gender ?? null)
    const typeKey = normalizeClassificationKey(family.productType ?? null)
    const subKey = normalizeClassificationKey(family.productSubcategory ?? family.category ?? null)
    if (!genderKey) continue
    ensureGender(genderKey, KNOWN_GENDER_LABELS[genderKey] ?? null)
    if (!typeKey) continue
    ensureType(genderKey, typeKey, null)
    if (subKey) ensureSubcategory(genderKey, typeKey, subKey, null)
  }

  for (const entry of classifications) {
    if (entry.archived === true) continue
    const genderKey = normalizeClassificationGender(entry.gender)
    const typeKey = normalizeClassificationKey(entry.typeKey)
    const subKey = normalizeClassificationKey(entry.subcategoryKey ?? null)
    if (!genderKey || !typeKey) continue

    ensureGender(genderKey, KNOWN_GENDER_LABELS[genderKey] ?? null, true)
    ensureType(genderKey, typeKey, entry.typeLabel ?? null, true)
    if (subKey) {
      ensureSubcategory(genderKey, typeKey, subKey, entry.subcategoryLabel ?? null, true)
    }
  }

  const genders = Array.from(genderLabels.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => {
      const rank: Record<string, number> = { men: 0, women: 1, unisex: 2, other: 3 }
      const left = rank[a.key] ?? 99
      const right = rank[b.key] ?? 99
      if (left !== right) return left - right
      return compareText(a.label, b.label)
    })

  const typesByGender: Record<string, ReadonlyArray<ProductClassificationOption>> = {}
  for (const [genderKey, types] of typeLabelsByGender.entries()) {
    typesByGender[genderKey] = Array.from(types.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => compareText(a.label, b.label))
  }

  const subcategoriesByGenderAndType: Record<string, Record<string, ReadonlyArray<ProductClassificationOption>>> = {}
  for (const [genderKey, byType] of subLabelsByGenderType.entries()) {
    const out: Record<string, ReadonlyArray<ProductClassificationOption>> = {}
    for (const [typeKey, subs] of byType.entries()) {
      out[typeKey] = Array.from(subs.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => compareText(a.label, b.label))
    }
    subcategoriesByGenderAndType[genderKey] = out
  }

  return { genders, typesByGender, subcategoriesByGenderAndType }
}

export function mapProductClassificationDoc(
  id: string,
  data: Record<string, unknown>,
): ProductClassification {
  return {
    id,
    gender: typeof data["gender"] === "string" ? data["gender"] : "",
    typeKey: typeof data["typeKey"] === "string" ? data["typeKey"] : "",
    typeLabel: typeof data["typeLabel"] === "string" ? data["typeLabel"] : "",
    subcategoryKey: typeof data["subcategoryKey"] === "string" ? data["subcategoryKey"] : null,
    subcategoryLabel: typeof data["subcategoryLabel"] === "string" ? data["subcategoryLabel"] : null,
    archived: data["archived"] === true,
    createdAt: data["createdAt"] as ProductClassification["createdAt"],
    updatedAt: data["updatedAt"] as ProductClassification["updatedAt"],
    createdBy: typeof data["createdBy"] === "string" ? data["createdBy"] : null,
    updatedBy: typeof data["updatedBy"] === "string" ? data["updatedBy"] : null,
  }
}
