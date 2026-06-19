import { describe, it, expect, vi } from "vitest"

// Layer 2 — consumer parity. Proves BOTH renderers consume the same resolved
// spec (not a re-derived copy): from one block we render the preview <hr> and
// the pdf <View> and assert each reflects deriveDividerSpec(block). If someone
// re-introduces a default/value on one side only, that side diverges -> red.

// Mock @react-pdf/renderer into queryable DOM (mirrors ShotGridBlockPdf.test).
vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  const ser = (s: unknown) => {
    try {
      return s == null ? undefined : JSON.stringify(s)
    } catch {
      return undefined
    }
  }
  return {
    View: (props: Record<string, unknown>) => {
      const { style, children, ...rest } = props as {
        style?: unknown
        children?: unknown
      } & Record<string, unknown>
      return React.createElement(
        "pdf-view",
        { ...rest, "data-style": ser(style) },
        children as React.ReactNode,
      )
    },
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render } from "@testing-library/react"
import { DividerBlockView } from "../../../../components/blocks/DividerBlockView"
import { DividerBlockPdf } from "../DividerBlockPdf"
import { deriveDividerSpec } from "../../../blockSpec"
import { pxToPt } from "../../specAdapters/pdf"
import type { DividerBlock } from "../../../../types/exportBuilder"

function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

// jsdom normalizes inline colors to rgb(); the PDF mock keeps the raw hex. Compare
// both via a whitespace/case-insensitive rgb form so a color value is asserted, not its notation.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}

const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()

const CASES: readonly DividerBlock[] = [
  { id: "d1", type: "divider" },
  { id: "d2", type: "divider", style: "dashed", color: "#abc123" },
  { id: "d3", type: "divider", style: "dotted" },
]

describe("Divider consumer parity — preview and pdf consume the same spec", () => {
  it.each(CASES)("preview <hr> reflects the spec (%o)", (block) => {
    const spec = deriveDividerSpec(block)
    const { container } = render(<DividerBlockView block={block} />)
    const hr = container.querySelector("hr")
    expect(hr).not.toBeNull()
    expect(hr?.style.borderTopStyle).toBe(spec.lineStyle)
    expect(hr?.style.borderTopWidth).toBe(`${String(spec.thicknessPx)}px`)
    expect(normColor(hr?.style.borderTopColor ?? "")).toBe(
      normColor(hexToRgb(spec.color)),
    )
  })

  it.each(CASES)("pdf <View> reflects the same spec, px->pt (%o)", (block) => {
    const spec = deriveDividerSpec(block)
    const { container } = render(<DividerBlockPdf block={block} />)
    const style = parseStyle(container.querySelector("pdf-view"))
    expect(style.borderBottomStyle).toBe(spec.lineStyle)
    expect(String(style.borderBottomColor).toLowerCase()).toBe(
      spec.color.toLowerCase(),
    )
    expect(style.borderBottomWidth).toBeCloseTo(pxToPt(spec.thicknessPx))
    expect(style.marginVertical).toBeCloseTo(pxToPt(spec.marginYPx))
  })
})
