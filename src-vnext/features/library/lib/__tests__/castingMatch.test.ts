import { describe, it, expect } from "vitest"
import type { TalentRecord } from "@/shared/types"
import {
  computeMatchScore,
  rankTalentForBrief,
  EMPTY_CASTING_BRIEF,
  type CastingBrief,
} from "@/features/library/lib/castingMatch"

function makeTalent(overrides: Partial<TalentRecord> = {}): TalentRecord {
  return {
    id: overrides.id ?? "t1",
    name: overrides.name ?? "Test Talent",
    gender: overrides.gender ?? "Women",
    measurements: overrides.measurements ?? null,
  } as TalentRecord
}

describe("computeMatchScore", () => {
  it("returns score 0 when gender does not match", () => {
    const talent = makeTalent({ gender: "Men" })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { waist: { min: 26, max: 30 } },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.genderMatch).toBe(false)
    expect(result.overallScore).toBe(0)
  })

  it("returns score 1 when gender matches and no requirements", () => {
    const talent = makeTalent({ gender: "Women" })
    const result = computeMatchScore(talent, EMPTY_CASTING_BRIEF)
    expect(result.genderMatch).toBe(true)
    expect(result.overallScore).toBe(1)
  })

  it("returns score 1 when all measurements are within range", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: { waist: 28, hips: 36 },
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: {
        waist: { min: 26, max: 30 },
        hips: { min: 34, max: 38 },
      },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.overallScore).toBe(1)
    expect(result.measuredFieldCount).toBe(2)
  })

  it("returns reduced score when measurement is outside range", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: { waist: 32 },
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { waist: { min: 26, max: 30 } },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.overallScore).toBeLessThan(1)
    expect(result.overallScore).toBeGreaterThan(0)
  })

  it("returns score 0 when gender matches but all required fields are null", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: null,
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { waist: { min: 26, max: 30 } },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.overallScore).toBe(0)
    expect(result.measuredFieldCount).toBe(0)
  })

  it("parses string measurement values", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: { height: '5\'9"' },
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { height: { min: 66, max: 72 } },
    }
    const result = computeMatchScore(talent, brief)
    // 5'9" = 69 inches, within [66, 72]
    expect(result.overallScore).toBe(1)
    expect(result.fieldDetails[0]!.parsedValue).toBe(69)
  })

  it("provides field detail labels from MEASUREMENT_LABEL_MAP", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: { waist: 28 },
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { waist: { min: 26, max: 30 } },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.fieldDetails[0]!.label).toBe("Waist")
    expect(result.fieldDetails[0]!.key).toBe("waist")
  })

  it("handles min-only range", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: { height: 70 },
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { height: { min: 66, max: null } },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.overallScore).toBe(1)
  })

  it("handles max-only range", () => {
    const talent = makeTalent({
      gender: "Women",
      measurements: { waist: 26 },
    })
    const brief: CastingBrief = {
      gender: "women",
      requirements: { waist: { min: null, max: 30 } },
    }
    const result = computeMatchScore(talent, brief)
    expect(result.overallScore).toBe(1)
  })

  it("returns requiredFieldCount correctly", () => {
    const talent = makeTalent({ gender: "Women", measurements: { waist: 28 } })
    const brief: CastingBrief = {
      gender: "women",
      requirements: {
        waist: { min: 26, max: 30 },
        hips: { min: null, max: null },
      },
    }
    const result = computeMatchScore(talent, brief)
    // waist has range set → required. hips is null/null → not required.
    expect(result.requiredFieldCount).toBe(1)
  })
})

describe("rankTalentForBrief", () => {
  const brief: CastingBrief = {
    gender: "women",
    requirements: { waist: { min: 26, max: 30 } },
  }

  it("sorts by overallScore descending", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", name: "Low", gender: "Women", measurements: { waist: 40 } }),
      makeTalent({ id: "2", name: "High", gender: "Women", measurements: { waist: 28 } }),
    ]
    const result = rankTalentForBrief(talent, brief)
    expect(result[0]!.talent.id).toBe("2")
    expect(result[1]!.talent.id).toBe("1")
  })

  it("breaks ties by measuredFieldCount descending", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", name: "A", gender: "Women", measurements: { waist: 28 } }),
      makeTalent({
        id: "2",
        name: "B",
        gender: "Women",
        measurements: { waist: 28, hips: 36 },
      }),
    ]
    // Both score 1.0 on waist, but B has more measured fields
    const twoBrief: CastingBrief = {
      gender: "women",
      requirements: {
        waist: { min: 26, max: 30 },
        hips: { min: 34, max: 38 },
      },
    }
    const result = rankTalentForBrief(talent, twoBrief)
    expect(result[0]!.talent.id).toBe("2")
  })

  it("breaks further ties by name ascending", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", name: "Zara", gender: "Women", measurements: { waist: 28 } }),
      makeTalent({ id: "2", name: "Anna", gender: "Women", measurements: { waist: 28 } }),
    ]
    const result = rankTalentForBrief(talent, brief)
    expect(result[0]!.talent.name).toBe("Anna")
    expect(result[1]!.talent.name).toBe("Zara")
  })

  it("does not mutate input array", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", name: "B", gender: "Women" }),
      makeTalent({ id: "2", name: "A", gender: "Women" }),
    ]
    const copy = [...talent]
    rankTalentForBrief(talent, brief)
    expect(talent).toEqual(copy)
  })

  it("gender mismatch always ranks last", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", name: "Male", gender: "Men", measurements: { waist: 28 } }),
      makeTalent({ id: "2", name: "Female", gender: "Women", measurements: { waist: 35 } }),
    ]
    const result = rankTalentForBrief(talent, brief)
    // Female scored > 0 (gender matches), Male = 0 (gender mismatch)
    expect(result[0]!.talent.id).toBe("2")
    expect(result[1]!.talent.id).toBe("1")
  })
})
