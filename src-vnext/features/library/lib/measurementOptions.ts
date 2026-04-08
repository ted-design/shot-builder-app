export interface MeasurementField {
  readonly key: string
  readonly label: string
}

export type GenderKey = "men" | "women" | "other"

export const MEASUREMENT_GROUPS: Record<"men" | "women", readonly MeasurementField[]> = {
  men: [
    { key: "height", label: "Height" },
    { key: "waist", label: "Waist" },
    { key: "chest", label: "Chest" },
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
  const value = (gender ?? "").toLowerCase().trim()
  if (value === "male" || value === "man" || value.startsWith("men")) return "men"
  if (value === "female" || value === "woman" || value.startsWith("women")) return "women"
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

// ---------------------------------------------------------------------------
// Category-based grouping for detail views
// ---------------------------------------------------------------------------

export interface MeasurementCategoryGroup {
  readonly label: string
  readonly keys: Readonly<Record<GenderKey, readonly string[]>>
}

export const MEASUREMENT_CATEGORY_GROUPS: readonly MeasurementCategoryGroup[] = [
  {
    label: "Stature",
    keys: { men: ["height"], women: ["height"], other: ["height"] },
  },
  {
    label: "Body",
    keys: {
      men: ["chest", "waist"],
      women: ["bust", "waist", "hips"],
      other: ["chest", "bust", "waist", "hips"],
    },
  },
  {
    label: "Clothing",
    keys: {
      men: ["suit", "collar", "sleeve", "inseam", "shoes"],
      women: ["dress", "shoes"],
      other: ["suit", "dress", "collar", "sleeve", "inseam", "shoes"],
    },
  },
]

// ---------------------------------------------------------------------------
// Shared measurement formatter
// ---------------------------------------------------------------------------

export interface LabeledMeasurement {
  readonly label: string
  readonly value: string
}

/**
 * Format measurements with human-readable labels.
 *
 * - `"compact"` → `"Height: 5'10.5\" · Waist: 25\""` (for cards, badges)
 * - `"labeled"` → `[{ label: "Height", value: "5'10.5\"" }, ...]` (for detail views)
 */
export function formatLabeledMeasurements(
  measurements: Record<string, string | number | null | undefined> | null | undefined,
  gender: string | null | undefined,
  mode: "compact",
): string
export function formatLabeledMeasurements(
  measurements: Record<string, string | number | null | undefined> | null | undefined,
  gender: string | null | undefined,
  mode: "labeled",
): readonly LabeledMeasurement[]
export function formatLabeledMeasurements(
  measurements: Record<string, string | number | null | undefined> | null | undefined,
  gender: string | null | undefined,
  mode: "compact" | "labeled",
): string | readonly LabeledMeasurement[] {
  const safe = measurements ?? {}
  const orderedKeys = orderMeasurementKeys(safe, gender)

  const pairs: LabeledMeasurement[] = []
  for (const key of orderedKeys) {
    const raw = safe[key]
    if (raw === null || raw === undefined || raw === "") continue
    const label = MEASUREMENT_LABEL_MAP[key] ?? key
    const value = String(raw)
    pairs.push({ label, value })
  }

  if (mode === "compact") {
    return pairs.map((p) => `${p.label}: ${p.value}`).join(" · ")
  }

  return pairs
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
