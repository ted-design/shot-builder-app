import { describe, expect, it } from "vitest"
import { mapFontFamilyToPdf, mapFontFamilyBase } from "../fontMapping"

describe("mapFontFamilyToPdf", () => {
  it("maps Inter to Helvetica", () => {
    expect(mapFontFamilyToPdf("Inter")).toBe("Helvetica")
  })

  it("maps undefined to Helvetica", () => {
    expect(mapFontFamilyToPdf(undefined)).toBe("Helvetica")
  })

  it("maps Georgia to Times-Roman", () => {
    expect(mapFontFamilyToPdf("Georgia")).toBe("Times-Roman")
  })

  it("maps Georgia bold to Times-Bold", () => {
    expect(mapFontFamilyToPdf("Georgia", true)).toBe("Times-Bold")
  })

  it("maps Georgia italic to Times-Italic", () => {
    expect(mapFontFamilyToPdf("Georgia", false, true)).toBe("Times-Italic")
  })

  it("maps Georgia bold+italic to Times-BoldItalic", () => {
    expect(mapFontFamilyToPdf("Georgia", true, true)).toBe("Times-BoldItalic")
  })

  it("maps Courier New to Courier", () => {
    expect(mapFontFamilyToPdf("Courier New")).toBe("Courier")
  })

  it("maps Courier New bold to Courier-Bold", () => {
    expect(mapFontFamilyToPdf("Courier New", true)).toBe("Courier-Bold")
  })

  it("maps Helvetica bold to Helvetica-Bold", () => {
    expect(mapFontFamilyToPdf("Helvetica", true)).toBe("Helvetica-Bold")
  })

  it("maps unknown fonts to Helvetica family", () => {
    expect(mapFontFamilyToPdf("Arial")).toBe("Helvetica")
    expect(mapFontFamilyToPdf("Arial", true)).toBe("Helvetica-Bold")
  })
})

describe("mapFontFamilyBase", () => {
  it("returns base family without bold/italic", () => {
    expect(mapFontFamilyBase("Georgia")).toBe("Times-Roman")
    expect(mapFontFamilyBase("Courier New")).toBe("Courier")
    expect(mapFontFamilyBase("Inter")).toBe("Helvetica")
    expect(mapFontFamilyBase(undefined)).toBe("Helvetica")
  })
})
