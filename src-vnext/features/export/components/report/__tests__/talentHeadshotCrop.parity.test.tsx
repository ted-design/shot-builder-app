import { describe, it, expect, vi, afterEach } from "vitest"

// Falsifiable DOM-vs-PDF parity for the ADJUSTABLE HEADSHOT CROP (R4 Phase C,
// Talent part 2). The contact-sheet layout crops each headshot into a fixed 4:5
// frame; the per-talent crop {scale,x,y} is folded onto the resolved model entry
// (entry.crop), so BOTH the DOM <img> and the @react-pdf <Image> read the SAME
// value. This proves screen and PDF can't drift on the crop.
//
// The load-bearing claim: for a given entry.crop, the DOM img's object-position +
// transform equal the PDF Image's objectPositionX/Y + transform (same focal point,
// same zoom). Mutate the crop math on either side and the matching assertion reds.
//
// Mock @react-pdf into queryable DOM (mirrors blockConsumers.parity) — but here we
// ALSO serialize the Image style (flattened from an array) to data-style so the
// PDF Image's crop props are inspectable.

vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  // Flatten @react-pdf's array-of-styles into one object, then JSON-serialize.
  const flatten = (s: unknown): Record<string, unknown> => {
    if (Array.isArray(s)) return Object.assign({}, ...s.map(flatten))
    return (s ?? {}) as Record<string, unknown>
  }
  const ser = (s: unknown) => {
    try {
      return JSON.stringify(flatten(s))
    } catch {
      return undefined
    }
  }
  return {
    Document: (p: Record<string, unknown>) =>
      React.createElement("pdf-document", null, p.children as React.ReactNode),
    Page: (p: Record<string, unknown>) =>
      React.createElement("pdf-page", null, p.children as React.ReactNode),
    View: (p: Record<string, unknown>) => {
      const { style, children, ...rest } = p as { style?: unknown; children?: unknown } & Record<string, unknown>
      return React.createElement("pdf-view", { ...rest, "data-style": ser(style) }, children as React.ReactNode)
    },
    Text: (p: Record<string, unknown>) =>
      React.createElement("pdf-text", null, p.children as React.ReactNode),
    Image: (p: Record<string, unknown>) => {
      const { style } = p as { style?: unknown }
      return React.createElement("pdf-image", { "data-style": ser(style) })
    },
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render, screen, fireEvent } from "@testing-library/react"
import { TalentReportView } from "../TalentReportView"
import { TalentPdfDocument } from "../../../lib/report/reportPdfTalent"
import {
  DEFAULT_TALENT_CONFIG,
  DEFAULT_HEADSHOT_CROP,
} from "../../../lib/report/talentTypes"
import type {
  HeadshotCrop,
  TalentEntry,
  TalentLayout,
  TalentModel,
} from "../../../lib/report/talentTypes"

const noop = (): void => {}
const IMG = "candidate.jpg"
// Empty resolveSrc returns null (candidate not in map) -> initials render, no <img>.
// A populated map makes both renderers draw the actual image so its crop style shows.
const IMAGE_MAP = new Map([[IMG, "data:image/png;base64,AAAA"]])

function entry(over: Partial<TalentEntry> & { id: string; name: string }): TalentEntry {
  return {
    id: over.id,
    name: over.name,
    gender: over.gender ?? "female",
    genderLabel: over.genderLabel ?? "Female",
    agency: over.agency ?? "Elite",
    email: over.email ?? null,
    phone: over.phone ?? null,
    web: over.web ?? null,
    headshot: over.headshot ?? IMG,
    measurements: over.measurements ?? [],
    excluded: over.excluded ?? false,
    appears: over.appears ?? [],
    crop: over.crop ?? DEFAULT_HEADSHOT_CROP,
  }
}

function modelOf(items: readonly TalentEntry[], layout: TalentLayout): TalentModel {
  return {
    project: { name: "Q2-26 No. 3", client: "Unbound Merino", dateRange: "Jun 2–6, 2026", talentCount: items.length },
    groups: [{ key: "all", label: "All talent", count: items.length, items }],
    layout,
  }
}

function renderDom(model: TalentModel, onConfigChange: (c: unknown) => void = noop, config = { ...DEFAULT_TALENT_CONFIG, layout: model.layout }) {
  return render(
    <TalentReportView
      model={model}
      imageMap={IMAGE_MAP}
      config={config as never}
      onConfigChange={onConfigChange as never}
      onExportPdf={noop}
    />,
  )
}
function renderPdf(model: TalentModel) {
  return render(<TalentPdfDocument model={model} imageMap={IMAGE_MAP} />)
}

