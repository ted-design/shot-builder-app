import {
  DEFAULT_CAST_SECTION,
  DEFAULT_CREW_SECTION,
  deserializeSectionFieldConfig,
  serializeSectionFieldConfig,
  type CallSheetSectionFieldConfig,
} from "@/features/schedules/lib/fieldConfig"
import type { CallSheetConfig, CallSheetSectionVisibility, ScheduleBlockFields, CallSheetColors, CallSheetHeaderLayout, SectionKey } from "@/features/schedules/components/CallSheetRenderer"
import { DEFAULT_SECTION_ORDER } from "@/features/schedules/components/CallSheetRenderer"

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

interface LegacyConfigExtended extends LegacyConfig {
  readonly headerLayout?: string
  readonly fieldConfigs?: Record<string, unknown>
  readonly sectionOrder?: unknown
}

export function normalizeCallSheetConfig(raw: Record<string, unknown> | null): CallSheetConfig {
  const legacy = (raw ?? {}) as LegacyConfigExtended

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
    showTags: legacy.scheduleBlockFields?.["showTags"] as boolean | undefined,
    showNotes: legacy.scheduleBlockFields?.["showNotes"] as boolean | undefined,
  }

  const colors: CallSheetColors = {
    primary: legacy.colors?.["primary"] as string | undefined,
    accent: legacy.colors?.["accent"] as string | undefined,
    text: legacy.colors?.["text"] as string | undefined,
  }

  const rawHeaderLayout = legacy.headerLayout
  const headerLayout: CallSheetHeaderLayout =
    rawHeaderLayout === "grid" ? "grid" : "legacy"

  const rawFieldConfigs = legacy.fieldConfigs && typeof legacy.fieldConfigs === "object"
    ? legacy.fieldConfigs as Record<string, unknown>
    : {}

  const fieldConfigs: Record<string, CallSheetSectionFieldConfig> = {
    cast: deserializeSectionFieldConfig(
      rawFieldConfigs.cast as Record<string, unknown> | null | undefined,
      DEFAULT_CAST_SECTION,
    ),
    crew: deserializeSectionFieldConfig(
      rawFieldConfigs.crew as Record<string, unknown> | null | undefined,
      DEFAULT_CREW_SECTION,
    ),
  }

  const sectionOrder = normalizeSectionOrder(legacy.sectionOrder)

  return {
    sections,
    scheduleBlockFields,
    colors,
    headerLayout,
    fieldConfigs,
    sectionOrder,
  }
}

function normalizeSectionOrder(raw: unknown): readonly SectionKey[] {
  const validKeys = new Set<string>(DEFAULT_SECTION_ORDER)

  if (!Array.isArray(raw)) return DEFAULT_SECTION_ORDER

  const seen = new Set<string>()
  const ordered: SectionKey[] = []

  for (const item of raw) {
    if (typeof item === "string" && validKeys.has(item) && !seen.has(item)) {
      seen.add(item)
      ordered.push(item as SectionKey)
    }
  }

  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) {
      ordered.push(key)
    }
  }

  return ordered
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

export function mergeHeaderLayout(
  existing: Record<string, unknown> | null,
  layout: CallSheetHeaderLayout,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    headerLayout: layout,
  }
}

export function mergeSectionFieldConfig(
  existing: Record<string, unknown> | null,
  sectionKey: string,
  config: CallSheetSectionFieldConfig,
): Record<string, unknown> {
  const legacy = (existing ?? {}) as LegacyConfigExtended
  const current = legacy.fieldConfigs && typeof legacy.fieldConfigs === "object"
    ? legacy.fieldConfigs
    : {}

  return {
    ...(existing ?? {}),
    fieldConfigs: {
      ...current,
      [sectionKey]: serializeSectionFieldConfig(config),
    },
  }
}
