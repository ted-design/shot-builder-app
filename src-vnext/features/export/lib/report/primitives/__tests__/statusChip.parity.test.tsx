import { describe, it, expect, vi } from "vitest"

// Two-layer parity for the canonical StatusChip primitive.
//   Layer 1 — the resolved spec is the single source both adapters consume;
//     snapshot it + assert the reserved-palette dot colours (never red; on_hold
//     AMBER), label pass-through, and variant preset resolution.
//   Layer 2 — prove BOTH adapters (DOM + @react-pdf) present the SAME spec from
//     one deriveStatusChipSpec(input). If someone re-introduces a value on one
//     side only, that side diverges -> red.
//
// IMPORTANT: DOM dot colour is OKLCH and PDF dot colour is HEX by design (two
// different colour spaces, single-sourced from `primitiveTokens`/`STATUS`). We
// therefore assert each adapter against its OWN token — never cross-compare the
// DOM oklch to the PDF hex.

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
    Text: (props: Record<string, unknown>) => {
      const { style, children, ...rest } = props as {
        style?: unknown
        children?: unknown
      } & Record<string, unknown>
      return React.createElement(
        "pdf-text",
        { ...rest, "data-style": ser(style) },
        children as React.ReactNode,
      )
    },
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render } from "@testing-library/react"
import {
  deriveStatusChipSpec,
  StatusChipDom,
  StatusChipPdf,
} from "../statusChip"
import type { StatusChipInput, StatusChipSpec } from "../statusChip"
import { pxToPt } from "../../../units"
import type { ReportShotStatus } from "../../reportTypes"

function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

// Reserved-palette dot HEX per status (PDF side), and the OKLCH per status (DOM
// side). Single-sourced in primitiveTokens/STATUS — mirrored here as the literal
// expectation so a palette change is an owned diff.
const DOT_HEX: Record<ReportShotStatus, string> = {
  complete: "#16A34A",
  in_progress: "#2563EB",
  todo: "#A1A1AA",
  on_hold: "#D97706", // AMBER — the reserved on_hold colour, never red
}
const DOT_OKLCH: Record<ReportShotStatus, string> = {
  complete: "oklch(0.62 0.13 150)",
  in_progress: "oklch(0.62 0.13 240)",
  todo: "oklch(0.72 0.008 55)",
  on_hold: "oklch(0.74 0.14 75)",
}

const ALL_STATUSES: readonly ReportShotStatus[] = [
  "complete",
  "in_progress",
  "todo",
  "on_hold",
]

// Layer 1 — spec unit.

describe("deriveStatusChipSpec", () => {
  it("resolves the reserved dot colours (hex + oklch) for every status", () => {
    for (const status of ALL_STATUSES) {
      const spec = deriveStatusChipSpec({ status, label: "X" })
      expect(spec).toMatchObject({
        status,
        dotHex: DOT_HEX[status],
        dotOklch: DOT_OKLCH[status],
      })
    }
  })

  it("resolves on_hold to AMBER (#D97706), never red", () => {
    const spec = deriveStatusChipSpec({ status: "on_hold", label: "On hold" })
    expect(spec.dotHex).toBe("#D97706")
    expect(spec.dotHex).not.toBe("#EB1400") // the sanctioned red belongs to HoldFlag only
  })

  it("snapshots the full spec for the default (imageLed) variant", () => {
    expect(deriveStatusChipSpec({ status: "complete", label: "Shot" })).toEqual({
      kind: "statusChip",
      status: "complete",
      label: "Shot",
      dotOklch: "oklch(0.62 0.13 150)",
      dotHex: "#16A34A",
      dotDomClass: "sb-status--complete",
      labelFontDomPx: 10,
      labelFontPt: 7,
      labelLetterSpacingDomEm: 0.06,
      labelLetterSpacingPt: 0.5,
      labelColorVar: "var(--sb-ink-2)",
      labelColorHex: "#52525B",
      dotDomPx: 7,
      dotPt: 5,
    } satisfies StatusChipSpec)
  })

  it("passes the label through verbatim (legacy vs canonical)", () => {
    expect(deriveStatusChipSpec({ status: "complete", label: "Shot" }).label).toBe(
      "Shot",
    )
    expect(
      deriveStatusChipSpec({ status: "complete", label: "Complete" }).label,
    ).toBe("Complete")
  })

  it("resolves the productionInline preset (fontDomPx 9, ink-3)", () => {
    const spec = deriveStatusChipSpec({
      status: "todo",
      label: "To do",
      variant: "productionInline",
    })
    expect(spec).toMatchObject({
      labelFontDomPx: 9,
      labelFontPt: 6,
      labelLetterSpacingDomEm: 0.08,
      labelColorVar: "var(--sb-ink-3)",
      labelColorHex: "#5B5B60",
    })
  })

  it("resolves the balanced preset (fontPt 6, ls 0.08, ink-2)", () => {
    const spec = deriveStatusChipSpec({
      status: "todo",
      label: "To do",
      variant: "balanced",
    })
    expect(spec).toMatchObject({
      labelFontDomPx: 10,
      labelFontPt: 6,
      labelLetterSpacingDomEm: 0.08,
      labelColorVar: "var(--sb-ink-2)",
    })
  })

  it("defaults variant to imageLed when omitted", () => {
    const withDefault = deriveStatusChipSpec({ status: "todo", label: "To do" })
    const explicit = deriveStatusChipSpec({
      status: "todo",
      label: "To do",
      variant: "imageLed",
    })
    expect(withDefault).toEqual(explicit)
  })

  it("does not mutate the input", () => {
    const input: StatusChipInput = {
      status: "on_hold",
      label: "On hold",
      variant: "balanced",
    }
    const before = structuredClone(input)
    deriveStatusChipSpec(input)
    expect(input).toEqual(before)
  })
})

