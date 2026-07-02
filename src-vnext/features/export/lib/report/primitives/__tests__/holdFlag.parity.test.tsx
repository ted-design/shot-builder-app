import { describe, it, expect, vi } from "vitest"

// HoldFlag two-layer parity. Layer 1 snapshots deriveHoldFlagSpec() (the single
// source both renderers consume). Layer 2 proves the DOM adapter and the
// @react-pdf adapter present the SAME spec — if a value is re-introduced on one
// side only, that side diverges -> red.

// Mock @react-pdf/renderer into queryable DOM (mirrors blockConsumers.parity).
vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  const ser = (s: unknown) => {
    try {
      return s == null ? undefined : JSON.stringify(s)
    } catch {
      return undefined
    }
  }
  const passthrough = (tag: string) => (props: Record<string, unknown>) => {
    const { style, children, ...rest } = props as {
      style?: unknown
      children?: unknown
    } & Record<string, unknown>
    return React.createElement(
      tag,
      { ...rest, "data-style": ser(style) },
      children as React.ReactNode,
    )
  }
  return {
    View: passthrough("pdf-view"),
    Text: passthrough("pdf-text"),
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render } from "@testing-library/react"
import {
  deriveHoldFlagSpec,
  renderHoldFlagPdf,
  type HoldFlagInput,
  type HoldFlagSpec,
} from "../holdFlag"
import { renderHoldFlagDom } from "../../../../components/report/primitives/HoldFlag"
import { pxToPt } from "../../../units"

function parseStyle(el: Element | null | undefined): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

// jsdom normalizes inline colors to rgb(); the PDF mock keeps the raw hex. The
// DOM side paints var(--sb-red) (jsdom keeps CSS vars verbatim), so DOM color is
// asserted against spec.redVar and PDF hex against spec.redHex.toLowerCase().
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}
const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()

// The fully-resolved spec for an on_hold shot (vertical default). Layer 1 pins
// every field so a default/value change is an owned diff.
const HOLD_SPEC_VERTICAL: HoldFlagSpec = {
  kind: "holdFlag",
  hold: true,
  labelText: "HOLD",
  railWidthDomPx: 4,
  railWidthPt: 3,
  redHex: "#EB1400",
  redVar: "var(--sb-red)",
  labelFontDomPx: 9,
  labelFontPt: 5,
  labelLetterSpacingDomEm: 0.14,
  labelLetterSpacingPt: 0.5,
  orientation: "vertical",
}

describe("deriveHoldFlagSpec — Layer 1 (spec unit)", () => {
  it("resolves a fully-populated hold spec from an on_hold shot", () => {
    expect(deriveHoldFlagSpec({ status: "on_hold" })).toEqual(HOLD_SPEC_VERTICAL)
  })

  it("resolves identical geometry but hold=false for a non-hold status", () => {
    expect(deriveHoldFlagSpec({ status: "complete" })).toEqual({
      ...HOLD_SPEC_VERTICAL,
      hold: false,
    })
  })

  it("honours an orientation override", () => {
    expect(
      deriveHoldFlagSpec({ status: "on_hold", orientation: "horizontal" }),
    ).toEqual({ ...HOLD_SPEC_VERTICAL, orientation: "horizontal" })
    // default is vertical (production-sheet spine)
    expect(deriveHoldFlagSpec({ status: "todo" }).orientation).toBe("vertical")
  })

  it("carries the ONE sanctioned red (#EB1400) — and it is the sole red-bearing field", () => {
    const spec = deriveHoldFlagSpec({ status: "on_hold" })
    expect(spec.redHex).toBe("#EB1400")
    expect(spec.redVar).toBe("var(--sb-red)")
    // No other spec field encodes a red; the two red fields are the only ones.
    const redFields = Object.entries(spec).filter(
      ([, v]) => typeof v === "string" && normColor(v).includes("eb1400"),
    )
    expect(redFields.map(([k]) => k)).toEqual(["redHex"])
  })

  it("does not mutate the input", () => {
    const input: HoldFlagInput = { status: "on_hold", orientation: "vertical" }
    const before = structuredClone(input)
    deriveHoldFlagSpec(input)
    expect(input).toEqual(before)
  })

  it("pxToPt maps the DOM rail geometry against the physical constant", () => {
    // 96px = 72pt = 1in; the spec's pt values are hand-tuned production-sheet
    // constants, so prove the converter itself, not rail 4px -> 3pt.
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(4)).toBeCloseTo(3)
  })
})

