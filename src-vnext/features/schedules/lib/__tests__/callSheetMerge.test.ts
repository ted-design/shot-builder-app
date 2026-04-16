import { describe, expect, it } from "vitest"
import type { CrewCallSheet, TalentCallSheet } from "@/shared/types"
import {
  mergeCrewWithOverride,
  mergeTalentWithOverride,
  type CrewMergeContext,
  type CrewVisibility,
  type TalentVisibility,
} from "../callSheetMerge"

function makeCrewOverride(
  overrides: Partial<CrewCallSheet> = {},
): CrewCallSheet {
  return {
    id: "crew-call-1",
    crewMemberId: "crew-1",
    ...overrides,
  }
}

function makeTalentOverride(
  overrides: Partial<TalentCallSheet> = {},
): TalentCallSheet {
  return {
    id: "talent-call-1",
    talentId: "talent-1",
    ...overrides,
  }
}

describe("mergeCrewWithOverride", () => {
  it("returns all-visible defaults when override is undefined", () => {
    const result: CrewVisibility = mergeCrewWithOverride(undefined)
    expect(result).toEqual({
      isVisible: true,
      showEmail: true,
      showPhone: true,
    })
  })

  it("returns all-visible defaults when override is null", () => {
    const result = mergeCrewWithOverride(null)
    expect(result).toEqual({
      isVisible: true,
      showEmail: true,
      showPhone: true,
    })
  })

  it("returns all-visible defaults when override has no visibility fields set", () => {
    const override = makeCrewOverride()
    const result = mergeCrewWithOverride(override)
    expect(result).toEqual({
      isVisible: true,
      showEmail: true,
      showPhone: true,
    })
  })

  it("hides the row when isVisibleOverride is false", () => {
    const override = makeCrewOverride({ isVisibleOverride: false })
    const result = mergeCrewWithOverride(override)
    expect(result).toEqual({
      isVisible: false,
      showEmail: true,
      showPhone: true,
    })
  })

  it("treats isVisibleOverride === true as visible", () => {
    const override = makeCrewOverride({ isVisibleOverride: true })
    const result = mergeCrewWithOverride(override)
    expect(result.isVisible).toBe(true)
  })

  it("hides the email cell when showEmailOverride is false and global allows email", () => {
    const override = makeCrewOverride({ showEmailOverride: false })
    const context: CrewMergeContext = { globalShowEmail: true }
    const result = mergeCrewWithOverride(override, context)
    expect(result.showEmail).toBe(false)
  })

  it("hides the phone cell when showPhoneOverride is false and global allows phone", () => {
    const override = makeCrewOverride({ showPhoneOverride: false })
    const context: CrewMergeContext = { globalShowPhone: true }
    const result = mergeCrewWithOverride(override, context)
    expect(result.showPhone).toBe(false)
  })

  it("ignores per-row showEmailOverride when global config hides email column", () => {
    const override = makeCrewOverride({ showEmailOverride: true })
    const context: CrewMergeContext = { globalShowEmail: false }
    const result = mergeCrewWithOverride(override, context)
    expect(result.showEmail).toBe(false)
  })

  it("ignores per-row showPhoneOverride when global config hides phone column", () => {
    const override = makeCrewOverride({ showPhoneOverride: true })
    const context: CrewMergeContext = { globalShowPhone: false }
    const result = mergeCrewWithOverride(override, context)
    expect(result.showPhone).toBe(false)
  })

  it("treats undefined globalShowEmail as visible (column exists)", () => {
    const override = makeCrewOverride({ showEmailOverride: false })
    const context: CrewMergeContext = {}
    const result = mergeCrewWithOverride(override, context)
    expect(result.showEmail).toBe(false)
  })

  it("treats null globalShowEmail as visible", () => {
    const override = makeCrewOverride({ showEmailOverride: false })
    const context: CrewMergeContext = { globalShowEmail: null }
    const result = mergeCrewWithOverride(override, context)
    expect(result.showEmail).toBe(false)
  })

  it("returns all three booleans independently", () => {
    const override = makeCrewOverride({
      isVisibleOverride: false,
      showEmailOverride: true,
      showPhoneOverride: false,
    })
    const result = mergeCrewWithOverride(override)
    expect(result).toEqual({
      isVisible: false,
      showEmail: true,
      showPhone: false,
    })
  })
})

describe("mergeTalentWithOverride", () => {
  it("returns visible when override is undefined", () => {
    const result: TalentVisibility = mergeTalentWithOverride(undefined)
    expect(result).toEqual({ isVisible: true })
  })

  it("returns visible when override is null", () => {
    const result = mergeTalentWithOverride(null)
    expect(result).toEqual({ isVisible: true })
  })

  it("returns visible when override has no visibility fields set", () => {
    const override = makeTalentOverride()
    const result = mergeTalentWithOverride(override)
    expect(result).toEqual({ isVisible: true })
  })

  it("hides the row when isVisibleOverride is false", () => {
    const override = makeTalentOverride({ isVisibleOverride: false })
    const result = mergeTalentWithOverride(override)
    expect(result).toEqual({ isVisible: false })
  })

  it("returns visible when isVisibleOverride is explicitly true", () => {
    const override = makeTalentOverride({ isVisibleOverride: true })
    const result = mergeTalentWithOverride(override)
    expect(result).toEqual({ isVisible: true })
  })
})
