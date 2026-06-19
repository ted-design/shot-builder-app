import { describe, it, expect } from "vitest"
import { deriveDividerSpec, deriveTextSpec } from "../blockSpec"
import { pxToPt } from "../units"
import type {
  DividerBlock,
  ExportVariable,
  TextBlock,
} from "../../types/exportBuilder"

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

const VARS: readonly ExportVariable[] = [
  { key: "projectName", label: "Project Name", value: "Acme Shoot", source: "dynamic" },
  { key: "pageNumber", label: "Page Number", value: "{{pageNumber}}", source: "dynamic" },
  { key: "pageCount", label: "Page Count", value: "{{pageCount}}", source: "dynamic" },
]

function textBlock(content: string, typography?: TextBlock["typography"]): TextBlock {
  return { id: "t1", type: "text", content, typography }
}

describe("deriveTextSpec", () => {
  it("resolves canonical defaults for plain body text", () => {
    const spec = deriveTextSpec(textBlock("Hello"), { variables: [] })
    expect(spec.isEmpty).toBe(false)
    expect(spec.typography).toEqual({
      fontSizePx: 14,
      fontWeight: undefined,
      textAlign: "left",
      color: "#111827",
      fontFamily: "Inter",
      lineHeight: 1.5,
      highlightColor: undefined,
      isHeading: false,
    })
    expect(spec.segments).toEqual([
      { kind: "plainText", runs: [{ text: "Hello", unresolved: false }] },
    ])
  })

  it("derives heading size + weight from blockType (px-canonical)", () => {
    const h2 = deriveTextSpec(textBlock("Title", { blockType: "h2" }), { variables: [] })
    expect(h2.typography.fontSizePx).toBe(20)
    expect(h2.typography.fontWeight).toBe(700)
    expect(h2.typography.isHeading).toBe(true)
    // px-canonical: pdf side is pxToPt(20) = 15pt (the h2 14->15 shift).
    expect(pxToPt(h2.typography.fontSizePx)).toBeCloseTo(15)
  })

  it("resolves known variables to values", () => {
    const spec = deriveTextSpec(textBlock("By {{projectName}}"), { variables: VARS })
    expect(spec.segments).toEqual([
      { kind: "plainText", runs: [{ text: "By Acme Shoot", unresolved: false }] },
    ])
  })

  it("keeps render tokens as markers", () => {
    const spec = deriveTextSpec(textBlock("Page {{pageNumber}} of {{pageCount}}"), {
      variables: VARS,
    })
    expect(spec.segments).toEqual([
      { kind: "plainText", runs: [{ text: "Page ", unresolved: false }] },
      { kind: "renderToken", token: "pageNumber" },
      { kind: "plainText", runs: [{ text: " of ", unresolved: false }] },
      { kind: "renderToken", token: "pageCount" },
    ])
  })

  it("flags unresolved tokens for warning paint", () => {
    const spec = deriveTextSpec(textBlock("Hi {{bogus}}"), { variables: VARS })
    expect(spec.segments).toEqual([
      {
        kind: "plainText",
        runs: [
          { text: "Hi ", unresolved: false },
          { text: "{{bogus}}", unresolved: true },
        ],
      },
    ])
  })

  it("parses HTML content into rich nodes", () => {
    const spec = deriveTextSpec(textBlock("<b>bold</b>"), { variables: [] })
    expect(spec.segments).toHaveLength(1)
    const seg = spec.segments[0]
    expect(seg?.kind).toBe("richText")
    if (seg?.kind === "richText") {
      expect(seg.nodes).toContainEqual({ text: "bold", bold: true })
    }
  })

  it("marks an empty block and emits no segments", () => {
    const spec = deriveTextSpec(textBlock(""), { variables: VARS })
    expect(spec.isEmpty).toBe(true)
    expect(spec.segments).toEqual([])
  })

  it("does not mutate the input block", () => {
    const block = textBlock("Hi {{projectName}}", { blockType: "h1" })
    const before = structuredClone(block)
    deriveTextSpec(block, { variables: VARS })
    expect(block).toEqual(before)
  })
})
