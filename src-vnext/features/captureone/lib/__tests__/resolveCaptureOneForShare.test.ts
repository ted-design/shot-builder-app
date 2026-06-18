import { describe, expect, it } from "vitest"
import {
  buildShotFilenames,
  shotHeroAssignments,
} from "@/features/captureone/lib/resolveCaptureOneForShare"

describe("shotHeroAssignments", () => {
  it("collects starred heroes across all looks (dedup deferred to the filename layer)", () => {
    const heroes = shotHeroAssignments({
      looks: [
        {
          id: "look-1",
          products: [
            { familyId: "fam-a", skuId: "sku-a", isHero: true },
            { familyId: "fam-b", skuId: "sku-b" },
          ],
        },
        {
          id: "look-2",
          products: [{ familyId: "fam-c", skuId: "sku-c", isHero: true }],
        },
      ],
    })
    expect(heroes.map((p) => p.skuId)).toEqual(["sku-a", "sku-c"])
  })

  it("falls back to a look's legacy heroProductId when no product is starred", () => {
    const heroes = shotHeroAssignments({
      looks: [
        {
          id: "look-1",
          heroProductId: "sku-b",
          products: [
            { familyId: "fam-a", skuId: "sku-a" },
            { familyId: "fam-b", skuId: "sku-b" },
          ],
        },
      ],
    })
    expect(heroes.map((p) => p.skuId)).toEqual(["sku-b"])
  })

  it("resolves a legacy heroProductId pointing at a raw productId (normalized to familyId)", () => {
    const heroes = shotHeroAssignments({
      looks: [
        {
          id: "look-1",
          heroProductId: "prod-123",
          products: [
            { productId: "prod-123", productName: "Merino Tee", colourName: "Black" },
            { productId: "prod-999", productName: "Other", colourName: "White" },
          ],
        },
      ],
    })
    expect(heroes).toHaveLength(1)
    expect(heroes[0]!.familyId).toBe("prod-123")
    expect(heroes[0]!.familyName).toBe("Merino Tee")
  })

  it("returns no heroes for a look-less shot (top-level products without isHero)", () => {
    expect(
      shotHeroAssignments({ products: [{ familyId: "fam-a", skuId: "sku-a" }] }),
    ).toEqual([])
  })
})

describe("buildShotFilenames", () => {
  const gender = new Map<string, string | null>([
    ["fam-m", "men"],
    ["fam-w", "women"],
    ["fam-x", null],
  ])

  it("builds gender-prefixed PascalCase filenames with colorway, hyphens preserved", () => {
    const files = buildShotFilenames(
      [
        { familyId: "fam-m", familyName: "Merino Flex Jogger", colourName: "Forest" },
        { familyId: "fam-w", familyName: "Linen Button-Up", colourName: "Light Azure" },
      ],
      gender,
    )
    expect(files.map((f) => f.name)).toEqual([
      "M_MerinoFlexJogger_Forest",
      "W_LinenButton-Up_LightAzure",
    ])
    expect(files.every((f) => f.genderResolved)).toBe(true)
  })

  it("flags an unresolved gender with genderResolved=false and a U_ prefix", () => {
    const files = buildShotFilenames(
      [{ familyId: "fam-x", familyName: "Mystery Tee", colourName: "Black" }],
      gender,
    )
    expect(files[0]!.name).toBe("U_MysteryTee_Black")
    expect(files[0]!.genderResolved).toBe(false)
  })

  it("keeps distinct colourways with no colourId as separate filenames", () => {
    const files = buildShotFilenames(
      [
        { familyId: "fam-m", familyName: "Tee", colourName: "Black", isHero: true },
        { familyId: "fam-m", familyName: "Tee", colourName: "White", isHero: true },
      ],
      gender,
    )
    expect(files.map((f) => f.name)).toEqual(["M_Tee_Black", "M_Tee_White"])
  })

  it("collapses same garment + colour across different sizes to one filename", () => {
    const files = buildShotFilenames(
      [
        { familyId: "fam-m", familyName: "Tee", colourName: "Black", skuId: "sku-1" },
        { familyId: "fam-m", familyName: "Tee", colourName: "Black", skuId: "sku-2" },
      ],
      gender,
    )
    expect(files.map((f) => f.name)).toEqual(["M_Tee_Black"])
  })

  it("skips a hero with no resolvable product name (never emits an empty-segment filename)", () => {
    expect(
      buildShotFilenames([{ familyId: "fam-m", colourName: "Black" }], gender),
    ).toEqual([])
  })
})
