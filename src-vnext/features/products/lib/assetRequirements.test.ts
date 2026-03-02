import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import {
  ASSET_TYPES,
  ASSET_FLAG_OPTIONS,
  normalizeAssetFlag,
  isRequirementActionable,
  countActiveRequirements,
  getLaunchDeadlineWarning,
  formatLaunchDate,
  summarizeSkuAssetFlags,
} from "./assetRequirements"
import type { ProductSku } from "@/shared/types"

describe("assetRequirements", () => {
  describe("ASSET_TYPES", () => {
    it("has 4 asset types", () => {
      expect(ASSET_TYPES).toHaveLength(4)
      expect(ASSET_TYPES.map((t) => t.key)).toEqual(["ecomm", "campaign", "video", "ai_generated"])
    })
  })

  describe("ASSET_FLAG_OPTIONS", () => {
    it("has 4 flag options", () => {
      expect(ASSET_FLAG_OPTIONS).toHaveLength(4)
      expect(ASSET_FLAG_OPTIONS.map((o) => o.value)).toEqual(["needed", "in_progress", "delivered", "not_needed"])
    })
  })

  describe("normalizeAssetFlag", () => {
    it("returns valid flags unchanged", () => {
      expect(normalizeAssetFlag("needed")).toBe("needed")
      expect(normalizeAssetFlag("in_progress")).toBe("in_progress")
      expect(normalizeAssetFlag("delivered")).toBe("delivered")
      expect(normalizeAssetFlag("not_needed")).toBe("not_needed")
    })

    it("returns undefined for invalid values", () => {
      expect(normalizeAssetFlag("invalid")).toBeUndefined()
      expect(normalizeAssetFlag(null)).toBeUndefined()
      expect(normalizeAssetFlag(undefined)).toBeUndefined()
      expect(normalizeAssetFlag(42)).toBeUndefined()
      expect(normalizeAssetFlag("")).toBeUndefined()
    })
  })

  describe("isRequirementActionable", () => {
    it("returns true for needed and in_progress", () => {
      expect(isRequirementActionable("needed")).toBe(true)
      expect(isRequirementActionable("in_progress")).toBe(true)
    })

    it("returns false for delivered, not_needed, and nullish", () => {
      expect(isRequirementActionable("delivered")).toBe(false)
      expect(isRequirementActionable("not_needed")).toBe(false)
      expect(isRequirementActionable(undefined)).toBe(false)
      expect(isRequirementActionable(null)).toBe(false)
    })
  })

  describe("countActiveRequirements", () => {
    it("returns 0 for null/undefined", () => {
      expect(countActiveRequirements(null)).toBe(0)
      expect(countActiveRequirements(undefined)).toBe(0)
    })

    it("counts needed and in_progress flags", () => {
      expect(countActiveRequirements({ ecomm: "needed", campaign: "in_progress" })).toBe(2)
      expect(countActiveRequirements({ ecomm: "delivered", campaign: "not_needed" })).toBe(0)
      expect(countActiveRequirements({ ecomm: "needed", video: "delivered", ai_generated: "in_progress" })).toBe(2)
    })

    it("returns 0 for empty object", () => {
      expect(countActiveRequirements({})).toBe(0)
    })
  })

  describe("getLaunchDeadlineWarning", () => {
    it("returns none for null/undefined", () => {
      expect(getLaunchDeadlineWarning(null)).toBe("none")
      expect(getLaunchDeadlineWarning(undefined)).toBe("none")
    })

    it("returns overdue for past dates", () => {
      const past = Timestamp.fromDate(new Date(Date.now() - 86400000))
      expect(getLaunchDeadlineWarning(past)).toBe("overdue")
    })

    it("returns soon for dates within soonDays", () => {
      const soon = Timestamp.fromDate(new Date(Date.now() + 7 * 86400000))
      expect(getLaunchDeadlineWarning(soon, 14)).toBe("soon")
    })

    it("returns ok for dates far in the future", () => {
      const future = Timestamp.fromDate(new Date(Date.now() + 60 * 86400000))
      expect(getLaunchDeadlineWarning(future)).toBe("ok")
    })
  })

  describe("formatLaunchDate", () => {
    it("returns dash for null/undefined", () => {
      expect(formatLaunchDate(null)).toBe("—")
      expect(formatLaunchDate(undefined)).toBe("—")
    })

    it("formats a valid timestamp", () => {
      const ts = Timestamp.fromDate(new Date(2026, 5, 15))
      const result = formatLaunchDate(ts)
      expect(result).toContain("2026")
      expect(result).toContain("15")
    })
  })

  describe("summarizeSkuAssetFlags", () => {
    const makeSku = (reqs?: Record<string, string> | null): ProductSku => ({
      id: "test",
      name: "Test",
      assetRequirements: reqs as ProductSku["assetRequirements"],
    })

    it("returns zeros for empty array", () => {
      expect(summarizeSkuAssetFlags([])).toEqual({ total: 0, needed: 0, inProgress: 0, delivered: 0 })
    })

    it("returns zeros for skus without requirements", () => {
      expect(summarizeSkuAssetFlags([makeSku(null), makeSku(undefined)])).toEqual({ total: 0, needed: 0, inProgress: 0, delivered: 0 })
    })

    it("counts flags across multiple skus", () => {
      const skus = [
        makeSku({ ecomm: "needed", campaign: "delivered" }),
        makeSku({ ecomm: "in_progress", video: "needed" }),
      ]
      expect(summarizeSkuAssetFlags(skus)).toEqual({ total: 4, needed: 2, inProgress: 1, delivered: 1 })
    })

    it("ignores not_needed flags in totals", () => {
      const skus = [makeSku({ ecomm: "not_needed", campaign: "needed" })]
      expect(summarizeSkuAssetFlags(skus)).toEqual({ total: 1, needed: 1, inProgress: 0, delivered: 0 })
    })
  })
})
