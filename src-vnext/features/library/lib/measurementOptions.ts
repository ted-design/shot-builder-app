export interface MeasurementField {
  readonly key: string
  readonly label: string
}

export type GenderKey = "men" | "women" | "other"

export const MEASUREMENT_GROUPS: Record<"men" | "women", readonly MeasurementField[]> = {
  men: [
    { key: "height", label: "Height" },
    { key: "waist", label: "Waist" },
    { key: "inseam", label: "Inseam" },
    { key: "shoes", label: "Shoes" },
    { key: "suit", label: "Suit" },
    { key: "collar", label: "Collar" },
    { key: "sleeve", label: "Sleeve" },
  ],
  women: [
    { key: "height", label: "Height" },
    { key: "waist", label: "Waist" },
    { key: "hips", label: "Hips" },
    { key: "shoes", label: "Shoes" },
    { key: "bust", label: "Bust" },
    { key: "dress", label: "Dress" },
  ],
}

const uniqueLabels = new Map<string, string>()
for (const group of Object.values(MEASUREMENT_GROUPS)) {
  for (const entry of group) {
    if (!uniqueLabels.has(entry.key)) {
      uniqueLabels.set(entry.key, entry.label)
    }
  }
}

export const ALL_MEASUREMENT_OPTIONS: readonly MeasurementField[] = Array.from(
  uniqueLabels.entries(),
).map(([key, label]) => ({ key, label }))

export const MEASUREMENT_LABEL_MAP: Readonly<Record<string, string>> =
  Object.fromEntries(ALL_MEASUREMENT_OPTIONS.map((e) => [e.key, e.label]))

export function normalizeGender(gender: string | null | undefined): GenderKey {
  const value = (gender ?? "").toLowerCase()
  if (value.startsWith("men")) return "men"
  if (value.startsWith("women")) return "women"
  return "other"
}

export function getMeasurementOptionsForGender(
  gender: string | null | undefined,
): readonly MeasurementField[] {
  const key = normalizeGender(gender)
  if (key === "men") return MEASUREMENT_GROUPS.men
  if (key === "women") return MEASUREMENT_GROUPS.women
  return ALL_MEASUREMENT_OPTIONS
}

export function orderMeasurementKeys(
  measurements: Record<string, unknown> | null | undefined,
  gender: string | null | undefined,
): readonly string[] {
  const safe = measurements ?? {}
  const options = getMeasurementOptionsForGender(gender)
  const preferredOrder = options.map((o) => o.key)
  const existingKeys = Object.keys(safe).filter((k) => safe[k] !== undefined)

  const ordered = preferredOrder.filter((k) => existingKeys.includes(k))
  const remaining = existingKeys.filter((k) => !ordered.includes(k))
  return [...ordered, ...remaining]
}
