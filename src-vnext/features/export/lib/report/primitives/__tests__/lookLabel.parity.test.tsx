import { describe, it, expect, vi } from "vitest"

// Two-layer parity for the canonical LookLabel primitive.
//
// Layer 1 — spec unit: snapshot deriveLookLabelSpec() so a default/value change
//   is an owned diff, and pin the invariants (verbatim label, variant/count
//   resolution, alt tint, non-mutation, px->pt).
// Layer 2 — adapter parity: from ONE spec, render the DOM adapter and the
//   @react-pdf adapter and assert each reflects that SAME spec. If someone forks
//   a value on one side (e.g. re-introduces `.toUpperCase()`), that side
//   diverges -> red.

// Mock @react-pdf/renderer into queryable DOM (mirrors blockConsumers.parity.test).
vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  const ser = (s: unknown) => {
    try {
      return s == null ? undefined : JSON.stringify(s)
    } catch {
      return undefined
    }
  }
  const passthrough =
    (tag: string) => (props: Record<string, unknown>) => {
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
  deriveLookLabelSpec,
  LookLabelPdf,
  type LookLabelInput,
  type LookLabelSpec,
} from "../lookLabel"
import { LookLabelDom } from "../../../../components/report/primitives/LookLabel"
import { pxToPt } from "../../../units"
import { COLOR } from "../../reportPdfShared"

function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

// jsdom normalizes inline colors to rgb(); the PDF mock keeps the raw hex. Compare
// both via a whitespace/case-insensitive rgb form so a color value is asserted,
// not its notation.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}
const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()

// ---------------------------------------------------------------------------
// Layer 1 — deriveLookLabelSpec
// ---------------------------------------------------------------------------
describe("deriveLookLabelSpec", () => {
  it("resolves the rule variant from a bare (no-count) input", () => {
    const spec = deriveLookLabelSpec({ label: "Primary", isAlt: false })
    expect(spec).toEqual({
      kind: "lookLabel",
      label: "Primary",
      isAlt: false,
      variant: "rule",
      countText: null,
      labelFontDomPx: 10,
      labelFontPt: 7,
      labelLetterSpacingDomEm: 0.12,
      labelLetterSpacingPt: 1,
      labelColorVar: "var(--sb-ink)",
      labelColorHex: COLOR.text,
      countFontDomPx: 9,
      countFontPt: 5.5,
      countColorVar: "var(--sb-ink-3)",
      countColorHex: COLOR.textSubtle,
    } satisfies LookLabelSpec)
  })

  it("resolves the chip variant (alt, N pieces) from a counted input", () => {
    const spec = deriveLookLabelSpec({ label: "Alt 1", isAlt: true, pieceCount: 3 })
    expect(spec).toEqual({
      kind: "lookLabel",
      label: "Alt 1",
      isAlt: true,
      variant: "chip",
      countText: "3 pieces",
      labelFontDomPx: 10,
      labelFontPt: 6.5,
      labelLetterSpacingDomEm: 0.12,
      labelLetterSpacingPt: 0.8,
      labelColorVar: "var(--sb-ink-2)",
      labelColorHex: COLOR.textSecondary,
      countFontDomPx: 9,
      countFontPt: 5.5,
      countColorVar: "var(--sb-ink-3)",
      countColorHex: COLOR.textSubtle,
    } satisfies LookLabelSpec)
  })

  it("singularizes the count for pieceCount === 1", () => {
    const spec = deriveLookLabelSpec({ label: "L", isAlt: false, pieceCount: 1 })
    expect(spec.variant).toBe("chip")
    expect(spec.countText).toBe("1 piece")
  })

  it("variantOverride forces chip even without a count", () => {
    const spec = deriveLookLabelSpec({
      label: "L",
      isAlt: false,
      variantOverride: "chip",
    })
    expect(spec.variant).toBe("chip")
    expect(spec.countText).toBeNull()
  })

  it("variantOverride forces rule even when a count is present", () => {
    const spec = deriveLookLabelSpec({
      label: "L",
      isAlt: false,
      pieceCount: 4,
      variantOverride: "rule",
    })
    expect(spec.variant).toBe("rule")
    expect(spec.countText).toBe("4 pieces")
  })

  it("carries the label VERBATIM — never upper-cased in the spec", () => {
    const input: LookLabelInput = { label: "Primary Look", isAlt: false }
    const spec = deriveLookLabelSpec(input)
    expect(spec.label).toBe(input.label) // exact, un-uppercased
    expect(spec.label).not.toBe(input.label.toUpperCase())
  })

  it("does not mutate the input", () => {
    const input: LookLabelInput = { label: "L", isAlt: true, pieceCount: 2 }
    const before = structuredClone(input)
    deriveLookLabelSpec(input)
    expect(input).toEqual(before)
  })
})

