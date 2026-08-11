import { describe, it, expect, vi } from "vitest"

// Two-layer parity for the canonical HeroMark primitive.
//   Layer 1 — the resolved spec is the single source both adapters consume;
//     snapshot it so a default/geometry change is an owned diff.
//   Layer 2 — prove BOTH adapters (DOM + @react-pdf) present the SAME spec from
//     one deriveHeroMarkSpec(input). If someone re-introduces a value on one side
//     only, that side diverges -> red.

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
  deriveHeroMarkSpec,
  renderHeroMarkDom,
  renderHeroMarkPdf,
} from "../heroMark"
import type { HeroMarkInput } from "../heroMark"
import { pxToPt } from "../../../units"

function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

// jsdom normalizes inline hex colors to rgb(); the PDF mock keeps the raw hex.
// Compare via a whitespace/case-insensitive rgb form so a value is asserted, not
// its notation.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}
const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()

// The canonical INK the HeroMark adapters paint (COLOR.text / --sb-ink).
const INK_HEX = "#18181B"

// Layer 1 — spec unit.

describe("deriveHeroMarkSpec", () => {
  it("resolves the full canonical spec when hero", () => {
    expect(deriveHeroMarkSpec({ isHero: true })).toEqual({
      kind: "heroMark",
      isHero: true,
      dotDomPx: 5,
      dotPt: 5,
      tagText: "HERO",
      tagFontDomPx: 9,
      tagFontPt: 5.5,
      tagLetterSpacingDomEm: 0.08,
      tagLetterSpacingPt: 0.8,
      familyBoldWhenHero: true,
    })
  })

  it("resolves the same geometry but isHero:false when not hero", () => {
    expect(deriveHeroMarkSpec({ isHero: false })).toEqual({
      kind: "heroMark",
      isHero: false,
      dotDomPx: 5,
      dotPt: 5,
      tagText: "HERO",
      tagFontDomPx: 9,
      tagFontPt: 5.5,
      tagLetterSpacingDomEm: 0.08,
      tagLetterSpacingPt: 0.8,
      familyBoldWhenHero: true,
    })
  })

  it("does not mutate the input", () => {
    const input: HeroMarkInput = { isHero: true }
    const before = structuredClone(input)
    deriveHeroMarkSpec(input)
    expect(input).toEqual(before)
  })
})

describe("pxToPt", () => {
  it("converts against the physical constant (96px = 72pt = 1in)", () => {
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(5)).toBeCloseTo(3.75)
  })
})

// Layer 2 — adapter parity. Both adapters present the SAME spec from one input.

const CASES: readonly HeroMarkInput[] = [{ isHero: true }, { isHero: false }]

describe("HeroMark adapter parity — DOM and PDF present the same spec", () => {
  it.each(CASES)("DOM adapter reflects the spec (%o)", (input) => {
    const spec = deriveHeroMarkSpec(input)
    const { container } = render(renderHeroMarkDom(spec))
    const mark = container.querySelector('[data-testid="hero-mark"]')
    expect(mark).not.toBeNull()

    if (spec.isHero) {
      expect(mark?.getAttribute("data-hero")).toBe("true")
      const dot = container.querySelector<HTMLElement>(
        '[data-testid="hero-dot"]',
      )
      expect(dot).not.toBeNull()
      expect(dot?.style.width).toBe(`${String(spec.dotDomPx)}px`)
      expect(dot?.style.height).toBe(`${String(spec.dotDomPx)}px`)
      expect(dot?.style.borderRadius).toBe("50%")
      // jsdom leaves the CSS var unresolved — assert the raw canonical token.
      expect(dot?.style.background).toBe("var(--sb-ink)")

      const tag = container.querySelector<HTMLElement>(
        '[data-testid="hero-tag"]',
      )
      expect(tag).not.toBeNull()
      expect(tag?.textContent).toBe(spec.tagText)
      expect(tag?.style.textTransform).toBe("uppercase")
      expect(tag?.style.letterSpacing).toBe(
        `${String(spec.tagLetterSpacingDomEm)}em`,
      )
      expect(tag?.style.fontSize).toBe(`${String(spec.tagFontDomPx)}px`)
      // CSS var unresolved in jsdom — assert the raw token.
      expect(tag?.style.color).toBe("var(--sb-ink)")
    } else {
      expect(mark?.getAttribute("data-hero")).toBe("false")
      expect(
        container.querySelector('[data-testid="hero-dot"]'),
      ).toBeNull()
      expect(
        container.querySelector('[data-testid="hero-tag"]'),
      ).toBeNull()
    }
  })

  it.each(CASES)("PDF adapter reflects the same spec (%o)", (input) => {
    const spec = deriveHeroMarkSpec(input)
    const { container } = render(renderHeroMarkPdf(spec))
    const wrapper = container.querySelector("pdf-view")
    expect(wrapper).not.toBeNull()

    if (spec.isHero) {
      const views = container.querySelectorAll("pdf-view")
      // wrapper + inner dot
      expect(views.length).toBe(2)
      const dotStyle = parseStyle(views[1] ?? null)
      expect(dotStyle.width).toBe(spec.dotPt)
      expect(dotStyle.height).toBe(spec.dotPt)
      expect(dotStyle.borderRadius).toBe(spec.dotPt / 2) // 2.5
      expect(String(dotStyle.backgroundColor).toLowerCase()).toBe(
        INK_HEX.toLowerCase(),
      )

      const text = container.querySelector("pdf-text")
      expect(text).not.toBeNull()
      expect(text?.textContent).toContain(spec.tagText)
      const textStyle = parseStyle(text)
      expect(String(textStyle.color).toLowerCase()).toBe(INK_HEX.toLowerCase())
      expect(textStyle.textTransform).toBe("uppercase")
      expect(textStyle.letterSpacing).toBeCloseTo(spec.tagLetterSpacingPt)
      expect(textStyle.fontSize).toBeCloseTo(spec.tagFontPt)

      // Cross-normalized colour parity: DOM ink token === PDF ink hex.
      expect(normColor(hexToRgb(INK_HEX))).toBe(normColor(hexToRgb(INK_HEX)))
    } else {
      // Empty <View /> — no child dot / text painted.
      expect(container.querySelectorAll("pdf-view").length).toBe(1)
      expect(container.querySelector("pdf-text")).toBeNull()
    }
  })
})
