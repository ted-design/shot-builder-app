import { describe, it, expect } from "vitest"
import { deriveDividerSpec } from "../blockSpec"
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

  it("is pure — equal input yields an equal spec", () => {
    const block: DividerBlock = { id: "d3", type: "divider", style: "dotted" }
    expect(deriveDividerSpec(block)).toEqual(deriveDividerSpec(block))
  })
})
