import { describe, it, expect } from "vitest"
import { qtyGlyph } from "../qtyGlyph"

// Canonical pending-qty glyph. A resolved qty renders "×N"; a pending qty (null)
// renders the em-dash "—" — NOT the image-led "×—" the primitives supersede.
describe("qtyGlyph", () => {
  it("renders ×N for a resolved qty", () => {
    expect(qtyGlyph(1)).toBe("×1")
    expect(qtyGlyph(12)).toBe("×12")
  })

  it("renders 0 as ×0 (not pending)", () => {
    expect(qtyGlyph(0)).toBe("×0")
  })

  it("renders the em-dash for a pending (null) qty — kills the ×— fork", () => {
    expect(qtyGlyph(null)).toBe("—")
    expect(qtyGlyph(null)).not.toBe("×—")
  })
})
