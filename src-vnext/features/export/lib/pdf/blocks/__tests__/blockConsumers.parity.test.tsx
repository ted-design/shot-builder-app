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
    Text: (props: Record<string, unknown>) => {
      const { style, render, children, ...rest } = props as {
        style?: unknown
        render?: unknown
        children?: unknown
      } & Record<string, unknown>
      const domProps: Record<string, unknown> = { ...rest, "data-style": ser(style) }
      if (typeof render === "function") domProps["data-has-render"] = "true"
      return React.createElement("pdf-text", domProps, children as React.ReactNode)
    },
    // Passthroughs so importing ExportPdfBlockMapper (which pulls every *BlockPdf)
    // doesn't break at module load.
    Image: (props: Record<string, unknown>) =>
      React.createElement("pdf-image", props),
    Document: (props: Record<string, unknown>) =>
      React.createElement("pdf-document", props, (props as { children?: unknown }).children),
    Page: (props: Record<string, unknown>) =>
      React.createElement("pdf-page", props, (props as { children?: unknown }).children),
    Link: (props: Record<string, unknown>) =>
      React.createElement("pdf-link", props, (props as { children?: unknown }).children),
    Font: { register: () => undefined },
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render } from "@testing-library/react"
import { DividerBlockView } from "../../../../components/blocks/DividerBlockView"
import { DividerBlockPdf } from "../DividerBlockPdf"
import { TextBlockView } from "../../../../components/blocks/TextBlockView"
import { TextBlockPdf } from "../TextBlockPdf"
import { ExportPdfBlockMapper } from "../../ExportPdfBlockMapper"
import { deriveDividerSpec, deriveTextSpec } from "../../../blockSpec"
import { pxToPt } from "../../../units"
import { mapFontFamilyToPdf } from "../../fontMapping"
import type { ExportData } from "../../../../hooks/useExportData"
import type {
  DividerBlock,
  ExportVariable,
  TextBlock,
} from "../../../../types/exportBuilder"

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
    expect(hr?.style.marginTop).toBe(`${String(spec.marginYPx)}px`)
    expect(hr?.style.marginBottom).toBe(`${String(spec.marginYPx)}px`)
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

// Text consumer parity — the preview display tree and the pdf tree both consume
// deriveTextSpec(block, env). Variables resolve identically; the px-canonical
// font size shows as px in the DOM and pxToPt in the pdf; render tokens become a
// DOM sentinel + a pdf render-callback; unresolved tokens warning-paint in both.

const TEXT_VARS: readonly ExportVariable[] = [
  { key: "projectName", label: "Project Name", value: "Acme Shoot", source: "dynamic" },
  { key: "pageNumber", label: "Page Number", value: "{{pageNumber}}", source: "dynamic" },
  { key: "pageCount", label: "Page Count", value: "{{pageCount}}", source: "dynamic" },
]
const WARNING_BG = "#FEF3C7"

function tBlock(content: string, typography?: TextBlock["typography"]): TextBlock {
  return { id: "t1", type: "text", content, typography }
}

function domContentStyle(container: HTMLElement): CSSStyleDeclaration | undefined {
  const el = container.querySelector('[data-testid="text-block-content"]')
  return (el as HTMLElement | null)?.style
}

function pdfWrapperStyle(container: HTMLElement): Record<string, unknown> | null {
  for (const el of Array.from(container.querySelectorAll("pdf-text"))) {
    const s = parseStyle(el)
    if (typeof s.fontSize === "number") return s
  }
  return null
}

