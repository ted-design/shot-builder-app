import { describe, expect, it } from "vitest"
import {
  DEFAULT_CAST_SECTION,
  DEFAULT_CREW_SECTION,
  deserializeSectionFieldConfig,
  getVisibleFields,
  reorderField,
  resetAllFields,
  resetField,
  serializeSectionFieldConfig,
  toggleFieldVisibility,
  updateFieldLabel,
  updateFieldWidth,
  updateSectionTitle,
} from "@/features/schedules/lib/fieldConfig"

describe("fieldConfig", () => {
  describe("getVisibleFields", () => {
    it("returns only visible fields sorted by order", () => {
      const fields = [
        { key: "a", label: "A", defaultLabel: "A", visible: true, width: "md" as const, order: 2 },
        { key: "b", label: "B", defaultLabel: "B", visible: false, width: "md" as const, order: 0 },
        { key: "c", label: "C", defaultLabel: "C", visible: true, width: "md" as const, order: 1 },
      ]

      const result = getVisibleFields(fields)
      expect(result).toHaveLength(2)
      expect(result[0]?.key).toBe("c")
      expect(result[1]?.key).toBe("a")
    })
  })

  describe("toggleFieldVisibility", () => {
    it("toggles a field visible to hidden", () => {
      const result = toggleFieldVisibility(DEFAULT_CAST_SECTION, "talent")
      const field = result.fields.find((f) => f.key === "talent")
      expect(field?.visible).toBe(false)
    })

    it("toggles a hidden field back to visible", () => {
      const hidden = toggleFieldVisibility(DEFAULT_CAST_SECTION, "talent")
      const result = toggleFieldVisibility(hidden, "talent")
      const field = result.fields.find((f) => f.key === "talent")
      expect(field?.visible).toBe(true)
    })
  })

  describe("updateFieldLabel", () => {
    it("renames a field label", () => {
      const result = updateFieldLabel(DEFAULT_CAST_SECTION, "talent", "Actor")
      const field = result.fields.find((f) => f.key === "talent")
      expect(field?.label).toBe("Actor")
      expect(field?.defaultLabel).toBe("Talent")
    })
  })

  describe("updateFieldWidth", () => {
    it("changes a field width preset", () => {
      const result = updateFieldWidth(DEFAULT_CAST_SECTION, "talent", "sm")
      const field = result.fields.find((f) => f.key === "talent")
      expect(field?.width).toBe("sm")
    })
  })

  describe("resetField", () => {
    it("restores a field label to its default", () => {
      const renamed = updateFieldLabel(DEFAULT_CAST_SECTION, "talent", "Actor")
      const result = resetField(renamed, "talent")
      const field = result.fields.find((f) => f.key === "talent")
      expect(field?.label).toBe("Talent")
    })
  })

  describe("resetAllFields", () => {
    it("restores all fields and title to defaults", () => {
      let modified = updateSectionTitle(DEFAULT_CAST_SECTION, "My Cast")
      modified = updateFieldLabel(modified, "talent", "Actor")
      modified = toggleFieldVisibility(modified, "role")

      const result = resetAllFields(modified)
      expect(result.title).toBe("Cast")
      expect(result.fields.find((f) => f.key === "talent")?.label).toBe("Talent")
      expect(result.fields.find((f) => f.key === "role")?.visible).toBe(true)
    })
  })

  describe("updateSectionTitle", () => {
    it("updates the section title", () => {
      const result = updateSectionTitle(DEFAULT_CAST_SECTION, "Talent")
      expect(result.title).toBe("Talent")
      expect(result.defaultTitle).toBe("Cast")
    })
  })

  describe("reorderField", () => {
    it("moves a field from one position to another", () => {
      const result = reorderField(DEFAULT_CAST_SECTION, 0, 2)
      const sorted = [...result.fields].sort((a, b) => a.order - b.order)
      expect(sorted[0]?.key).toBe("talent")
      expect(sorted[1]?.key).toBe("role")
      expect(sorted[2]?.key).toBe("id")
    })

    it("returns the same config when from equals to", () => {
      const result = reorderField(DEFAULT_CAST_SECTION, 1, 1)
      expect(result).toBe(DEFAULT_CAST_SECTION)
    })
  })

  describe("serialize / deserialize", () => {
    it("round-trips a config through serialization", () => {
      const modified = updateFieldLabel(DEFAULT_CAST_SECTION, "talent", "Actor")
      const serialized = serializeSectionFieldConfig(modified)
      const deserialized = deserializeSectionFieldConfig(serialized, DEFAULT_CAST_SECTION)

      expect(deserialized.title).toBe(modified.title)
      expect(deserialized.fields.find((f) => f.key === "talent")?.label).toBe("Actor")
      expect(deserialized.fields.find((f) => f.key === "talent")?.defaultLabel).toBe("Talent")
    })

    it("returns defaults for null/undefined input", () => {
      const result = deserializeSectionFieldConfig(null, DEFAULT_CREW_SECTION)
      expect(result).toEqual(DEFAULT_CREW_SECTION)
    })

    it("fills missing fields from defaults", () => {
      const partial = {
        sectionKey: "crew",
        title: "My Crew",
        fields: [
          { key: "name", label: "Full Name", visible: true, width: "lg", order: 0 },
        ],
      }
      const result = deserializeSectionFieldConfig(partial, DEFAULT_CREW_SECTION)
      expect(result.title).toBe("My Crew")
      expect(result.fields.find((f) => f.key === "name")?.label).toBe("Full Name")
      expect(result.fields.find((f) => f.key === "position")).toBeDefined()
      expect(result.fields.find((f) => f.key === "callTime")).toBeDefined()
    })

    it("handles invalid width values gracefully", () => {
      const raw = {
        sectionKey: "crew",
        title: "Crew",
        fields: [
          { key: "name", label: "Name", visible: true, width: "invalid", order: 0 },
        ],
      }
      const result = deserializeSectionFieldConfig(raw, DEFAULT_CREW_SECTION)
      const field = result.fields.find((f) => f.key === "name")
      expect(field?.width).toBe("lg") // falls back to default width for that field
    })
  })
})
