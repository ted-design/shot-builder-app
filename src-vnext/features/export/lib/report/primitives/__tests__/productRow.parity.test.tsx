import { describe, it, expect, vi } from "vitest"

// Two-layer parity for the canonical ProductRow primitive.
// Layer 1: snapshot deriveProductRowSpec()/deriveProductColHeadSpec() — the one
//          source both renderers consume.
// Layer 2: prove the DOM adapter and the @react-pdf adapter present the SAME
//          spec (no re-derive) across a column/hero/qty/colour/size matrix.

// --- Mock @react-pdf/renderer into queryable DOM (mirrors blockConsumers). ---
vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  const ser = (s: unknown) => {
    try {
      return s == null ? undefined : JSON.stringify(s)
    } catch {
      return undefined
    }
  }
  const make =
    (tag: string) =>
    (props: Record<string, unknown>) => {
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
    View: make("pdf-view"),
    Text: make("pdf-text"),
    StyleSheet: { create: (s: unknown) => s },
  }
})

// --- Mock the HeroMark primitive with a faithful reproduction of its locked
// contract (ink dot 'var(--sb-ink)' DOM / '#18181b' PDF + uppercase "HERO" tag).
// Keeps this test hermetic: it does not depend on the parallel HeroMark builder's
// file being on disk, yet still asserts the exact ink-dot behaviour ProductRow
// must show. The production adapters import the real ./heroMark. ---
vi.mock("../heroMark", () => {
  const React = require("react")
  return {
    deriveHeroMarkSpec: (input: { isHero: boolean }) => ({
      kind: "heroMark",
      isHero: input.isHero,
      dotDomPx: 5,
      dotPt: 5,
      tagText: "HERO",
    }),
    renderHeroMarkDom: (spec: { isHero: boolean }) => {
      if (!spec.isHero) {
        return React.createElement("span", { "data-testid": "hero-mark", "data-hero": "false" })
      }
      return React.createElement(
        "span",
        { "data-testid": "hero-mark", "data-hero": "true" },
        React.createElement("span", {
          "data-testid": "hero-dot",
          style: {
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "var(--sb-ink)",
            display: "inline-block",
          },
        }),
        React.createElement(
          "span",
          {
            "data-testid": "hero-tag",
            style: {
              fontFamily: "var(--sb-font-ui)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--sb-ink)",
            },
          },
          "HERO",
        ),
      )
    },
    renderHeroMarkPdf: (spec: { isHero: boolean }) => {
      // Emit the same pdf-view/pdf-text custom tags (with data-style) the
      // @react-pdf mock produces, directly — so the mock is independent of
      // module-resolution order and parseStyle()/querySelector see the tags
      // ProductRow's real PDF adapter would emit through HeroMark.
      const dstyle = (s: unknown) => JSON.stringify(s)
      if (!spec.isHero) return React.createElement("pdf-view", { "data-style": dstyle({}) })
      return React.createElement(
        "pdf-view",
        { "data-style": dstyle({}) },
        React.createElement("pdf-view", {
          "data-testid": "hero-dot",
          "data-style": dstyle({ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#18181B" }),
        }),
        React.createElement(
          "pdf-text",
          {
            "data-testid": "hero-tag",
            "data-style": dstyle({ fontFamily: "Helvetica-Bold", fontSize: 5.5, color: "#18181B" }),
          },
          "  HERO",
        ),
      )
    },
  }
})

import { render } from "@testing-library/react"
import {
  deriveProductRowSpec,
  deriveProductColHeadSpec,
  renderProductRowPdf,
  type ProductColumnSet,
  type ProductRowInput,
} from "../productRow"
import { renderProductRowDom } from "../../../../components/report/primitives/ProductRow"
import { qtyGlyph } from "../qtyGlyph"
import { INK_HEX, INK_VAR, HOLD_RED_HEX, HOLD_RED_VAR } from "../primitiveTokens"
import { sizeLabel } from "../../reportModel"
import { pxToPt } from "../../../units"
import type { ReportProduct } from "../../reportTypes"

// --- helpers (mirror the Divider template) ---
function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}
const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()

function product(overrides: Partial<ReportProduct>): ReportProduct {
  return {
    family: "Tee",
    style: null,
    colour: null,
    size: null,
    sizeScope: null,
    qty: null,
    gender: "?",
    isHero: false,
    img: null,
    ...overrides,
  }
}

// =====================================================================
// Layer 1 — spec unit
// =====================================================================
describe("deriveProductRowSpec", () => {
  it("resolves a bare pending product (full snapshot)", () => {
    const input: ProductRowInput = {
      product: product({ family: "", qty: null, sizeScope: "pending", size: null }),
      columns: "full",
      colourPlaceholder: "Unspecified",
      stylePlaceholder: "—",
    }
    expect(deriveProductRowSpec(input)).toEqual({
      kind: "productRow",
      family: "Unnamed product",
      style: null,
      colour: null,
      sizeText: "Pending",
      sizePending: true,
      qtyText: "—", // NOT '×—'
      isHero: false,
      columns: "full",
      colourPlaceholder: "Unspecified",
      stylePlaceholder: "—",
      familyPlaceholder: "Unnamed product",
    })
  })

  it("resolves an explicit hero product (qty/size/hero)", () => {
    const spec = deriveProductRowSpec({
      product: product({ family: "Tee", qty: 2, size: "M", sizeScope: "single", isHero: true }),
      columns: "full",
      colourPlaceholder: "—",
      stylePlaceholder: "—",
    })
    expect(spec.qtyText).toBe("×2")
    expect(spec.sizeText).toBe("M")
    expect(spec.sizePending).toBe(false)
    expect(spec.isHero).toBe(true)
    expect(spec.family).toBe("Tee")
  })

  it("consumes sizeLabel unchanged — 'all' scope -> 'All sizes', not pending", () => {
    const spec = deriveProductRowSpec({
      product: product({ sizeScope: "all", size: null }),
      columns: "compact",
      colourPlaceholder: "—",
      stylePlaceholder: "—",
    })
    // matches sizeLabel's own contract for the 'all' scope
    expect(spec.sizeText).toBe(sizeLabel("all", null).text)
    expect(spec.sizeText).toBe("All sizes")
    expect(spec.sizePending).toBe(false)
  })

  it("passes style/colour through raw (placeholders NOT applied in the spec)", () => {
    const spec = deriveProductRowSpec({
      product: product({ style: null, colour: "" }),
      columns: "full",
      colourPlaceholder: "Colour TBD",
      stylePlaceholder: "no style #",
    })
    expect(spec.style).toBeNull()
    expect(spec.colour).toBe("") // raw empty; adapter applies placeholder
    expect(spec.colourPlaceholder).toBe("Colour TBD")
    expect(spec.stylePlaceholder).toBe("no style #")
  })

  it("does not mutate the input product", () => {
    const p = product({ family: "Tee", qty: 3, size: "L", sizeScope: "single", isHero: true })
    const before = structuredClone(p)
    deriveProductRowSpec({ product: p, columns: "full", colourPlaceholder: "—", stylePlaceholder: "—" })
    expect(p).toEqual(before)
  })
})

describe("qtyGlyph", () => {
  it("null -> '—' (kills '×—'), a count -> '×N'", () => {
    expect(qtyGlyph(null)).toBe("—")
    expect(qtyGlyph(3)).toBe("×3")
    expect(qtyGlyph(0)).toBe("×0")
  })
})

describe("deriveProductColHeadSpec", () => {
  it("full -> 6 headers incl. Style", () => {
    expect(deriveProductColHeadSpec("full")).toEqual({
      kind: "productColHead",
      columns: "full",
      headers: ["", "Family", "Style", "Colour", "Size", "Qty"],
    })
  })
  it("compact -> 5 headers (Style demoted)", () => {
    expect(deriveProductColHeadSpec("compact")).toEqual({
      kind: "productColHead",
      columns: "compact",
      headers: ["", "Family", "Colour", "Size", "Qty"],
    })
  })
})

describe("pxToPt", () => {
  it("converts against the physical constant (96px = 72pt = 1in)", () => {
    expect(pxToPt(96)).toBe(72)
    expect(pxToPt(1)).toBeCloseTo(0.75)
  })
})

// =====================================================================
// Layer 2 — consumer parity: DOM + PDF present ONE deriveProductRowSpec
// =====================================================================
type Case = {
  readonly columns: ProductColumnSet
  readonly isHero: boolean
  readonly qty: number | null
  readonly colour: string
  readonly sizeScope: "pending" | "single"
}

const CASES: readonly Case[] = (() => {
  const out: Case[] = []
  for (const columns of ["full", "compact"] as const)
    for (const isHero of [true, false])
      for (const qty of [null, 2] as const)
        for (const colour of ["", "Red"] as const)
          for (const sizeScope of ["pending", "single"] as const)
            out.push({ columns, isHero, qty, colour, sizeScope })
  return out
})()

function inputFor(c: Case): ProductRowInput {
  return {
    product: product({
      family: "Tee",
      style: "ST-100",
      colour: c.colour,
      size: c.sizeScope === "single" ? "M" : null,
      sizeScope: c.sizeScope,
      qty: c.qty,
      isHero: c.isHero,
    }),
    columns: c.columns,
    colourPlaceholder: "Unspecified",
    stylePlaceholder: "—",
  }
}

function domById(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`)
}

describe("ProductRow consumer parity — DOM and PDF present the same spec", () => {
  it.each(CASES)("DOM reflects the spec (%o)", (c) => {
    const spec = deriveProductRowSpec(inputFor(c))
    const { container } = render(renderProductRowDom(spec))

    const row = domById(container, "product-row")
    expect(row).not.toBeNull()
    expect(row?.getAttribute("data-columns")).toBe(c.columns)
    expect(row?.getAttribute("data-hero")).toBe(String(c.isHero))
    const grid = row?.style.gridTemplateColumns ?? ""
    if (c.columns === "full") {
      expect(grid).toContain("1.7fr")
      expect(grid).toContain("36px")
    } else {
      expect(grid).toContain("1.55fr")
      expect(grid).toContain("4.5rem")
    }

    const fam = domById(container, "pr-family")
    expect(fam?.textContent).toContain(spec.family)
    expect(fam?.style.fontWeight).toBe(c.isHero ? "600" : "400")

    // Hero dot present only when hero, and it's INK (not red).
    const heroDot = domById(container, "hero-dot")
    if (c.isHero) {
      expect(heroDot).not.toBeNull()
      expect(heroDot?.style.background).toBe("var(--sb-ink)")
    } else {
      expect(heroDot).toBeNull()
    }

    // qty text === spec.qtyText, and never the legacy '×—'.
    const qty = domById(container, "pr-qty")
    expect(qty?.textContent).toBe(spec.qtyText)
    expect(qty?.textContent).not.toBe("×—")

    // colour cell shows the placeholder when empty, else the raw value.
    const colour = domById(container, "pr-colour")
    expect(colour?.textContent).toBe(c.colour === "" ? "Unspecified" : "Red")

    // size cell muted+italic when pending.
    const size = domById(container, "pr-size")
    if (c.sizeScope === "pending") {
      expect(size?.style.fontStyle).toBe("italic")
      expect(normColor(size?.style.color ?? "")).toBe("var(--sb-ink-3)".toLowerCase())
    } else {
      expect(size?.style.fontStyle).toBe("normal")
    }
    expect(size?.textContent).toBe(spec.sizeText)

    // Style is a real column in full; a meta sub-line in compact.
    if (c.columns === "full") {
      expect(domById(container, "pr-style")).not.toBeNull()
    } else {
      expect(domById(container, "pr-style")).toBeNull()
      expect(domById(container, "pr-style-meta")).not.toBeNull()
    }
  })

  it.each(CASES)("PDF reflects the SAME spec (%o)", (c) => {
    const spec = deriveProductRowSpec(inputFor(c))
    const { container } = render(renderProductRowPdf(spec))

    const row = container.querySelector('pdf-view[data-testid="product-row"]')
    expect(row).not.toBeNull()
    const rowStyle = parseStyle(row)
    expect(rowStyle.borderBottomWidth).toBeCloseTo(0.5)

    const fam = container.querySelector('pdf-text[data-testid="pr-family"]')
    expect(fam?.textContent).toBe(spec.family)
    const famStyle = parseStyle(fam)
    expect(famStyle.fontFamily).toBe(c.isHero ? "Helvetica-Bold" : "Helvetica")

    // qty === spec.qtyText, never '×—'.
    const qty = container.querySelector('pdf-text[data-testid="pr-qty"]')
    expect(qty?.textContent).toBe(spec.qtyText)
    expect(qty?.textContent).not.toBe("×—")

    // Hero ink dot present only when hero; INK #18181b (never red).
    const heroDot = container.querySelector('pdf-view[data-testid="hero-dot"]')
    if (c.isHero) {
      expect(heroDot).not.toBeNull()
      const dotStyle = parseStyle(heroDot)
      expect(String(dotStyle.backgroundColor).toLowerCase()).toBe("#18181b")
    } else {
      expect(heroDot).toBeNull()
    }

    // size muted-italic font when pending, matching the DOM side's pending flag.
    const size = container.querySelector('pdf-text[data-testid="pr-size"]')
    expect(size?.textContent).toBe(spec.sizeText)
    const sizeStyle = parseStyle(size)
    expect(sizeStyle.fontFamily).toBe(spec.sizePending ? "Helvetica-Oblique" : "Helvetica")
  })

  it("both adapters consume ONE deriveProductRowSpec — hero dot is canonical INK, no red leak", () => {
    // The HeroMark ink dot appears on BOTH surfaces from the SAME spec. DOM keeps
    // the canonical INK_VAR (jsdom leaves CSS vars unresolved); PDF keeps the
    // canonical INK_HEX. Assert each against its own canonical ink form — and
    // that neither is the sanctioned red — proving no drift and no red leak.
    const spec = deriveProductRowSpec(
      inputFor({ columns: "full", isHero: true, qty: 2, colour: "Red", sizeScope: "single" }),
    )
    const dom = render(renderProductRowDom(spec))
    const pdf = render(renderProductRowPdf(spec))

    const pdfDotColor = String(parseStyle(pdf.container.querySelector('pdf-view[data-testid="hero-dot"]')).backgroundColor)
    expect(pdfDotColor.toLowerCase()).toBe(INK_HEX.toLowerCase())
    expect(normColor(pdfDotColor)).not.toBe(normColor(HOLD_RED_HEX))

    const domDotColor = domById(dom.container, "hero-dot")?.style.background ?? ""
    expect(domDotColor).toBe(INK_VAR)
    expect(domDotColor).not.toBe(HOLD_RED_VAR)
    // hexToRgb is available for the same-hex primitives; ink dot uses it to prove
    // the PDF hex resolves to a non-red rgb triple.
    expect(hexToRgb(INK_HEX)).toBe("rgb(24, 24, 27)")
  })
})

describe("deriveProductColHeadSpec renders a matching grid on both surfaces", () => {
  it("DOM head has one cell per header and full/compact grids", () => {
    const full = render(renderProductRowDom(deriveProductColHeadSpec("full")))
    expect(full.container.querySelectorAll('[data-testid="pr-head-cell"]').length).toBe(6)
    const compact = render(renderProductRowDom(deriveProductColHeadSpec("compact")))
    expect(compact.container.querySelectorAll('[data-testid="pr-head-cell"]').length).toBe(5)
  })
  it("PDF head has one cell per header", () => {
    const full = render(renderProductRowPdf(deriveProductColHeadSpec("full")))
    expect(full.container.querySelectorAll('pdf-text[data-testid="pr-head-cell"]').length).toBe(6)
  })
})
