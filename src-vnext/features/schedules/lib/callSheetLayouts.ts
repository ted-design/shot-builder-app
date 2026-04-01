import type { CallSheetSectionVisibility } from "@/features/schedules/components/CallSheetRenderer"

// --- Types ---

export interface CallSheetLayout {
  readonly id: string
  readonly name: string
  readonly sectionVisibility: Required<CallSheetSectionVisibility>
  readonly createdAt: string
}

// --- Constants ---

const STORAGE_KEY = "sb:callsheet-layouts"

// --- Section metadata for toggle UI ---

export type SectionKey = keyof Required<CallSheetSectionVisibility>

export interface SectionMeta {
  readonly key: SectionKey
  readonly label: string
}

export const SECTION_META: readonly SectionMeta[] = [
  { key: "header", label: "Header" },
  { key: "dayDetails", label: "Day Details" },
  { key: "schedule", label: "Schedule" },
  { key: "talent", label: "Talent" },
  { key: "crew", label: "Crew" },
  { key: "notes", label: "Notes" },
] as const

// --- Built-in presets ---

const FULL_VISIBILITY: Required<CallSheetSectionVisibility> = {
  header: true,
  dayDetails: true,
  schedule: true,
  talent: true,
  crew: true,
  notes: true,
}

const COMPACT_VISIBILITY: Required<CallSheetSectionVisibility> = {
  header: true,
  dayDetails: true,
  schedule: true,
  talent: true,
  crew: true,
  notes: false,
}

const CREW_ONLY_VISIBILITY: Required<CallSheetSectionVisibility> = {
  header: true,
  dayDetails: false,
  schedule: false,
  talent: false,
  crew: true,
  notes: false,
}

export const BUILTIN_LAYOUTS: readonly CallSheetLayout[] = [
  {
    id: "builtin-full",
    name: "Full",
    sectionVisibility: FULL_VISIBILITY,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-compact",
    name: "Compact",
    sectionVisibility: COMPACT_VISIBILITY,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "builtin-crew-only",
    name: "Crew Only",
    sectionVisibility: CREW_ONLY_VISIBILITY,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
] as const

// --- LocalStorage persistence ---

export function loadSavedLayouts(): readonly CallSheetLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidLayout)
  } catch {
    return []
  }
}

export function saveLayout(layout: CallSheetLayout): readonly CallSheetLayout[] {
  const existing = loadSavedLayouts()
  const next = [...existing.filter((l) => l.id !== layout.id), layout]
  persistLayouts(next)
  return next
}

export function deleteLayout(layoutId: string): readonly CallSheetLayout[] {
  const existing = loadSavedLayouts()
  const next = existing.filter((l) => l.id !== layoutId)
  persistLayouts(next)
  return next
}

export function createLayout(
  name: string,
  sectionVisibility: Required<CallSheetSectionVisibility>,
): CallSheetLayout {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    sectionVisibility: { ...sectionVisibility },
    createdAt: new Date().toISOString(),
  }
}

// --- Helpers ---

function persistLayouts(layouts: readonly CallSheetLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
  } catch {
    // Storage full or unavailable — silent fail
  }
}

function isValidLayout(value: unknown): value is CallSheetLayout {
  if (typeof value !== "object" || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.sectionVisibility === "object" &&
    obj.sectionVisibility !== null &&
    typeof obj.createdAt === "string"
  )
}
