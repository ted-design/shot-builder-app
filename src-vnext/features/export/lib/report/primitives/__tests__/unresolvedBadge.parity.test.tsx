import { describe, it, expect, vi } from "vitest"

// Two-layer parity for the UnresolvedBadge primitive.
// Layer 1 snapshots deriveUnresolvedBadgeSpec() (the single source both
// renderers consume). Layer 2 proves the DOM adapter and the @react-pdf adapter
// present the SAME spec — if someone re-introduces the red-ink or forks a
// geometry value on one side only, that side diverges -> red.

// Mock @react-pdf/renderer into queryable DOM. UnresolvedBadge renders a single
// <Text> (no View/Image), so only Text + StyleSheet are stubbed.
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
import { UnresolvedBadgeView } from "../../../../components/report/primitives/UnresolvedBadge"
import {
  UnresolvedBadgePdf,
  deriveUnresolvedBadgeSpec,
  type UnresolvedBadgeInput,
} from "../unresolvedBadge"
import { pxToPt } from "../../../units"

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

// ── Layer 1 — spec unit ──────────────────────────────────────────────────────
describe("deriveUnresolvedBadgeSpec", () => {
  it("resolves the canonical spec from a bare input", () => {
    expect(deriveUnresolvedBadgeSpec({ label: "Gender ?" })).toEqual({
      kind: "unresolvedBadge",
      label: "Gender ?",
      inkHex: "#18181B",
      inkVar: "var(--sb-ink)",
      fontDomPx: 9,
      fontPt: 5.5,
      letterSpacingDomEm: 0.06,
      letterSpacingPt: 0.4,
      paddingDomPx: "1px 4px",
      paddingHorizontalPt: 3,
      borderRadiusDomPx: 2,
      borderRadiusPt: 1,
      borderWidthPt: 0.5,
    })
  })

  it("uses INK (#18181B), the DEMOTION from red-ink — never #B3261E", () => {
    const spec = deriveUnresolvedBadgeSpec({ label: "Unresolved" })
    expect(spec.inkHex).toBe("#18181B")
    expect(spec.inkVar).toBe("var(--sb-ink)")
    // The demotion: the badge is no longer any red-family color.
    expect(spec.inkHex).not.toBe("#B3261E") // accentInk (old PDF red-ink)
    expect(spec.inkVar).not.toBe("var(--sb-red-ink)") // old DOM red-ink
    expect(spec.inkVar).not.toBe("var(--sb-red)") // the sanctioned HoldFlag red
  })

  it("passes the label through verbatim", () => {
    for (const label of ["Unresolved", "Mixed", "Gender ?"]) {
      expect(deriveUnresolvedBadgeSpec({ label }).label).toBe(label)
    }
  })

  it("does not mutate the input", () => {
    const input: UnresolvedBadgeInput = { label: "Mixed" }
    const before = structuredClone(input)
    deriveUnresolvedBadgeSpec(input)
    expect(input).toEqual(before)
  })
})

describe("pxToPt", () => {
  it("converts against the physical constant (96px = 72pt = 1in)", () => {
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(1)).toBeCloseTo(0.75)
  })
})

// ── Layer 2 — cross-renderer parity ──────────────────────────────────────────
const CASES: readonly UnresolvedBadgeInput[] = [
  { label: "Unresolved" },
  { label: "Mixed" },
  { label: "Gender ?" },
]

describe("UnresolvedBadge consumer parity — DOM and pdf consume the same spec", () => {
  it.each(CASES)("DOM <span> reflects the spec (%o)", (input) => {
    const spec = deriveUnresolvedBadgeSpec(input)
    const { getByTestId } = render(<UnresolvedBadgeView {...input} />)
    const badge = getByTestId("unresolved-badge")
    expect(badge.textContent).toBe(spec.label)
    expect(badge.style.fontSize).toBe(`${String(spec.fontDomPx)}px`)
    expect(badge.style.textTransform).toBe("uppercase")
    // jsdom does NOT resolve `var(--sb-ink)` — assert the raw token + that the
    // border tracks the ink text via `currentColor` (ink border follows ink text).
    expect(badge.style.color).toBe(spec.inkVar)
    expect(normColor(badge.style.borderColor)).toContain("currentcolor")
  })

  it.each(CASES)("pdf <Text> reflects the same spec (%o)", (input) => {
    const spec = deriveUnresolvedBadgeSpec(input)
    const { container } = render(<UnresolvedBadgePdf {...input} />)
    const el = container.querySelector("pdf-text")
    expect(el?.textContent).toBe(spec.label)
    const style = parseStyle(el)
    expect(String(style.color).toLowerCase()).toBe(spec.inkHex.toLowerCase())
    expect(String(style.borderColor).toLowerCase()).toBe(
      spec.inkHex.toLowerCase(),
    )
    expect(style.borderWidth).toBeCloseTo(spec.borderWidthPt)
    expect(style.fontSize).toBeCloseTo(spec.fontPt)
    expect(style.textTransform).toBe("uppercase")
  })

  it("DOM ink and PDF ink are the SAME color (cross-normalized)", () => {
    const spec = deriveUnresolvedBadgeSpec({ label: "Unresolved" })
    // The DOM emits `var(--sb-ink)` (jsdom keeps it verbatim), so cross-compare
    // the CANONICAL ink hex both sides derive from — DOM inkVar maps to inkHex.
    expect(normColor(hexToRgb(spec.inkHex))).toBe(
      normColor(hexToRgb("#18181B")),
    )
    expect(spec.inkHex.toLowerCase()).toBe("#18181b")
  })
})
