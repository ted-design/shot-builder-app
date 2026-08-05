import { afterEach, describe, expect, it, vi } from "vitest"

// -----------------------------------------------------------------------------
// Product Info LAYOUT (density) DOM-vs-PDF parity — the load-bearing Phase C test.
// The DOM view (ProductInfoReportView) and the @react-pdf renderer
// (ProductInfoPdfDocument) both read the SAME resolved `model.layout` and the
// SAME pure geometry (PRODUCT_INFO_LAYOUT_GEOMETRY), so a density change can't
// drift between screen and print. This test is FALSIFIABLE by construction:
// mutate a per-layout column/per-sheet count on ONE renderer and a named case
// below goes red.
//
// @react-pdf is mocked so View/Text/Image/Page/Document render to queryable DOM
// nodes with a serialized `data-style` (mirrors blockConsumers.parity.test.tsx).
// -----------------------------------------------------------------------------
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
    (tag: string) =>
    (props: Record<string, unknown>) => {
      const { style, children, render, ...rest } = props as {
        style?: unknown
        children?: unknown
        render?: unknown
      } & Record<string, unknown>
      void render
      return React.createElement(tag, { ...rest, "data-style": ser(style) }, children as React.ReactNode)
    }
  return {
    Document: passthrough("pdf-document"),
    Page: passthrough("pdf-page"),
    View: passthrough("pdf-view"),
    Text: passthrough("pdf-text"),
    Image: passthrough("pdf-image"),
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render } from "@testing-library/react"
import { ProductInfoReportView } from "../ProductInfoReportView"
import { ProductInfoPdfDocument } from "../../../lib/report/reportPdfProductInfo"
import { COLOR } from "../../../lib/report/reportPdfShared"
import {
  DEFAULT_PRODUCT_INFO_CONFIG,
  PRODUCT_INFO_LAYOUT_GEOMETRY,
  type ProductInfoConfig,
  type ProductInfoEntry,
  type ProductInfoLayout,
  type ProductInfoModel,
} from "../../../lib/report/productInfoTypes"

// A single group (Women) with enough families that BOTH densities fill their
// first sheet/page (gallery 12, index 20 — both < 26), so first-sheet count ==
// cardsPerSheet on each surface.
const N = 26

function entry(i: number): ProductInfoEntry {
  return {
    id: `f${String(i)}`,
    styleName: `Style-${String(i).padStart(2, "0")}`,
    styleNumber: `SN-${String(i)}`,
    gender: "W",
    genderLabel: "Women",
    productType: "Tops",
    image: null,
    colours: ["Black"],
    sizes: ["M"],
    sizePending: false,
    isHero: i === 1, // one hero → exercises the hero mark on both surfaces
    excluded: false,
    appears: [{ number: String(i), looks: ["Primary"], status: "complete" }],
  }
}

function fixtureModel(layout: ProductInfoLayout): ProductInfoModel {
  const items = Array.from({ length: N }, (_, i) => entry(i + 1))
  return {
    project: { name: "Q2-26 No. 3", client: "unbound-merino", dateRange: "Jun 2–6, 2026", familyCount: N },
    groups: [{ key: "W", label: "Women", count: N, items }],
    layout,
  }
}

const cfg = (over: Partial<ProductInfoConfig> = {}): ProductInfoConfig => ({
  ...DEFAULT_PRODUCT_INFO_CONFIG,
  ...over,
})

function renderDom(layout: ProductInfoLayout) {
  return render(
    <ProductInfoReportView
      model={fixtureModel(layout)}
      imageMap={new Map()}
      config={cfg({ layout })}
      onConfigChange={() => {}}
      onExportPdf={() => {}}
    />,
  )
}

function renderPdf(layout: ProductInfoLayout) {
  return render(<ProductInfoPdfDocument model={fixtureModel(layout)} imageMap={new Map()} />)
}

const NAMES = new Set(Array.from({ length: N }, (_, i) => `Style-${String(i + 1).padStart(2, "0")}`))

// Count how many product-name cells land on the FIRST print sheet / PDF page.
function domFirstSheetCards(container: HTMLElement): number {
  const firstSheet = container.querySelector(".sb-pir-sheet .sb-pir-sheet-body")
  return firstSheet ? firstSheet.children.length : -1
}
function pdfFirstPageCards(container: HTMLElement): number {
  const firstPage = container.querySelector("pdf-page")
  if (!firstPage) return -1
  return Array.from(firstPage.querySelectorAll("pdf-text")).filter((t) =>
    NAMES.has((t.textContent ?? "").trim()),
  ).length
}

function pdfStyles(container: HTMLElement): Record<string, unknown>[] {
  return Array.from(container.querySelectorAll("pdf-view")).map((v) => {
    const raw = v.getAttribute("data-style")
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  })
}

const LAYOUTS: readonly ProductInfoLayout[] = ["gallery", "index"]

