import type { CallSheetConfig, CallSheetSectionVisibility, ScheduleBlockFields, CallSheetColors } from "@/features/schedules/components/CallSheetRenderer"

type LegacySectionType =
  | "header"
  | "day-details"
  | "schedule"
  | "talent"
  | "crew"
  | "notes"
  | "reminders"

interface LegacySection {
  readonly type?: LegacySectionType | string
  readonly isVisible?: boolean
  readonly order?: number
  readonly [key: string]: unknown
}

interface LegacyConfig {
  readonly sections?: readonly LegacySection[]
  readonly scheduleBlockFields?: Record<string, unknown>
  readonly colors?: Record<string, unknown>
}

const KEY_TO_SECTION_TYPE: Record<keyof Required<CallSheetSectionVisibility>, LegacySectionType> = {
  header: "header",
  dayDetails: "day-details",
  schedule: "schedule",
  talent: "talent",
  crew: "crew",
  notes: "notes",
}

const DEFAULT_SECTION_ORDER: readonly (keyof Required<CallSheetSectionVisibility>)[] = [
  "header",
  "dayDetails",
  "schedule",
  "talent",
  "crew",
  "notes",
]

export const DEFAULT_CALLSHEET_COLORS: Required<CallSheetColors> = {
  primary: "#111111",
  accent: "#2563eb",
  text: "#111111",
}

export function normalizeCallSheetConfig(raw: Record<string, unknown> | null): CallSheetConfig {
  const legacy = (raw ?? {}) as LegacyConfig

  const sections: { -readonly [K in keyof Required<CallSheetSectionVisibility>]: boolean } = {
    header: true,
    dayDetails: true,
    schedule: true,
    talent: true,
    crew: true,
    notes: true,
  }

  const rawSections = Array.isArray(legacy.sections) ? legacy.sections : []
  for (const s of rawSections) {
    const type = typeof s.type === "string" ? s.type : ""
    const visible = s.isVisible !== false
    if (type === "header") sections.header = visible
    if (type === "day-details") sections.dayDetails = visible
    if (type === "schedule") sections.schedule = visible
    if (type === "talent") sections.talent = visible
    if (type === "crew") sections.crew = visible
    if (type === "notes" || type === "reminders") sections.notes = visible
  }

  const scheduleBlockFields: ScheduleBlockFields = {
    showShotNumber: legacy.scheduleBlockFields?.["showShotNumber"] as boolean | undefined,
    showShotName: legacy.scheduleBlockFields?.["showShotName"] as boolean | undefined,
    showDescription: legacy.scheduleBlockFields?.["showDescription"] as boolean | undefined,
    showTalent: legacy.scheduleBlockFields?.["showTalent"] as boolean | undefined,
    showLocation: legacy.scheduleBlockFields?.["showLocation"] as boolean | undefined,
    showNotes: legacy.scheduleBlockFields?.["showNotes"] as boolean | undefined,
  }

  const colors: CallSheetColors = {
    primary: legacy.colors?.["primary"] as string | undefined,
    accent: legacy.colors?.["accent"] as string | undefined,
    text: legacy.colors?.["text"] as string | undefined,
  }

  return {
    sections,
    scheduleBlockFields,
    colors,
  }
}

export function upsertLegacySectionVisibility(
  existing: Record<string, unknown> | null,
  patch: Partial<Required<CallSheetSectionVisibility>>,
): readonly LegacySection[] {
  const legacy = (existing ?? {}) as LegacyConfig
  const current = Array.isArray(legacy.sections) ? legacy.sections : []

  const byType = new Map<string, LegacySection>()
  for (const section of current) {
    if (typeof section.type === "string") byType.set(section.type, section)
  }

  const knownTypes = new Set<string>([
    "header",
    "day-details",
    "schedule",
    "talent",
    "crew",
    "notes",
    "reminders",
  ])

  const next: LegacySection[] = []
  for (const key of DEFAULT_SECTION_ORDER) {
    const type = KEY_TO_SECTION_TYPE[key]
    const existingSection = byType.get(type)
    const visible = patch[key]
    if (existingSection) {
      next.push({
        ...existingSection,
        isVisible: visible == null ? existingSection.isVisible !== false : visible,
      })
    } else {
      next.push({
        type,
        order: DEFAULT_SECTION_ORDER.indexOf(key),
        isVisible: visible == null ? true : visible,
      })
    }
  }

  // Preserve any unknown extra sections (keep order as-is after the known set)
  for (const section of current) {
    const t = typeof section.type === "string" ? section.type : null
    if (!t) continue
    if (!knownTypes.has(t)) next.push(section)
  }

  return next
}

export function mergeLegacyScheduleBlockFields(
  existing: Record<string, unknown> | null,
  patch: Partial<Required<ScheduleBlockFields>>,
): Record<string, unknown> {
  const legacy = (existing ?? {}) as LegacyConfig
  const current = legacy.scheduleBlockFields && typeof legacy.scheduleBlockFields === "object"
    ? legacy.scheduleBlockFields
    : {}

  return {
    ...current,
    ...patch,
  }
}

export function mergeLegacyColors(
  existing: Record<string, unknown> | null,
  patch: Partial<Required<CallSheetColors>>,
): Record<string, unknown> {
  const legacy = (existing ?? {}) as LegacyConfig
  const current = legacy.colors && typeof legacy.colors === "object" ? legacy.colors : {}

  return {
    ...current,
    ...patch,
  }
}