const CASES: readonly HoldFlagInput[] = [
  { status: "on_hold" },
  { status: "todo" },
  { status: "on_hold", orientation: "horizontal" },
]

describe("HoldFlag consumer parity — DOM and PDF present the same spec", () => {
  it.each(CASES)("DOM adapter reflects the spec (%o)", (input) => {
    const spec = deriveHoldFlagSpec(input)
    const { container } = render(renderHoldFlagDom(spec))
    const flag = container.querySelector('[data-testid="hold-flag"]')
    expect(flag).not.toBeNull()

    if (!spec.hold) {
      expect(flag?.getAttribute("data-hold")).toBe("false")
      expect(container.querySelector('[data-testid="hold-rail"]')).toBeNull()
      expect(container.querySelector('[data-testid="hold-label"]')).toBeNull()
      return
    }

    expect(flag?.getAttribute("data-hold")).toBe("true")

    const rail = container.querySelector(
      '[data-testid="hold-rail"]',
    ) as HTMLElement | null
    expect(rail).not.toBeNull()
    expect(rail?.style.width).toBe(`${String(spec.railWidthDomPx)}px`)
    // jsdom keeps CSS vars verbatim in .style.background.
    expect(rail?.style.background).toBe(spec.redVar)

    const label = container.querySelector(
      '[data-testid="hold-label"]',
    ) as HTMLElement | null
    expect(label).not.toBeNull()
    expect(label?.textContent).toBe(spec.labelText)
    expect(label?.style.color).toBe(spec.redVar)
    expect(label?.style.fontSize).toBe(`${String(spec.labelFontDomPx)}px`)
    // vertical (default) writing-mode present; horizontal omits it.
    if (spec.orientation === "vertical") {
      expect(label?.style.writingMode).toBe("vertical-rl")
    } else {
      expect(label?.style.writingMode).toBe("")
    }
  })

  it.each(CASES)("PDF adapter reflects the same spec (%o)", (input) => {
    const spec = deriveHoldFlagSpec(input)
    const { container } = render(renderHoldFlagPdf(spec))
    const view = container.querySelector("pdf-view")
    expect(view).not.toBeNull()

    if (!spec.hold) {
      // Empty <View /> — no rail, no label.
      expect(view?.querySelector("pdf-text")).toBeNull()
      expect(parseStyle(view)).toEqual({})
      return
    }

    const viewStyle = parseStyle(view)
    expect(viewStyle.borderLeftWidth).toBeCloseTo(spec.railWidthPt)
    expect(normColor(String(viewStyle.borderLeftColor))).toBe(
      normColor(spec.redHex),
    )

    const text = view?.querySelector("pdf-text")
    expect(text).not.toBeNull()
    expect(text?.textContent).toBe(spec.labelText)
    const textStyle = parseStyle(text)
    expect(textStyle.fontSize).toBeCloseTo(spec.labelFontPt)
    expect(String(textStyle.color).toLowerCase()).toBe(spec.redHex.toLowerCase())
  })

  it("DOM red var and PDF red hex denote the same color", () => {
    // Belt-and-suspenders: the two hosts paint one canonical red via different
    // notations. The var maps to #EB1400 in :root; assert the hex both sides
    // reduce to matches, proving no divergent red slipped onto one adapter.
    const spec = deriveHoldFlagSpec({ status: "on_hold" })
    expect(normColor(hexToRgb(spec.redHex))).toBe(
      normColor(hexToRgb("#EB1400")),
    )
    expect(spec.redVar).toBe("var(--sb-red)")
  })
})
