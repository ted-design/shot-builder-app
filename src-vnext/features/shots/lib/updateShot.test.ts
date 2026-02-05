import { describe, it, expect } from "vitest"
import { buildShotWritePayload } from "./updateShot"

describe("buildShotWritePayload", () => {
  it("strips the notes field from the payload", () => {
    const result = buildShotWritePayload({
      notes: "<p>legacy HTML</p>",
      title: "Updated title",
    })
    expect(result).toEqual({ title: "Updated title" })
    expect(result).not.toHaveProperty("notes")
  })

  it("strips undefined values", () => {
    const result = buildShotWritePayload({
      title: "Test",
      description: undefined,
    })
    expect(result).toEqual({ title: "Test" })
    expect(result).not.toHaveProperty("description")
  })

  it("passes through notesAddendum", () => {
    const result = buildShotWritePayload({
      notesAddendum: "On-set note",
    })
    expect(result).toEqual({ notesAddendum: "On-set note" })
  })

  it("passes through null values (for clearing fields)", () => {
    const result = buildShotWritePayload({
      description: null,
      locationId: null,
    })
    expect(result).toEqual({ description: null, locationId: null })
  })

  it("returns empty object when only blocked/undefined fields provided", () => {
    const result = buildShotWritePayload({
      notes: "should be stripped",
      missing: undefined,
    })
    expect(result).toEqual({})
  })

  it("preserves all standard shot fields", () => {
    const fields = {
      title: "Shot A",
      status: "in_progress",
      notesAddendum: "addendum text",
      products: [{ familyId: "f1" }],
      talent: ["t1"],
      locationId: "loc1",
      locationName: "Studio A",
    }
    const result = buildShotWritePayload(fields)
    expect(result).toEqual(fields)
  })
})