describe("Text consumer parity — preview display and pdf consume the same spec", () => {
  it("applies px-canonical typography (px in DOM, pxToPt in pdf)", () => {
    const block = tBlock("Hello")
    const spec = deriveTextSpec(block, { variables: [] })
    const t = spec.typography

    const dom = render(<TextBlockView block={block} variables={[]} />)
    const ds = domContentStyle(dom.container)
    expect(ds?.fontSize).toBe(`${String(t.fontSizePx)}px`)
    expect(ds?.textAlign).toBe(t.textAlign)
    expect(ds?.lineHeight).toBe(String(t.lineHeight))
    expect(ds?.fontFamily).toBe(t.fontFamily) // DOM consumes the raw family
    expect(normColor(ds?.color ?? "")).toBe(normColor(hexToRgb(t.color)))
    expect(dom.container.textContent).toContain("Hello")

    const pdf = render(<TextBlockPdf block={block} variables={[]} />)
    const ps = pdfWrapperStyle(pdf.container)
    expect(ps?.fontSize).toBeCloseTo(pxToPt(t.fontSizePx))
    expect(ps?.textAlign).toBe(t.textAlign)
    expect(ps?.lineHeight).toBeCloseTo(t.lineHeight)
    // pdf consumes the family through mapFontFamilyToPdf — a different transform
    expect(ps?.fontFamily).toBe(mapFontFamilyToPdf(t.fontFamily, t.isHeading))
    expect(String(ps?.color).toLowerCase()).toBe(t.color.toLowerCase())
    expect(pdf.container.textContent).toContain("Hello")
  })

  it("maps a non-default font family per-renderer (DOM raw, pdf mapped)", () => {
    const block = tBlock("Hi", { fontFamily: "Georgia" })
    const dom = render(<TextBlockView block={block} variables={[]} />)
    expect(domContentStyle(dom.container)?.fontFamily).toBe("Georgia")

    const pdf = render(<TextBlockPdf block={block} variables={[]} />)
    // Georgia -> Times-Roman is exactly the transform the DOM does NOT apply.
    expect(pdfWrapperStyle(pdf.container)?.fontFamily).toBe("Times-Roman")
  })

  it("honors a non-left textAlign in both trees", () => {
    const block = tBlock("Centered", { textAlign: "center" })
    const dom = render(<TextBlockView block={block} variables={[]} />)
    expect(domContentStyle(dom.container)?.textAlign).toBe("center")

    const pdf = render(<TextBlockPdf block={block} variables={[]} />)
    expect(pdfWrapperStyle(pdf.container)?.textAlign).toBe("center")
  })

  it("paints highlightColor in both trees", () => {
    const block = tBlock("Hi", { highlightColor: "#FFFF00" })
    const dom = render(<TextBlockView block={block} variables={[]} />)
    expect(normColor(domContentStyle(dom.container)?.backgroundColor ?? "")).toBe(
      normColor(hexToRgb("#FFFF00")),
    )

    const pdf = render(<TextBlockPdf block={block} variables={[]} />)
    const painted = Array.from(pdf.container.querySelectorAll("pdf-view"))
      .map((v) => parseStyle(v))
      .find((s) => s.backgroundColor !== undefined)
    expect(painted?.backgroundColor).toBe("#FFFF00")
  })

  it("reflects the heading size + bold from blockType in both trees", () => {
    const block = tBlock("Title", { blockType: "h2" })
    const spec = deriveTextSpec(block, { variables: [] })
    expect(spec.typography.fontSizePx).toBe(20)

    const dom = render(<TextBlockView block={block} variables={[]} />)
    expect(domContentStyle(dom.container)?.fontSize).toBe("20px")
    expect(domContentStyle(dom.container)?.fontWeight).toBe("700") // DOM bold via weight

    const pdf = render(<TextBlockPdf block={block} variables={[]} />)
    const ps = pdfWrapperStyle(pdf.container)
    expect(ps?.fontSize).toBeCloseTo(pxToPt(20))
    // pdf bold via the -Bold family variant, not a weight
    expect(ps?.fontFamily).toBe(mapFontFamilyToPdf(spec.typography.fontFamily, true))
  })

  it("sizes an in-content <h2> consistently in both trees", () => {
    const block = tBlock("<h2>Section</h2>")
    const dom = render(<TextBlockView block={block} variables={[]} />)
    const headingSpan = Array.from(dom.container.querySelectorAll("span")).find(
      (s) => (s as HTMLElement).style.fontSize === "20px",
    )
    expect(headingSpan).toBeTruthy()

    const pdf = render(<TextBlockPdf block={block} variables={[]} />)
    const headingNode = Array.from(pdf.container.querySelectorAll("pdf-text"))
      .map((el) => parseStyle(el))
      .find((s) => typeof s.fontSize === "number" && Math.abs((s.fontSize as number) - pxToPt(20)) < 0.01)
    expect(headingNode).toBeTruthy()
  })

  it("applies block layout exactly once via the mapper (no pdf double-paint)", () => {
    const block: TextBlock = {
      id: "t1",
      type: "text",
      content: "Hi",
      layout: { marginTop: 20, paddingLeft: 10 },
    }
    const { container } = render(
      <ExportPdfBlockMapper
        block={block}
        variables={[]}
        data={{} as ExportData}
        imageMap={new Map()}
      />,
    )
    const views = Array.from(container.querySelectorAll("pdf-view")).map((v) => parseStyle(v))
    expect(views.filter((s) => s.marginTop === 20)).toHaveLength(1)
    expect(views.filter((s) => s.paddingLeft === 10)).toHaveLength(1)
  })

  it("resolves a known variable to the same value in both trees", () => {
    const block = tBlock("By {{projectName}}")
    const dom = render(<TextBlockView block={block} variables={TEXT_VARS} />)
    expect(dom.container.textContent).toContain("By Acme Shoot")
    expect(dom.container.textContent).not.toContain("{{projectName}}")

    const pdf = render(<TextBlockPdf block={block} variables={TEXT_VARS} />)
    expect(pdf.container.textContent).toContain("By Acme Shoot")
    expect(pdf.container.textContent).not.toContain("{{projectName}}")
  })

  it("renders a render token as a DOM sentinel + a pdf render callback", () => {
    const block = tBlock("Page {{pageNumber}}")
    const dom = render(<TextBlockView block={block} variables={TEXT_VARS} />)
    expect(dom.container.querySelector('[data-render-token="pageNumber"]')).not.toBeNull()

    const pdf = render(<TextBlockPdf block={block} variables={TEXT_VARS} />)
    expect(pdf.container.querySelector('pdf-text[data-has-render="true"]')).not.toBeNull()
  })

  it("warning-paints an unresolved token in both trees", () => {
    const block = tBlock("Hi {{bogus}}")
    const dom = render(<TextBlockView block={block} variables={TEXT_VARS} />)
    const flagged = dom.container.querySelector('[data-unresolved-token="true"]')
    expect(flagged).not.toBeNull()
    expect((flagged as HTMLElement).textContent).toBe("{{bogus}}")

    const pdf = render(<TextBlockPdf block={block} variables={TEXT_VARS} />)
    const painted = Array.from(pdf.container.querySelectorAll("pdf-text")).find(
      (el) => el.textContent === "{{bogus}}",
    )
    expect(painted).toBeTruthy()
    expect(parseStyle(painted ?? null).backgroundColor).toBe(WARNING_BG)
  })
})
