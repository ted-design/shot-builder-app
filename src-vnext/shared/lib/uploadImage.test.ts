import { describe, it, expect } from "vitest"
import { validateImageFileForUpload } from "@/shared/lib/uploadImage"

describe("validateImageFileForUpload", () => {
  it("accepts jpg/png/webp images", () => {
    expect(() => validateImageFileForUpload(new File(["x"], "a.jpg", { type: "image/jpeg" }))).not.toThrow()
    expect(() => validateImageFileForUpload(new File(["x"], "a.png", { type: "image/png" }))).not.toThrow()
    expect(() => validateImageFileForUpload(new File(["x"], "a.webp", { type: "image/webp" }))).not.toThrow()
  })

  it("rejects HEIC/HEIF with a clear message", () => {
    expect(() =>
      validateImageFileForUpload(new File(["x"], "a.heic", { type: "image/heic" })),
    ).toThrow(/HEIC/i)
  })

  it("rejects unsupported types", () => {
    expect(() =>
      validateImageFileForUpload(new File(["x"], "a.gif", { type: "image/gif" })),
    ).toThrow(/Unsupported image type/i)
  })

  it("rejects empty files", () => {
    expect(() =>
      validateImageFileForUpload(new File([], "a.png", { type: "image/png" })),
    ).toThrow(/empty/i)
  })
})

