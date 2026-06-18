import { describe, it, expect } from "vitest"
import {
  PAGE_DIMENSIONS_PT,
  PREVIEW_PAGE_WIDTH_PX,
  getPageDimensionsPt,
  getPreviewPageDimensions,
} from "../pageDimensions"

describe("getPageDimensionsPt", () => {
  it("returns canonical points for portrait sizes", () => {
    expect(getPageDimensionsPt("letter", "portrait")).toEqual(PAGE_DIMENSIONS_PT.letter)
    expect(getPageDimensionsPt("a4", "portrait")).toEqual(PAGE_DIMENSIONS_PT.a4)
    expect(getPageDimensionsPt("legal", "portrait")).toEqual(PAGE_DIMENSIONS_PT.legal)
  })

  it("swaps width/height for landscape", () => {
    const { width, height } = getPageDimensionsPt("letter", "landscape")
    expect(width).toBe(PAGE_DIMENSIONS_PT.letter.height)
    expect(height).toBe(PAGE_DIMENSIONS_PT.letter.width)
    expect(width).toBeGreaterThan(height)
  })

  it("defaults to Letter portrait for missing/unknown size+layout", () => {
    expect(getPageDimensionsPt(undefined, undefined)).toEqual(PAGE_DIMENSIONS_PT.letter)
    // unknown size key still falls back to letter
    expect(getPageDimensionsPt("tabloid" as never, "portrait")).toEqual(
      PAGE_DIMENSIONS_PT.letter,
    )
  })
})

describe("getPreviewPageDimensions", () => {
  it("is fit-to-width: width is constant, min-height tracks the aspect ratio", () => {
    const portrait = getPreviewPageDimensions("letter", "portrait")
    expect(portrait.width).toBe(PREVIEW_PAGE_WIDTH_PX)
    expect(portrait.minHeight).toBe(1242) // 960 * 792/612

    const landscape = getPreviewPageDimensions("letter", "landscape")
    expect(landscape.width).toBe(PREVIEW_PAGE_WIDTH_PX)
    expect(landscape.minHeight).toBe(742) // 960 * 612/792
    expect(landscape.minHeight).toBeLessThan(portrait.minHeight)
  })

  it("distinguishes A4 from Legal", () => {
    expect(getPreviewPageDimensions("a4", "portrait").minHeight).toBe(1358)
    expect(getPreviewPageDimensions("legal", "portrait").minHeight).toBe(1581)
  })
})
