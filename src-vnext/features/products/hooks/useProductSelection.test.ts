import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useProductSelection,
  makeFamilySelectionId,
  makeSkuSelectionId,
} from "./useProductSelection"

describe("makeFamilySelectionId", () => {
  it("produces fam: prefixed id", () => {
    expect(makeFamilySelectionId("fam1", "Classic Tee")).toBe("fam:fam1:Classic Tee")
  })
})

describe("makeSkuSelectionId", () => {
  it("produces sku: prefixed id with pipe separators", () => {
    expect(makeSkuSelectionId("fam1", "Classic Tee", "sku1", "Black")).toBe(
      "sku:fam1|Classic Tee|sku1|Black",
    )
  })
})

describe("useProductSelection", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(() => useProductSelection())
    expect(result.current.count).toBe(0)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it("toggle adds an id", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.toggle("fam:fam1:Tee")
    })
    expect(result.current.count).toBe(1)
    expect(result.current.isSelected("fam:fam1:Tee")).toBe(true)
  })

  it("toggle removes an already-selected id", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.toggle("fam:fam1:Tee")
    })
    act(() => {
      result.current.toggle("fam:fam1:Tee")
    })
    expect(result.current.count).toBe(0)
    expect(result.current.isSelected("fam:fam1:Tee")).toBe(false)
  })

  it("toggle is immutable — returns new Set each time", () => {
    const { result } = renderHook(() => useProductSelection())
    const before = result.current.selectedIds
    act(() => {
      result.current.toggle("fam:fam1:Tee")
    })
    expect(result.current.selectedIds).not.toBe(before)
  })

  it("selectAll replaces selection with provided ids", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.toggle("fam:fam1:Tee")
    })
    act(() => {
      result.current.selectAll(["fam:fam2:Polo", "fam:fam3:Jacket"])
    })
    expect(result.current.count).toBe(2)
    expect(result.current.isSelected("fam:fam1:Tee")).toBe(false)
    expect(result.current.isSelected("fam:fam2:Polo")).toBe(true)
    expect(result.current.isSelected("fam:fam3:Jacket")).toBe(true)
  })

  it("clearAll empties the selection", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.selectAll(["fam:fam1:Tee", "fam:fam2:Polo"])
    })
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.count).toBe(0)
  })

  it("getSelectedFamilies returns parsed family objects", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.selectAll([
        makeFamilySelectionId("fam1", "Classic Tee"),
        makeFamilySelectionId("fam2", "Slim Polo"),
      ])
    })
    const families = result.current.getSelectedFamilies()
    expect(families).toHaveLength(2)
    expect(families).toEqual(
      expect.arrayContaining([
        { familyId: "fam1", familyName: "Classic Tee" },
        { familyId: "fam2", familyName: "Slim Polo" },
      ]),
    )
  })

  it("getSelectedFamilies ignores sku: entries", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.selectAll([
        makeFamilySelectionId("fam1", "Tee"),
        makeSkuSelectionId("fam2", "Polo", "sku1", "Black"),
      ])
    })
    const families = result.current.getSelectedFamilies()
    expect(families).toHaveLength(1)
    expect(families[0]!.familyId).toBe("fam1")
  })

  it("getSelectedSkus returns parsed sku objects", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.selectAll([
        makeSkuSelectionId("fam1", "Tee", "sku1", "Black"),
        makeSkuSelectionId("fam1", "Tee", "sku2", "White"),
      ])
    })
    const skus = result.current.getSelectedSkus()
    expect(skus).toHaveLength(2)
    expect(skus).toEqual(
      expect.arrayContaining([
        { familyId: "fam1", familyName: "Tee", skuId: "sku1", skuName: "Black" },
        { familyId: "fam1", familyName: "Tee", skuId: "sku2", skuName: "White" },
      ]),
    )
  })

  it("getSelectedSkus ignores fam: entries", () => {
    const { result } = renderHook(() => useProductSelection())
    act(() => {
      result.current.selectAll([
        makeFamilySelectionId("fam1", "Tee"),
        makeSkuSelectionId("fam2", "Polo", "sku1", "Black"),
      ])
    })
    const skus = result.current.getSelectedSkus()
    expect(skus).toHaveLength(1)
    expect(skus[0]!.skuId).toBe("sku1")
  })

  it("isSelected returns false for unknown id", () => {
    const { result } = renderHook(() => useProductSelection())
    expect(result.current.isSelected("fam:unknown:Unknown")).toBe(false)
  })
})
