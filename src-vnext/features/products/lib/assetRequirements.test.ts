import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import {
  ASSET_TYPES,
  ASSET_FLAG_OPTIONS,
  LEGACY_ASSET_TYPES,
  normalizeAssetFlag,
  isRequirementActionable,
  countActiveRequirements,
  getLaunchDeadlineWarning,
  formatLaunchDate,
  summarizeSkuAssetFlags,
  resolveSkuLaunchDate,
  resolveEarliestLaunchDate,
} from "./assetRequirements"
import type { ProductSku } from "@/shared/types"

describe("assetRequirements", () => {
  describe("ASSET_TYPES", () => {
    it("has 6 canonical asset types", () => {
      expect(ASSET_TYPES).toHaveLength(6)
      expect(ASSET_TYPES.map((t) => t.key)).toEqual([
        "ecomm_on_figure",
        "lifestyle",
        "off_figure_pinup",
        "off_figure_detail",
        "video",
        "other",
      ])
    })

    it("each entry has a group", () => {
      for (const entry of ASSET_TYPES) {
        expect(["photography", "motion", "other"]).toContain(entry.group)
      }
    })
  })

  describe("LEGACY_ASSET_TYPES", () => {
    it("has 3 legacy types", () => {
      expect(LEGACY_ASSET_TYPES).toHaveLength(3)
      expect(LEGACY_ASSET_TYPES.map((t) => t.key)).toEqual(["ecomm", "campaign", "ai_generated"])
    })
  })

  describe("ASSET_FLAG_OPTIONS", () => {
    it("has 5 flag options including ai_generated", () => {
      expect(ASSET_FLAG_OPTIONS).toHaveLength(5)
      expect(ASSET_FLAG_OPTIONS.map((o) => o.value)).toEqual([
        "needed",
        "in_progress",
        "delivered",
        "ai_generated",
        "not_needed",
      ])
    })
  })

  describe("normalizeAssetFlag", () => {
    it("returns valid flags unchanged", () => {
      expect(normalizeAssetFlag("needed")).toBe("needed")
      expect(normalizeAssetFlag("in_progress")).toBe("in_progress")
      expect(normalizeAssetFlag("delivered")).toBe("delivered")
      expect(normalizeAssetFlag("not_needed")).toBe("not_needed")
      expect(normalizeAssetFlag("ai_generated")).toBe("ai_generated")
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

    it("returns false for delivered, not_needed, ai_generated, and nullish", () => {
      expect(isRequirementActionable("delivered")).toBe(false)
      expect(isRequirementActionable("not_needed")).toBe(false)
      expect(isRequirementActionable("ai_generated")).toBe(false)
      expect(isRequirementActionable(undefined)).toBe(false)
      expect(isRequirementActionable(null)).toBe(false)
    })
  })

  describe("countActiveRequirements", () => {
    it("returns 0 for null/undefined", () => {
      expect(countActiveRequirements(null)).toBe(0)
      expect(countActiveRequirements(undefined)).toBe(0)
    })

    it("counts needed and in_progress flags with dynamic keys", () => {
      expect(countActiveRequirements({ ecomm_on_figure: "needed", lifestyle: "in_progress" })).toBe(2)
      expect(countActiveRequirements({ ecomm_on_figure: "delivered", lifestyle: "not_needed" })).toBe(0)
      expect(countActiveRequirements({ ecomm_on_figure: "needed", video: "delivered", other: "in_progress" })).toBe(2)
    })

    it("handles legacy keys", () => {
      expect(countActiveRequirements({ ecomm: "needed", campaign: "in_progress" })).toBe(2)
    })

    it("ignores other_label key", () => {
      expect(countActiveRequirements({ ecomm_on_figure: "needed", other_label: "Custom type" })).toBe(1)
    })

    it("excludes ai_generated flag from active count", () => {
      expect(countActiveRequirements({ ecomm_on_figure: "ai_generated", lifestyle: "needed" })).toBe(1)
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
      expect(formatLaunchDate(null)).toBe("\u2014")
      expect(formatLaunchDate(undefined)).toBe("\u2014")
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

    it("counts flags across multiple skus with new keys", () => {
      const skus = [
        makeSku({ ecomm_on_figure: "needed", lifestyle: "delivered" }),
        makeSku({ ecomm_on_figure: "in_progress", video: "needed" }),
      ]
      expect(summarizeSkuAssetFlags(skus)).toEqual({ total: 4, needed: 2, inProgress: 1, delivered: 1 })
    })

    it("ignores not_needed flags in totals", () => {
      const skus = [makeSku({ ecomm_on_figure: "not_needed", lifestyle: "needed" })]
      expect(summarizeSkuAssetFlags(skus)).toEqual({ total: 1, needed: 1, inProgress: 0, delivered: 0 })
    })

    it("ignores other_label key", () => {
      const skus = [makeSku({ other: "needed", other_label: "Custom" })]
      expect(summarizeSkuAssetFlags(skus)).toEqual({ total: 1, needed: 1, inProgress: 0, delivered: 0 })
    })

    it("counts ai_generated flag in total but not as needed/in_progress/delivered", () => {
      const skus = [makeSku({ ecomm_on_figure: "ai_generated", lifestyle: "needed" })]
      const result = summarizeSkuAssetFlags(skus)
      expect(result.total).toBe(2)
      expect(result.needed).toBe(1)
    })
  })

  describe("resolveSkuLaunchDate", () => {
    const familyDate = Timestamp.fromDate(new Date(2026, 5, 1))
    const skuDate = Timestamp.fromDate(new Date(2026, 4, 15))

    it("returns SKU launch date when present", () => {
      const sku = { id: "s1", name: "S1", launchDate: skuDate } as ProductSku
      expect(resolveSkuLaunchDate(sku, familyDate)).toBe(skuDate)
    })

    it("falls back to family launch date", () => {
      const sku = { id: "s1", name: "S1" } as ProductSku
      expect(resolveSkuLaunchDate(sku, familyDate)).toBe(familyDate)
    })

    it("returns null when neither present", () => {
      const sku = { id: "s1", name: "S1" } as ProductSku
      expect(resolveSkuLaunchDate(sku, null)).toBeNull()
    })
  })

  describe("resolveEarliestLaunchDate", () => {
    const familyDate = Timestamp.fromDate(new Date(2026, 5, 1))
    const earlySkuDate = Timestamp.fromDate(new Date(2026, 3, 15))
    const lateSkuDate = Timestamp.fromDate(new Date(2026, 7, 1))

    it("returns family date when no SKU dates", () => {
      expect(resolveEarliestLaunchDate(familyDate, [])).toBe(familyDate)
    })

    it("returns earliest SKU date when earlier than family", () => {
      const skus = [
        { id: "s1", name: "S1", launchDate: earlySkuDate },
        { id: "s2", name: "S2", launchDate: lateSkuDate },
      ] as ProductSku[]
      const result = resolveEarliestLaunchDate(familyDate, skus)
      expect(result).toBe(earlySkuDate)
    })

    it("returns family date when earlier than all SKU dates", () => {
      const skus = [
        { id: "s1", name: "S1", launchDate: lateSkuDate },
      ] as ProductSku[]
      expect(resolveEarliestLaunchDate(familyDate, skus)).toBe(familyDate)
    })

    it("returns null when no dates at all", () => {
      const skus = [{ id: "s1", name: "S1" }] as ProductSku[]
      expect(resolveEarliestLaunchDate(null, skus)).toBeNull()
    })
  })
})
