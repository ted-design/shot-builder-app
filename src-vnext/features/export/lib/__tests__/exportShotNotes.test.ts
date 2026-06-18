import { describe, it, expect } from "vitest"
import { resolveExportShotNotes } from "../exportShotNotes"

describe("resolveExportShotNotes", () => {
  it("returns notesAddendum when present (the field the app actually writes)", () => {
    expect(
      resolveExportShotNotes({ notesAddendum: "Bring the blue jacket", notes: undefined }),
    ).toBe("Bring the blue jacket")
  })

  it("prefers notesAddendum over the legacy notes field", () => {
    expect(
      resolveExportShotNotes({ notesAddendum: "Real note", notes: "<p>Legacy</p>" }),
    ).toBe("Real note")
  })

  it("falls back to legacy notes, stripped of HTML, when there is no addendum", () => {
    expect(
      resolveExportShotNotes({ notes: "<p>Bring <strong>blue</strong> jacket</p>" }),
    ).toBe("Bring blue jacket")
  })

  it("treats empty legacy HTML as no notes", () => {
    expect(resolveExportShotNotes({ notes: "<p></p>" })).toBe("")
  })

  it("returns empty when an empty legacy HTML coexists with a real addendum", () => {
    expect(
      resolveExportShotNotes({ notesAddendum: "Steamer ready", notes: "<p></p>" }),
    ).toBe("Steamer ready")
  })

  it("returns empty string when both fields are absent", () => {
    expect(resolveExportShotNotes({})).toBe("")
    expect(resolveExportShotNotes({ notes: undefined, notesAddendum: undefined })).toBe("")
  })

  it("does not truncate long notes (unlike the card-preview helper)", () => {
    const long = "word ".repeat(60).trim() // ~300 chars, well past the 120-char preview cap
    expect(resolveExportShotNotes({ notesAddendum: long })).toBe(long)
  })
})