// The screen headshot lives in the FLUID grid (not the hidden paged preview);
// scope reads to it so the paged copy never confuses the count.
function domHeadshotImg(container: HTMLElement): HTMLImageElement {
  const img = container.querySelector<HTMLImageElement>(".sb-tr-fluid .sb-tr-cs-frame img")
  if (!img) throw new Error("no contact-sheet headshot img rendered")
  return img
}
function pdfImageStyle(container: HTMLElement): Record<string, unknown> {
  const el = container.querySelector("pdf-image")
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

describe("headshot crop — DOM img and PDF Image read the SAME crop value", () => {
  it("a custom crop places the same focal point + zoom on BOTH surfaces", () => {
    const CROP: HeadshotCrop = { scale: 1.5, x: 0.25, y: 0.1 }
    const model = modelOf([entry({ id: "tA", name: "Ava Stone", crop: CROP })], "contact-sheet")

    const img = domHeadshotImg(renderDom(model).container)
    const pdf = pdfImageStyle(renderPdf(model).container)

    // focal point — DOM shorthand "25% 10%" equals PDF X/Y "25%","10%"
    expect(img.style.objectPosition).toBe("25% 10%")
    expect(pdf.objectPositionX).toBe("25%")
    expect(pdf.objectPositionY).toBe("10%")
    expect(img.style.objectPosition).toBe(`${String(pdf.objectPositionX)} ${String(pdf.objectPositionY)}`)

    // zoom — same transform string on both surfaces
    expect(img.style.transform).toBe("scale(1.5)")
    expect(pdf.transform).toBe("scale(1.5)")

    // the crop is a COVER crop on both (fixed 4:5 frame)
    expect(img.style.objectFit).toBe("cover")
    expect(pdf.objectFit).toBe("cover")
  })

  it("the default crop centers the focal point and applies no zoom on BOTH surfaces", () => {
    const model = modelOf([entry({ id: "tA", name: "Ava Stone" })], "contact-sheet") // default crop
    const img = domHeadshotImg(renderDom(model).container)
    const pdf = pdfImageStyle(renderPdf(model).container)

    expect(img.style.objectPosition).toBe("50% 50%")
    expect(pdf.objectPositionX).toBe("50%")
    expect(pdf.objectPositionY).toBe("50%")
    // scale 1 => no transform on either surface
    expect(img.style.transform).toBe("")
    expect(pdf.transform).toBeUndefined()
  })
})

describe("headshot crop — detail layout is never cropped", () => {
  it("detail keeps a native-aspect (contain) headshot, no cover/object-position", () => {
    const CROP: HeadshotCrop = { scale: 2, x: 0.9, y: 0.9 }
    // Even with a crop present on the entry, the detail card ignores it.
    const model = modelOf([entry({ id: "tA", name: "Ava Stone", crop: CROP })], "detail")
    const dom = renderDom(model).container
    const pdf = renderPdf(model).container
    // detail DOM headshot is .sb-tr-headshot-frame (not .sb-tr-cs-frame)
    const detailImg = dom.querySelector<HTMLImageElement>(".sb-tr-fluid .sb-tr-headshot-frame img")
    expect(detailImg).not.toBeNull()
    expect(detailImg?.style.objectFit).not.toBe("cover")
    // no contact-sheet crop frame at all in detail
    expect(dom.querySelector(".sb-tr-cs-frame")).toBeNull()
    // the PDF detail Image is objectFit contain, no focal offset
    const pdfImg = pdfImageStyle(pdf)
    expect(pdfImg.objectPositionX).toBeUndefined()
    expect(pdfImg.transform).toBeUndefined()
  })
})

describe("headshot crop picker — screen-only, gated behind featureReportConfig", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("flag OFF: no crop picker renders", () => {
    const { container } = renderDom(modelOf([entry({ id: "tA", name: "Ava Stone" })], "contact-sheet"))
    expect(container.querySelectorAll('input[type="range"]').length).toBe(0)
    expect(container.querySelector(".sb-tr-crop-picker")).toBeNull()
  })

  it("flag ON + contact-sheet: a zoom slider + focal dot render (screen-only)", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const { container } = renderDom(modelOf([entry({ id: "tA", name: "Ava Stone" })], "contact-sheet"))
    const picker = container.querySelector(".sb-tr-crop-picker")
    expect(picker).not.toBeNull()
    expect(picker?.classList.contains("no-print")).toBe(true) // never prints
    // exactly one slider (fluid card only — the paged preview carries no picker)
    expect(container.querySelectorAll('input[type="range"]').length).toBe(1)
    expect(container.querySelector(".sb-tr-crop-focal")).not.toBeNull()
  })

  it("flag ON + detail: NO crop picker (crop is contact-sheet only)", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const { container } = renderDom(modelOf([entry({ id: "tA", name: "Ava Stone" })], "detail"))
    expect(container.querySelectorAll('input[type="range"]').length).toBe(0)
    expect(container.querySelector(".sb-tr-crop-picker")).toBeNull()
  })

  it("flag ON: dragging the zoom slider writes headshotCrops[id].scale via onConfigChange", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const spy = vi.fn()
    renderDom(modelOf([entry({ id: "tA", name: "Ava Stone" })], "contact-sheet"), spy)
    const slider = screen.getByRole("slider")
    fireEvent.change(slider, { target: { value: "2" } })
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        headshotCrops: expect.objectContaining({ tA: expect.objectContaining({ scale: 2 }) }),
      }),
    )
  })
})
