/**
 * Per-section field customization for call sheet sections.
 * Inspired by SetHero's "Edit Fields" pattern — rename, reorder, resize, toggle columns.
 */

// --- Types ---

export type FieldWidth = "xs" | "sm" | "md" | "lg"

export interface CallSheetFieldConfig {
  readonly key: string
  readonly label: string
  readonly defaultLabel: string
  readonly visible: boolean
  readonly width: FieldWidth
  readonly order: number
}

export interface CallSheetSectionFieldConfig {
  readonly sectionKey: string
  readonly title: string
  readonly defaultTitle: string
  readonly fields: readonly CallSheetFieldConfig[]
}

// --- Width presets (CSS percentage strings for table columns) ---

export const FIELD_WIDTH_MAP: Record<FieldWidth, string> = {
  xs: "6%",
  sm: "10%",
  md: "14%",
  lg: "22%",
}

export const FIELD_WIDTH_LABELS: Record<FieldWidth, string> = {
  xs: "XS",
  sm: "S",
  md: "M",
  lg: "L",
}

// --- Default field configs per section ---

const CAST_FIELDS: readonly CallSheetFieldConfig[] = [
  { key: "id", label: "#", defaultLabel: "#", visible: true, width: "xs", order: 0 },
  { key: "talent", label: "Talent", defaultLabel: "Talent", visible: true, width: "lg", order: 1 },
  { key: "role", label: "Role", defaultLabel: "Role", visible: true, width: "lg", order: 2 },
  { key: "setCall", label: "Set Call", defaultLabel: "Set Call", visible: true, width: "md", order: 3 },
  { key: "wrap", label: "Wrap", defaultLabel: "Wrap", visible: true, width: "md", order: 4 },
  { key: "notes", label: "Notes", defaultLabel: "Notes", visible: true, width: "lg", order: 5 },
]

const CREW_FIELDS: readonly CallSheetFieldConfig[] = [
  { key: "position", label: "Position", defaultLabel: "Position", visible: true, width: "lg", order: 0 },
  { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: "lg", order: 1 },
  { key: "callTime", label: "Call", defaultLabel: "Call", visible: true, width: "sm", order: 2 },
]

export const DEFAULT_CAST_SECTION: CallSheetSectionFieldConfig = {
  sectionKey: "cast",
  title: "Cast",
  defaultTitle: "Cast",
  fields: CAST_FIELDS,
}

export const DEFAULT_CREW_SECTION: CallSheetSectionFieldConfig = {
  sectionKey: "crew",
  title: "Crew",
  defaultTitle: "Crew",
  fields: CREW_FIELDS,
}

// --- Helpers ---

/** Return only visible fields, sorted by order. */
export function getVisibleFields(
  fields: readonly CallSheetFieldConfig[],
): readonly CallSheetFieldConfig[] {
  return [...fields]
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)
}

/** Reset a single field to its default label. */
export function resetField(
  config: CallSheetSectionFieldConfig,
  fieldKey: string,
): CallSheetSectionFieldConfig {
  return {
    ...config,
    fields: config.fields.map((f) =>
      f.key === fieldKey ? { ...f, label: f.defaultLabel } : f,
    ),
  }
}

/** Reset all fields and the section title to defaults. */
export function resetAllFields(
  config: CallSheetSectionFieldConfig,
): CallSheetSectionFieldConfig {
  const defaults = config.sectionKey === "cast" ? DEFAULT_CAST_SECTION : DEFAULT_CREW_SECTION
  return {
    ...config,
    title: defaults.title,
    fields: defaults.fields,
  }
}

/** Toggle field visibility. */
export function toggleFieldVisibility(
  config: CallSheetSectionFieldConfig,
  fieldKey: string,
): CallSheetSectionFieldConfig {
  return {
    ...config,
    fields: config.fields.map((f) =>
      f.key === fieldKey ? { ...f, visible: !f.visible } : f,
    ),
  }
}

/** Update a field's label. */
export function updateFieldLabel(
  config: CallSheetSectionFieldConfig,
  fieldKey: string,
  label: string,
): CallSheetSectionFieldConfig {
  return {
    ...config,
    fields: config.fields.map((f) =>
      f.key === fieldKey ? { ...f, label } : f,
    ),
  }
}

/** Update a field's width. */
export function updateFieldWidth(
  config: CallSheetSectionFieldConfig,
  fieldKey: string,
  width: FieldWidth,
): CallSheetSectionFieldConfig {
  return {
    ...config,
    fields: config.fields.map((f) =>
      f.key === fieldKey ? { ...f, width } : f,
    ),
  }
}

/** Move a field from one index to another (reorder). */
export function reorderField(
  config: CallSheetSectionFieldConfig,
  fromIndex: number,
  toIndex: number,
): CallSheetSectionFieldConfig {
  if (fromIndex === toIndex) return config
  const sorted = [...config.fields].sort((a, b) => a.order - b.order)
  const [moved] = sorted.splice(fromIndex, 1)
  if (!moved) return config
  sorted.splice(toIndex, 0, moved)
  return {
    ...config,
    fields: sorted.map((f, idx) => ({ ...f, order: idx })),
  }
}

/** Update section title. */
export function updateSectionTitle(
  config: CallSheetSectionFieldConfig,
  title: string,
): CallSheetSectionFieldConfig {
  return { ...config, title }
}

// --- Serialization for Firestore persistence ---

export function serializeSectionFieldConfig(
  config: CallSheetSectionFieldConfig,
): Record<string, unknown> {
  return {
    sectionKey: config.sectionKey,
    title: config.title,
    defaultTitle: config.defaultTitle,
    fields: config.fields.map((f) => ({
      key: f.key,
      label: f.label,
      defaultLabel: f.defaultLabel,
      visible: f.visible,
      width: f.width,
      order: f.order,
    })),
  }
}

export function deserializeSectionFieldConfig(
  raw: Record<string, unknown> | null | undefined,
  defaults: CallSheetSectionFieldConfig,
): CallSheetSectionFieldConfig {
  if (!raw || typeof raw !== "object") return defaults

  const title = typeof raw.title === "string" ? raw.title : defaults.title
  const rawFields = Array.isArray(raw.fields) ? raw.fields : []

  if (rawFields.length === 0) {
    return { ...defaults, title }
  }

  const defaultsByKey = new Map(defaults.fields.map((f) => [f.key, f]))
  const validWidths = new Set<string>(["xs", "sm", "md", "lg"])

  const fields: CallSheetFieldConfig[] = rawFields
    .filter((f: unknown): f is Record<string, unknown> =>
      typeof f === "object" && f !== null && typeof (f as Record<string, unknown>).key === "string",
    )
    .map((f) => {
      const key = f.key as string
      const def = defaultsByKey.get(key)
      const width = typeof f.width === "string" && validWidths.has(f.width)
        ? (f.width as FieldWidth)
        : (def?.width ?? "md")

      return {
        key,
        label: typeof f.label === "string" ? f.label : (def?.defaultLabel ?? key),
        defaultLabel: def?.defaultLabel ?? key,
        visible: typeof f.visible === "boolean" ? f.visible : true,
        width,
        order: typeof f.order === "number" ? f.order : (def?.order ?? 0),
      }
    })

  // Add any default fields not present in the saved config
  for (const def of defaults.fields) {
    if (!fields.some((f) => f.key === def.key)) {
      fields.push(def)
    }
  }

  return {
    sectionKey: defaults.sectionKey,
    title,
    defaultTitle: defaults.defaultTitle,
    fields,
  }
}
