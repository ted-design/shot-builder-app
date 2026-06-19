import { describe, it, expect } from "vitest"
import { deriveDividerSpec } from "../blockSpec"
import { pxToPt } from "../units"
import type { DividerBlock } from "../../types/exportBuilder"

// Layer 1 — spec unit. The resolved spec is the single source of truth both
// renderers consume; snapshot it so a default/value change is an owned diff.

describe("deriveDividerSpec", () => {
  it("resolves defaults from a bare divider block", () => {
    const block: DividerBlock = { id: "d1", type: "divider" }
    expect(deriveDividerSpec(block)).toEqual({
      kind: "divider",
      lineStyle: "solid",
      color: "#D1D5DB",
      thicknessPx: 1,
      marginYPx: 8,
    })
  })

  it("passes through an explicit style and color", () => {
    const block: DividerBlock = {
      id: "d2",
      type: "divider",
      style: "dashed",
      color: "#abc123",
    }
    expect(deriveDividerSpec(block)).toMatchObject({
      lineStyle: "dashed",
      color: "#abc123",
    })
  })

  it("does not mutate the input block", () => {
    const block: DividerBlock = { id: "d3", type: "divider", style: "dotted" }
    const before = structuredClone(block)
    deriveDividerSpec(block)
    expect(block).toEqual(before)
  })
})

describe("pxToPt", () => {
  it("converts against the physical constant (96px = 72pt = 1in)", () => {
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(1)).toBeCloseTo(0.75)
    expect(pxToPt(8)).toBeCloseTo(6)
  })
})
