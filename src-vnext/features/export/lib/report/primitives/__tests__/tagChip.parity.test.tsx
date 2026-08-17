import { describe, it, expect, vi } from "vitest"

// Two-layer parity for the TagChip primitive (the 7th canonical primitive,
// 2026-08-17). Layer 1 snapshots deriveTagChipSpec() (the single source both
// renderers consume). Layer 2 proves the DOM adapter and the @react-pdf adapter
// present the SAME spec — if someone forks a geometry value or a colour on one
// side only, or reaches for the app's per-tag-coloured TagBadge palette here,
// that side diverges -> red.

// Mock @react-pdf/renderer into queryable DOM. TagChip renders a single <Text>
// (no View/Image), so only Text + StyleSheet are stubbed.
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
import { TagChipView } from "../../../../components/report/primitives/TagChip"
import { TagChipPdf, deriveTagChipSpec, type TagChipInput } from "../tagChip"
import { COLOR } from "../../reportPdfShared"
import { pxToPt } from "../../../units"

function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

// jsdom normalizes inline colors to rgb(); the PDF mock keeps the raw hex.
// Compare both via a whitespace/case-insensitive form so a color VALUE is
// asserted, not its notation.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}

const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()

// ── Layer 1 — spec unit ──────────────────────────────────────────────────────
describe("deriveTagChipSpec", () => {
  it("resolves the canonical spec from a bare input", () => {
    expect(deriveTagChipSpec({ label: "Photo" })).toEqual({
      kind: "tagChip",
      label: "Photo",
      inkHex: "#52525B",
      inkVar: "var(--sb-ink-2)",
      borderHex: "#D4D4D8",
      borderVar: "var(--sb-rule-strong)",
      fontDomPx: 9,
      fontPt: 5.5,
      letterSpacingDomEm: 0.08,
      letterSpacingPt: 0.4,
      paddingDomPx: "1px 6px",
      paddingHorizontalPt: 3,
      borderRadiusDomPx: 2,
      borderRadiusPt: 1,
      borderWidthDomPx: 1,
      borderWidthPt: 0.5,
    })
  })

  it("resolves ink + border from the SHARED reserved palette, never a re-hardcoded hex", () => {
    const spec = deriveTagChipSpec({ label: "High Priority" })
    expect(spec.inkHex).toBe(COLOR.textSecondary)
    expect(spec.borderHex).toBe(COLOR.ruleStrong)
  })

  it("is NEUTRAL — no red, ever, whatever the tag is called", () => {
    // The report keeps a reserved palette in which red has exactly one job per
    // recipe (image-led's shot number / production-sheet's hold flag /
    // balanced-rows' hero mark). A tag literally labelled "High Priority" (whose
    // ShotTag.color key is "red" in DEFAULT_TAGS) must still print neutral.
    for (const label of ["High Priority", "Photo", "Video", "Low Priority"]) {
      const spec = deriveTagChipSpec({ label })
      expect(spec.inkHex).not.toBe(COLOR.accent) // #EB1400, the sanctioned red
      expect(spec.inkHex).not.toBe(COLOR.accentInk) // #B3261E, the muted red-ink
      expect(spec.borderHex).not.toBe(COLOR.accent)
      expect(spec.borderHex).not.toBe(COLOR.accentInk)
      expect(spec.inkVar).not.toBe("var(--sb-red)")
      expect(spec.inkVar).not.toBe("var(--sb-red-ink)")
    }
  })

  it("passes the label through verbatim (no casing/trim transform in the spec)", () => {
    for (const label of ["Photo", "high priority", "  Odd  Spacing  ", "E-Comm"]) {
      expect(deriveTagChipSpec({ label }).label).toBe(label)
    }
  })

  it("does not mutate the input", () => {
    const input: TagChipInput = { label: "Video" }
    const before = structuredClone(input)
    deriveTagChipSpec(input)
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
const CASES: readonly TagChipInput[] = [
  { label: "Photo" },
  { label: "Video" },
  { label: "High Priority" },
  { label: "E-Comm" },
]

describe("TagChip consumer parity — DOM and pdf consume the same spec", () => {
  it.each(CASES)("DOM <span> reflects the spec (%o)", (input) => {
    const spec = deriveTagChipSpec(input)
    const { getByTestId } = render(<TagChipView {...input} />)
    const chip = getByTestId("tag-chip")
    expect(chip.textContent).toBe(spec.label)
    expect(chip.style.fontSize).toBe(`${String(spec.fontDomPx)}px`)
    expect(chip.style.letterSpacing).toBe(`${String(spec.letterSpacingDomEm)}em`)
    expect(chip.style.textTransform).toBe("uppercase")
    expect(chip.style.padding).toBe(spec.paddingDomPx)
    expect(chip.style.borderRadius).toBe(`${String(spec.borderRadiusDomPx)}px`)
    // jsdom does NOT resolve `var(--sb-ink-2)` — assert the raw tokens.
    expect(chip.style.color).toBe(spec.inkVar)
    expect(chip.style.borderWidth).toBe(`${String(spec.borderWidthDomPx)}px`)
    expect(chip.style.borderColor).toBe(spec.borderVar)
    // The shipped class rides along for real-page fidelity (belt-and-suspenders
    // with the inline styles the parity assertions above read).
    expect(chip.className).toContain("sb-tag-chip")
  })

  it.each(CASES)("pdf <Text> reflects the same spec (%o)", (input) => {
    const spec = deriveTagChipSpec(input)
    const { container } = render(<TagChipPdf {...input} />)
    const el = container.querySelector("pdf-text")
    expect(el?.textContent).toBe(spec.label)
    const style = parseStyle(el)
    expect(String(style.color).toLowerCase()).toBe(spec.inkHex.toLowerCase())
    expect(String(style.borderColor).toLowerCase()).toBe(spec.borderHex.toLowerCase())
    expect(style.borderWidth).toBeCloseTo(spec.borderWidthPt)
    expect(style.borderRadius).toBeCloseTo(spec.borderRadiusPt)
    expect(style.fontSize).toBeCloseTo(spec.fontPt)
    expect(style.letterSpacing).toBeCloseTo(spec.letterSpacingPt)
    expect(style.paddingHorizontal).toBeCloseTo(spec.paddingHorizontalPt)
    expect(style.textTransform).toBe("uppercase")
  })

  it("both adapters print the SAME label text for the same input (no per-renderer casing fork)", () => {
    for (const input of CASES) {
      const { getByTestId, unmount } = render(<TagChipView {...input} />)
      const domText = getByTestId("tag-chip").textContent
      unmount()
      const { container, unmount: unmountPdf } = render(<TagChipPdf {...input} />)
      const pdfText = container.querySelector("pdf-text")?.textContent
      unmountPdf()
      expect(domText).toBe(pdfText)
      expect(domText).toBe(input.label)
    }
  })

  it("DOM ink and PDF ink are the SAME canonical color (cross-normalized)", () => {
    const spec = deriveTagChipSpec({ label: "Photo" })
    // The DOM emits `var(--sb-ink-2)` (jsdom keeps it verbatim), so cross-compare
    // the CANONICAL hex both sides derive from — DOM inkVar maps to inkHex.
    expect(normColor(hexToRgb(spec.inkHex))).toBe(normColor(hexToRgb(COLOR.textSecondary)))
    expect(spec.inkHex.toLowerCase()).toBe("#52525b")
    expect(spec.borderHex.toLowerCase()).toBe("#d4d4d8")
  })
})