describe("pxToPt (LookLabel metric proof)", () => {
  it("converts the label DOM px to the spec pt within the shared constant", () => {
    // rule label: 10px DOM -> 7.5pt physical; spec's authored 7pt is intentionally
    // ~equal (editorial rounding), so assert the physical relationship holds.
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(10)).toBeCloseTo(7.5)
  })
})

// ---------------------------------------------------------------------------
// Layer 2 — adapter parity (DOM + PDF present the same spec)
// ---------------------------------------------------------------------------
const CASES: readonly LookLabelInput[] = [
  { label: "Primary", isAlt: false }, // rule, no count, primary
  { label: "Alt 1", isAlt: true }, // rule, no count, alt
  { label: "Look A", isAlt: false, pieceCount: 1 }, // chip, "1 piece"
  { label: "Look B", isAlt: true, pieceCount: 5 }, // chip, "5 pieces", alt
]

describe("LookLabel adapter parity — DOM and PDF present the same spec", () => {
  it.each(CASES)("DOM adapter reflects the spec (%o)", (input) => {
    const spec = deriveLookLabelSpec(input)
    const { container } = render(LookLabelDom(spec))

    const root = container.querySelector('[data-testid="look-label"]')
    expect(root).not.toBeNull()
    expect(root?.getAttribute("data-variant")).toBe(spec.variant)

    // Label: verbatim text (un-uppercased) + uppercase applied via CSS only.
    const label = container.querySelector<HTMLElement>(
      '[data-testid="look-label-text"]',
    )
    expect(label?.textContent).toBe(spec.label)
    expect(label?.style.textTransform).toBe("uppercase")
    expect(label?.style.fontSize).toBe(`${String(spec.labelFontDomPx)}px`)
    expect(label?.style.letterSpacing).toBe(
      `${String(spec.labelLetterSpacingDomEm)}em`,
    )
    expect(normColor(label?.style.color ?? "")).toBe(
      spec.labelColorVar.startsWith("var(")
        ? spec.labelColorVar // jsdom keeps var() verbatim
        : normColor(hexToRgb(spec.labelColorHex)),
    )

    if (spec.variant === "rule") {
      expect(
        container.querySelector('[data-testid="look-rule"]'),
      ).not.toBeNull()
      expect(container.querySelector('[data-testid="look-count"]')).toBeNull()
    } else {
      const count = container.querySelector<HTMLElement>(
        '[data-testid="look-count"]',
      )
      expect(count?.textContent).toBe(spec.countText)
      expect(count?.style.textTransform).toBe("none") // count stays "1 piece"
      expect(count?.style.color).toBe(spec.countColorVar)
    }
  })

  it.each(CASES)("PDF adapter reflects the same spec (%o)", (input) => {
    const spec = deriveLookLabelSpec(input)
    const { container } = render(LookLabelPdf(spec))

    const root = container.querySelector('[data-testid="look-label"]')
    expect(root).not.toBeNull()
    expect(root?.getAttribute("data-variant")).toBe(spec.variant)

    const texts = container.querySelectorAll("pdf-text")
    const label = texts[0]
    expect(label?.textContent).toBe(spec.label) // verbatim
    const labelStyle = parseStyle(label ?? null)
    expect(String(labelStyle.textTransform)).toBe("uppercase")
    expect(labelStyle.fontSize).toBeCloseTo(spec.labelFontPt)
    expect(String(labelStyle.color).toLowerCase()).toBe(
      spec.labelColorHex.toLowerCase(),
    )

    if (spec.variant === "rule") {
      // rule bar = a pdf-view painted COLOR.rule (#E4E4E7).
      const bars = container.querySelectorAll("pdf-view")
      // bars[0] is the row container; bars[1] is the rule line.
      const barStyle = parseStyle(bars[1] ?? null)
      expect(normColor(String(barStyle.backgroundColor))).toBe(
        normColor(COLOR.rule),
      )
      expect(container.querySelectorAll("pdf-text").length).toBe(1) // no count
    } else {
      const count = texts[1]
      expect(count?.textContent).toBe(spec.countText)
      const countStyle = parseStyle(count ?? null)
      expect(String(countStyle.color).toLowerCase()).toBe(
        spec.countColorHex.toLowerCase(),
      )
    }
  })
})
