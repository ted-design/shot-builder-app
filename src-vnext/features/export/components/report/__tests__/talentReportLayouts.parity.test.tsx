import { describe, it, expect, vi, afterEach } from "vitest"

// Falsifiable DOM-vs-PDF parity for the Talent density enum (R4 Phase C).
// One resolved TalentModel feeds BOTH the DOM TalentReportView and the @react-pdf
// TalentPdfDocument, so screen and PDF can't drift. We mock @react-pdf into
// queryable DOM (mirrors ExportPdfDocument.test + blockConsumers.parity) so the
// PDF renderer's structural selection is inspectable by text content / node count.
//
// The load-bearing claim: contact-sheet HIDES the contact block + measurements
// grid + per-shot "In shots" list on BOTH surfaces and packs a denser grid;
// detail SHOWS all. Mutate a hidden-block condition on either side and the
// matching assertion goes red.

vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  return {
    Document: (p: Record<string, unknown>) =>
      React.createElement("pdf-document", null, p.children as React.ReactNode),
    Page: (p: Record<string, unknown>) =>
      React.createElement("pdf-page", null, p.children as React.ReactNode),
    View: (p: Record<string, unknown>) =>
      React.createElement("pdf-view", null, p.children as React.ReactNode),
    Text: (p: Record<string, unknown>) =>
      React.createElement("pdf-text", null, p.children as React.ReactNode),
    Image: () => React.createElement("pdf-image", null),
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render, screen, fireEvent } from "@testing-library/react"
import { TalentReportView } from "../TalentReportView"
import { TalentPdfDocument } from "../../../lib/report/reportPdfTalent"
import { DEFAULT_HEADSHOT_CROP, DEFAULT_TALENT_CONFIG } from "../../../lib/report/talentTypes"
import type {
  TalentEntry,
  TalentLayout,
  TalentModel,
} from "../../../lib/report/talentTypes"

const noop = (): void => {}

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
    headshot: over.headshot ?? null,
    measurements: over.measurements ?? [],
    excluded: over.excluded ?? false,
    appears: over.appears ?? [],
    crop: over.crop ?? DEFAULT_HEADSHOT_CROP,
  }
}

// A talent carrying every optional block + an on-hold appearance (drives the HOLD flag).
const AVA: TalentEntry = entry({
  id: "tA",
  name: "Ava Stone",
  agency: "Elite",
  email: "ava@example.co",
  measurements: [{ label: "Height", value: `5'10"` }],
  appears: [{ number: "01", title: "Trail Crew", looks: ["Primary"], status: "on_hold" }],
})

function modelOf(items: readonly TalentEntry[], layout: TalentLayout): TalentModel {
  return {
    project: {
      name: "Q2-26 No. 3",
      client: "Unbound Merino",
      dateRange: "Jun 2–6, 2026",
      talentCount: items.length,
    },
    groups: [{ key: "all", label: "All talent", count: items.length, items }],
    layout,
  }
}

function renderDom(model: TalentModel, onConfigChange: (c: unknown) => void = noop) {
  return render(
    <TalentReportView
      model={model}
      imageMap={new Map()}
      config={{ ...DEFAULT_TALENT_CONFIG, layout: model.layout }}
      onConfigChange={onConfigChange as never}
      onExportPdf={noop}
    />,
  )
}

function renderPdf(model: TalentModel) {
  return render(<TalentPdfDocument model={model} imageMap={new Map()} />)
}

describe("Talent layout — content parity (DOM vs PDF consume one model)", () => {
  it("detail SHOWS contact + measurements + per-shot list on BOTH surfaces", () => {
    const model = modelOf([AVA], "detail")
    const dom = renderDom(model).container.textContent ?? ""
    const pdf = renderPdf(model).container.textContent ?? ""
    for (const surface of [dom, pdf]) {
      expect(surface).toContain("Email") // contact block
      expect(surface).toContain("Height") // measurements grid
      expect(surface).toContain("Trail Crew") // per-shot "In shots" list
    }
  })

  it("contact-sheet HIDES contact + measurements + per-shot list on BOTH surfaces", () => {
    const model = modelOf([AVA], "contact-sheet")
    const dom = renderDom(model).container.textContent ?? ""
    const pdf = renderPdf(model).container.textContent ?? ""
    for (const surface of [dom, pdf]) {
      expect(surface).not.toContain("Email") // no contact block
      expect(surface).not.toContain("Height") // no measurements grid
      expect(surface).not.toContain(`5'10"`) // ...not even the measurement value
      expect(surface).not.toContain("Trail Crew") // no per-shot list
      // casting-board essentials remain on both surfaces
      expect(surface).toContain("Ava Stone") // name
      expect(surface).toContain("Elite") // agency
    }
  })

  it("contact-sheet shows the RED=HOLD flag for a talent with an on-hold shot (BOTH surfaces)", () => {
    const model = modelOf([AVA], "contact-sheet")
    const dom = (renderDom(model).container.textContent ?? "").toLowerCase()
    const pdf = (renderPdf(model).container.textContent ?? "").toLowerCase()
    expect(dom).toContain("hold")
    expect(pdf).toContain("hold")
  })
})

describe("Talent layout — density parity (contact-sheet packs denser)", () => {
  const eight = Array.from({ length: 8 }, (_, i) => entry({ id: `t${i}`, name: `Talent ${i}` }))

  it("contact-sheet fits more talent per sheet than detail on BOTH surfaces", () => {
    const detailSheets = renderDom(modelOf(eight, "detail")).container.querySelectorAll(".sb-tr-sheet").length
    const contactSheets = renderDom(modelOf(eight, "contact-sheet")).container.querySelectorAll(".sb-tr-sheet").length
    const detailPages = renderPdf(modelOf(eight, "detail")).container.querySelectorAll("pdf-page").length
    const contactPages = renderPdf(modelOf(eight, "contact-sheet")).container.querySelectorAll("pdf-page").length

    expect(contactSheets).toBeLessThan(detailSheets) // denser on screen
    expect(contactPages).toBeLessThan(detailPages) // denser in PDF
    expect(contactSheets).toBe(1) // 8 talent land on one contact sheet
    expect(contactPages).toBe(1)
  })
})

describe("Talent layout picker — gated behind featureReportConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("flag OFF: no Layout control renders (byte-identical control bar)", () => {
    const { queryByText } = renderDom(modelOf([AVA], "detail"))
    expect(queryByText("Layout")).toBeNull()
    expect(queryByText("Contact sheet")).toBeNull()
  })

  it("flag ON: the Layout segmented control renders with both options", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const { getByText } = renderDom(modelOf([AVA], "detail"))
    expect(getByText("Layout")).not.toBeNull()
    expect(getByText("Detail")).not.toBeNull()
    expect(getByText("Contact sheet")).not.toBeNull()
  })

  it("flag ON: clicking a layout option calls onConfigChange with the new layout", () => {
    vi.stubEnv("VITE_REPORT_CONFIG", "1")
    const spy = vi.fn()
    renderDom(modelOf([AVA], "detail"), spy)
    fireEvent.click(screen.getByText("Contact sheet"))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ layout: "contact-sheet" }))
  })
})
