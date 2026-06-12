import { describe, it, expect } from "vitest"
import {
  normalizeGender,
  genderDisplayLabel,
  genderBadgeClasses,
} from "@/features/library/lib/measurementOptions"

describe("normalizeGender", () => {
  it("maps the many stored variants to men/women/other", () => {
    for (const v of ["male", "Male", "man", "men", "Men", "m", "M"]) {
      expect(normalizeGender(v)).toBe("men")
    }
    for (const v of ["female", "Female", "woman", "women", "Women", "f", "F"]) {
      expect(normalizeGender(v)).toBe("women")
    }
    expect(normalizeGender("non-binary")).toBe("other")
    expect(normalizeGender(null)).toBe("other")
    expect(normalizeGender("")).toBe("other")
  })
})

describe("genderDisplayLabel — single canonical label across surfaces", () => {
  it("collapses every variant (incl. single-letter codes) to one label", () => {
    // Regression: single-letter "m"/"f" must not fall through to "Other".
    expect(genderDisplayLabel("m")).toBe("Male")
    expect(genderDisplayLabel("f")).toBe("Female")
    expect(genderDisplayLabel("Women")).toBe("Female")
    expect(genderDisplayLabel("men")).toBe("Male")
    expect(genderDisplayLabel("female")).toBe("Female")
    expect(genderDisplayLabel("non-binary")).toBe("Non-binary")
    expect(genderDisplayLabel("nb")).toBe("Non-binary")
    expect(genderDisplayLabel("")).toBe("")
    expect(genderDisplayLabel(null)).toBe("")
  })
})

describe("genderBadgeClasses", () => {
  it("returns a color class for known genders and empty for none", () => {
    expect(genderBadgeClasses("m")).toContain("blue")
    expect(genderBadgeClasses("f")).toContain("purple")
    expect(genderBadgeClasses("nb")).toContain("purple")
    expect(genderBadgeClasses("")).toBe("")
  })
})
