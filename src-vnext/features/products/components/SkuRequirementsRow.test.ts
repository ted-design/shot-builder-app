import { describe, it, expect } from "vitest"
import { ASSET_TYPES, LEGACY_ASSET_TYPES } from "@/features/products/lib/assetRequirements"

/**
 * Test the TYPE_LABELS derivation logic used by SkuRequirementsRow.
 * The component builds a Record<string, string> from ASSET_TYPES + LEGACY_ASSET_TYPES.
 * We verify the merged map contains all expected keys and labels.
 */

const TYPE_LABELS: Record<string, string> = Object.fromEntries([
  ...ASSET_TYPES.map((t) => [t.key, t.label]),
  ...LEGACY_ASSET_TYPES.map((t) => [t.key, t.label]),
])

describe("SkuRequirementsRow TYPE_LABELS", () => {
  it("contains all 6 canonical asset type keys", () => {
    const canonicalKeys = [
      "ecomm_on_figure",
      "lifestyle",
      "off_figure_pinup",
      "off_figure_detail",
      "video",
      "other",
    ]
    for (const key of canonicalKeys) {
      expect(TYPE_LABELS).toHaveProperty(key)
    }
  })

  it("contains all 3 legacy asset type keys", () => {
    const legacyKeys = ["ecomm", "campaign", "ai_generated"]
    for (const key of legacyKeys) {
      expect(TYPE_LABELS).toHaveProperty(key)
    }
  })

  it("has exactly 9 total entries (6 canonical + 3 legacy)", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(9)
  })

  it("maps each key to a human-readable label string", () => {
    for (const [key, label] of Object.entries(TYPE_LABELS)) {
      expect(typeof label).toBe("string")
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toBe(key)
    }
  })

  it("canonical labels match expected values", () => {
    expect(TYPE_LABELS["ecomm_on_figure"]).toBe("E-commerce (on-figure)")
    expect(TYPE_LABELS["lifestyle"]).toBe("Lifestyle / Campaign")
    expect(TYPE_LABELS["off_figure_pinup"]).toBe("Off-figure (pinups / flatlays)")
    expect(TYPE_LABELS["off_figure_detail"]).toBe("Off-figure (fabric / detail)")
    expect(TYPE_LABELS["video"]).toBe("Video")
    expect(TYPE_LABELS["other"]).toBe("Other (specify)")
  })

  it("legacy labels include (legacy) suffix", () => {
    expect(TYPE_LABELS["ecomm"]).toContain("legacy")
    expect(TYPE_LABELS["campaign"]).toContain("legacy")
    expect(TYPE_LABELS["ai_generated"]).toContain("legacy")
  })

  it("does not contain other_label (excluded from chip logic)", () => {
    expect(TYPE_LABELS).not.toHaveProperty("other_label")
  })
})
