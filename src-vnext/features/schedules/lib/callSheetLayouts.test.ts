import { afterEach, describe, expect, it } from "vitest"
import {
  BUILTIN_LAYOUTS,
  createLayout,
  deleteLayout,
  loadSavedLayouts,
  saveLayout,
  SECTION_META,
} from "@/features/schedules/lib/callSheetLayouts"
import type { CallSheetSectionVisibility } from "@/features/schedules/components/CallSheetRenderer"

const STORAGE_KEY = "sb:callsheet-layouts"

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe("BUILTIN_LAYOUTS", () => {
  it("provides exactly 3 built-in layouts", () => {
    expect(BUILTIN_LAYOUTS).toHaveLength(3)
  })

  it("Full layout has all sections enabled", () => {
    const full = BUILTIN_LAYOUTS.find((l) => l.id === "builtin-full")!
    for (const meta of SECTION_META) {
      expect(full.sectionVisibility[meta.key]).toBe(true)
    }
  })

  it("Compact layout disables notes", () => {
    const compact = BUILTIN_LAYOUTS.find((l) => l.id === "builtin-compact")!
    expect(compact.sectionVisibility.notes).toBe(false)
    expect(compact.sectionVisibility.header).toBe(true)
    expect(compact.sectionVisibility.schedule).toBe(true)
  })

  it("Crew Only layout only enables header and crew", () => {
    const crewOnly = BUILTIN_LAYOUTS.find((l) => l.id === "builtin-crew-only")!
    expect(crewOnly.sectionVisibility.header).toBe(true)
    expect(crewOnly.sectionVisibility.crew).toBe(true)
    expect(crewOnly.sectionVisibility.dayDetails).toBe(false)
    expect(crewOnly.sectionVisibility.schedule).toBe(false)
    expect(crewOnly.sectionVisibility.talent).toBe(false)
    expect(crewOnly.sectionVisibility.notes).toBe(false)
  })
})

describe("createLayout", () => {
  it("creates a layout with a unique id and provided data", () => {
    const visibility: Required<CallSheetSectionVisibility> = {
      header: true,
      dayDetails: false,
      schedule: true,
      talent: false,
      crew: true,
      notes: false,
    }
    const layout = createLayout("My Layout", visibility)

    expect(layout.id).toMatch(/^custom-/)
    expect(layout.name).toBe("My Layout")
    expect(layout.sectionVisibility).toEqual(visibility)
    expect(layout.createdAt).toBeTruthy()
  })
})

describe("saveLayout / loadSavedLayouts / deleteLayout", () => {
  it("returns empty array when nothing saved", () => {
    expect(loadSavedLayouts()).toEqual([])
  })

  it("saves and loads a layout", () => {
    const layout = createLayout("Test", {
      header: true,
      dayDetails: true,
      schedule: true,
      talent: true,
      crew: true,
      notes: false,
    })

    saveLayout(layout)
    const loaded = loadSavedLayouts()

    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe("Test")
    expect(loaded[0].sectionVisibility.notes).toBe(false)
  })

  it("overwrites layout with same id on save", () => {
    const layout = createLayout("Original", {
      header: true,
      dayDetails: true,
      schedule: true,
      talent: true,
      crew: true,
      notes: true,
    })

    saveLayout(layout)

    const updated = { ...layout, name: "Updated" }
    saveLayout(updated)

    const loaded = loadSavedLayouts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe("Updated")
  })

  it("deletes a layout by id", () => {
    const layout1 = createLayout("First", {
      header: true,
      dayDetails: true,
      schedule: true,
      talent: true,
      crew: true,
      notes: true,
    })
    const layout2 = createLayout("Second", {
      header: true,
      dayDetails: false,
      schedule: true,
      talent: false,
      crew: true,
      notes: false,
    })

    saveLayout(layout1)
    saveLayout(layout2)
    expect(loadSavedLayouts()).toHaveLength(2)

    deleteLayout(layout1.id)
    const loaded = loadSavedLayouts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe("Second")
  })

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json array")
    expect(loadSavedLayouts()).toEqual([])
  })

  it("filters out invalid entries from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "valid", name: "Good", sectionVisibility: {}, createdAt: "2026-01-01" },
        { bad: true },
        null,
        42,
      ]),
    )
    const loaded = loadSavedLayouts()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe("Good")
  })
})
