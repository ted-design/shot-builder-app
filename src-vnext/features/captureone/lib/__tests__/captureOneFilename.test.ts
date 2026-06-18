import { describe, it, expect } from "vitest"
import {
  toPascalCaseFilename,
  resolveHeroGenderPrefix,
  buildCaptureOneName,
  buildHeroFilename,
} from "../captureOneFilename"

describe("toPascalCaseFilename", () => {
  it("PascalCases space-separated words", () => {
    expect(toPascalCaseFilename("Merino Flex Jogger")).toBe("MerinoFlexJogger")
    expect(toPascalCaseFilename("Light Azure")).toBe("LightAzure")
  })

  it("preserves hyphens within a word (capitalizing each segment)", () => {
    expect(toPascalCaseFilename("Button-Up Shirt")).toBe("Button-UpShirt")
    expect(toPascalCaseFilename("Merino Linen Button-Up")).toBe("MerinoLinenButton-Up")
    expect(toPascalCaseFilename("Button-Up-Down")).toBe("Button-Up-Down")
  })

  it("strips Capture One / filesystem illegal characters", () => {
    expect(toPascalCaseFilename("Tee / Crew")).toBe("TeeCrew")
    expect(toPascalCaseFilename('A:B*C?"D<E>F|G\\H')).toBe("ABCDEFGH")
  })

  it("capitalizes lowercase input", () => {
    expect(toPascalCaseFilename("merino flex")).toBe("MerinoFlex")
  })

  it("handles empty / nullish input", () => {
    expect(toPascalCaseFilename("")).toBe("")
    expect(toPascalCaseFilename(null)).toBe("")
    expect(toPascalCaseFilename(undefined)).toBe("")
    expect(toPascalCaseFilename("   ")).toBe("")
  })

  it("does not crash on leading/trailing/double hyphens", () => {
    expect(toPascalCaseFilename("-Tee")).toBe("-Tee")
    expect(toPascalCaseFilename("Tee-")).toBe("Tee-")
    expect(toPascalCaseFilename("A--B")).toBe("A--B")
    expect(toPascalCaseFilename("-")).toBe("-")
  })

  it("strips trailing dots/spaces (Windows/exFAT hazard)", () => {
    expect(toPascalCaseFilename("Vol. ")).toBe("Vol")
    expect(toPascalCaseFilename("Tee.")).toBe("Tee")
    // mid-string dot is fine
    expect(toPascalCaseFilename("No. 5")).toBe("No.5")
  })
})

describe("resolveHeroGenderPrefix", () => {
  it("maps known men/women/unisex variants", () => {
    for (const v of ["men", "Man", "MENS", "male", "M"]) expect(resolveHeroGenderPrefix(v)).toBe("M")
    for (const v of ["women", "Woman", "WOMENS", "female", "w"]) expect(resolveHeroGenderPrefix(v)).toBe("W")
    for (const v of ["unisex", "Unisex", "U"]) expect(resolveHeroGenderPrefix(v)).toBe("U")
  })

  it("returns null (the flag) for unresolved gender — never a silent U", () => {
    expect(resolveHeroGenderPrefix(null)).toBeNull()
    expect(resolveHeroGenderPrefix(undefined)).toBeNull()
    expect(resolveHeroGenderPrefix("")).toBeNull()
    expect(resolveHeroGenderPrefix("kids")).toBeNull()
    expect(resolveHeroGenderPrefix("???")).toBeNull()
  })
})

describe("buildCaptureOneName", () => {
  it("joins prefix + product + colorway", () => {
    expect(buildCaptureOneName("M", "Merino Flex Jogger", "Forest")).toBe("M_MerinoFlexJogger_Forest")
    expect(buildCaptureOneName("W", "Merino Linen Button-Up", "Light Azure")).toBe(
      "W_MerinoLinenButton-Up_LightAzure",
    )
  })

  it("omits an empty colorway (no trailing underscore)", () => {
    expect(buildCaptureOneName("M", "Merino Flex Jogger", null)).toBe("M_MerinoFlexJogger")
    expect(buildCaptureOneName("M", "Merino Flex Jogger", "")).toBe("M_MerinoFlexJogger")
    // a colorway that's all illegal chars strips to "" and is omitted (no "_" artifact)
    expect(buildCaptureOneName("M", "Jogger", "/")).toBe("M_Jogger")
  })

  it("a blank/all-illegal product name yields an empty middle slot (caller must guarantee a name)", () => {
    // Documented edge: hero products always have a name in practice, but pin the behavior.
    expect(buildCaptureOneName("M", "***", "Red")).toBe("M__Red")
  })
})

describe("buildHeroFilename", () => {
  it("resolves the gender prefix from the family and reports resolved", () => {
    expect(
      buildHeroFilename({ gender: "men", productName: "Merino Flex Jogger", colorway: "Forest" }),
    ).toEqual({ name: "M_MerinoFlexJogger_Forest", genderResolved: true })
  })

  it("falls back to U_ and flags genderResolved=false when gender is unresolved", () => {
    expect(
      buildHeroFilename({ gender: null, productName: "Merino Flex Jogger", colorway: "Forest" }),
    ).toEqual({ name: "U_MerinoFlexJogger_Forest", genderResolved: false })
  })

  it("a genuine unisex product resolves to U_ and is NOT flagged", () => {
    const r = buildHeroFilename({ gender: "unisex", productName: "Beach Tote", colorway: "Sand" })
    expect(r.name).toBe("U_BeachTote_Sand")
    expect(r.genderResolved).toBe(true)
  })
})