describe("Product Info layout — geometry is the single source both renderers read", () => {
  it("gallery and index declare DIFFERENT per-sheet packing (so the densities are real)", () => {
    expect(PRODUCT_INFO_LAYOUT_GEOMETRY.gallery.cardsPerSheet).not.toBe(
      PRODUCT_INFO_LAYOUT_GEOMETRY.index.cardsPerSheet,
    )
    expect(PRODUCT_INFO_LAYOUT_GEOMETRY.index.cardsPerSheet).toBeGreaterThan(
      PRODUCT_INFO_LAYOUT_GEOMETRY.gallery.cardsPerSheet,
    )
  })

  it.each(LAYOUTS)(
    "DOM print sheet AND PDF page pack the SAME cards-per-sheet for layout=%s",
    (layout) => {
      const expected = PRODUCT_INFO_LAYOUT_GEOMETRY[layout].cardsPerSheet
      const dom = domFirstSheetCards(renderDom(layout).container)
      const pdf = pdfFirstPageCards(renderPdf(layout).container)
      expect(dom).toBe(expected) // DOM PagedView reads the shared geometry
      expect(pdf).toBe(expected) // @react-pdf paginate reads the shared geometry
      expect(dom).toBe(pdf) // ...and therefore can't drift
    },
  )
})

describe("Product Info layout — structural block selection matches DOM<->PDF", () => {
  it("gallery shows the per-shot 'Appears in' block on BOTH surfaces", () => {
    const dom = renderDom("gallery").container
    const pdf = renderPdf("gallery").container
    expect(dom.querySelectorAll(".sb-pir-appears").length).toBeGreaterThan(0)
    expect(
      Array.from(pdf.querySelectorAll("pdf-text")).some((t) =>
        (t.textContent ?? "").startsWith("Appears in"),
      ),
    ).toBe(true)
  })

  it("index HIDES the per-shot 'Appears in' block on BOTH surfaces (compact rows)", () => {
    const dom = renderDom("index").container
    const pdf = renderPdf("index").container
    expect(dom.querySelectorAll(".sb-pir-appears").length).toBe(0)
    expect(
      Array.from(pdf.querySelectorAll("pdf-text")).some((t) =>
        (t.textContent ?? "").startsWith("Appears in"),
      ),
    ).toBe(false)
  })
})

describe("Product Info layout — canonical hero mark (critic fix: index is red-free / ink)", () => {
  it("gallery PDF keeps its shipped RED hero mark (byte-identity — unchanged)", () => {
    const styles = pdfStyles(renderPdf("gallery").container)
    expect(styles.some((s) => s.backgroundColor === COLOR.accent)).toBe(true)
  })

  it("index PDF uses the canonical INK hero mark and paints NO red anywhere", () => {
    const styles = pdfStyles(renderPdf("index").container)
    // Red-free surface (locked design system: RED owns HOLD; Product Info index is red-free).
    expect(styles.some((s) => s.backgroundColor === COLOR.accent)).toBe(false)
    // The canonical hero mark is an ink dot (backgroundColor === COLOR.text).
    expect(styles.some((s) => s.backgroundColor === COLOR.text)).toBe(true)
  })

  it("index DOM hero mark uses the ink class, not the red gallery hero tag", () => {
    const dom = renderDom("index").container
    expect(dom.querySelectorAll(".sb-pir-index-hero").length).toBeGreaterThan(0)
    // The red gallery hero tag must not appear on the index surface.
    expect(dom.querySelectorAll(".sb-pir-irow .sb-pir-hero-tag").length).toBe(0)
  })
})

describe("Product Info layout picker — gated behind featureReportConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("flag OFF: no Layout control renders (control bar byte-identical)", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "")
    const { queryByText } = renderDom("gallery")
    expect(queryByText("Layout")).toBeNull()
  })

  it("flag ON: Layout control renders and selecting Index emits config.layout='index'", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const onConfigChange = vi.fn()
    const config = cfg({ layout: "gallery" })
    const { getByText, getByRole } = render(
      <ProductInfoReportView
        model={fixtureModel("gallery")}
        imageMap={new Map()}
        config={config}
        onConfigChange={onConfigChange}
        onExportPdf={() => {}}
      />,
    )
    expect(getByText("Layout")).not.toBeNull()
    // Image size stays available while the resolved layout is gallery.
    expect(getByText("Image size")).not.toBeNull()
    getByRole("button", { name: "Index" }).click()
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ layout: "index" }))
  })

  it("flag ON + resolved index layout: the gallery-only Image size knob is hidden", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const { queryByText } = render(
      <ProductInfoReportView
        model={fixtureModel("index")}
        imageMap={new Map()}
        config={cfg({ layout: "index" })}
        onConfigChange={() => {}}
        onExportPdf={() => {}}
      />,
    )
    expect(queryByText("Image size")).toBeNull()
  })
})