describe("pxToPt", () => {
  it("converts against the physical constant (96px = 72pt = 1in)", () => {
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(7)).toBeCloseTo(5.25)
  })
})

// Layer 2 — adapter parity. Both adapters present the SAME spec from one input.
// Cases: 4 statuses × 2 label sets (legacy + canonical) × a couple variants.

const LEGACY_LABEL: Record<ReportShotStatus, string> = {
  complete: "Shot",
  in_progress: "In progress",
  todo: "To do",
  on_hold: "On hold",
}
const CANONICAL_LABEL: Record<ReportShotStatus, string> = {
  complete: "Complete",
  in_progress: "In progress",
  todo: "To do",
  on_hold: "On hold",
}

const CASES: readonly StatusChipInput[] = ALL_STATUSES.flatMap((status) => [
  { status, label: LEGACY_LABEL[status], variant: "imageLed" as const },
  { status, label: CANONICAL_LABEL[status], variant: "balanced" as const },
  { status, label: CANONICAL_LABEL[status], variant: "productionInline" as const },
])

describe("StatusChip adapter parity — DOM and PDF present the same spec", () => {
  it.each(CASES)("DOM adapter reflects the spec (%o)", (input) => {
    const spec = deriveStatusChipSpec(input)
    const { container } = render(StatusChipDom(spec))

    const chip = container.querySelector<HTMLElement>(
      '[data-testid="status-chip"]',
    )
    expect(chip).not.toBeNull()
    expect(chip?.style.fontSize).toBe(`${String(spec.labelFontDomPx)}px`)
    expect(chip?.style.letterSpacing).toBe(
      `${String(spec.labelLetterSpacingDomEm)}em`,
    )
    expect(chip?.style.textTransform).toBe("uppercase")
    // jsdom leaves the CSS var unresolved — assert the raw canonical token.
    expect(chip?.style.color).toBe(spec.labelColorVar)

    const dot = container.querySelector<HTMLElement>(
      '[data-testid="status-dot"]',
    )
    expect(dot).not.toBeNull()
    // jsdom keeps oklch(...) verbatim — assert the DOM token, NOT the PDF hex.
    expect(dot?.style.background).toBe(spec.dotOklch)
    expect(dot?.className).toBe(spec.dotDomClass)

    const label = container.querySelector('[data-testid="status-label"]')
    expect(label?.textContent).toBe(spec.label)
  })

  it.each(CASES)("PDF adapter reflects the same spec (%o)", (input) => {
    const spec = deriveStatusChipSpec(input)
    const { container } = render(StatusChipPdf(spec))

    const views = container.querySelectorAll("pdf-view")
    // wrapper + inner dot
    expect(views.length).toBe(2)
    const dotStyle = parseStyle(views[1] ?? null)
    // PDF dot colour is the verbatim reserved hex — assert against the PDF token.
    expect(String(dotStyle.backgroundColor).toLowerCase()).toBe(
      spec.dotHex.toLowerCase(),
    )
    expect(dotStyle.width).toBe(spec.dotPt)
    expect(dotStyle.height).toBe(spec.dotPt)

    const text = container.querySelector("pdf-text")
    expect(text).not.toBeNull()
    expect(text?.textContent).toBe(spec.label)
    const textStyle = parseStyle(text)
    expect(textStyle.fontSize).toBeCloseTo(spec.labelFontPt)
    expect(textStyle.letterSpacing).toBeCloseTo(spec.labelLetterSpacingPt)
    expect(textStyle.textTransform).toBe("uppercase")
    expect(String(textStyle.color).toLowerCase()).toBe(
      spec.labelColorHex.toLowerCase(),
    )
  })
})
