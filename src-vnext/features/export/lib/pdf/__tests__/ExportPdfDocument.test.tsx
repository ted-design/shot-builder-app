import { describe, expect, it, vi } from "vitest"

vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  return {
    Document: (props: Record<string, unknown>) =>
      React.createElement("pdf-document", props, props.children),
    Page: (props: Record<string, unknown>) =>
      React.createElement("pdf-page", props, props.children),
    Text: (props: Record<string, unknown>) =>
      React.createElement("pdf-text", props),
    View: (props: Record<string, unknown>) =>
      React.createElement("pdf-view", props, props.children),
    StyleSheet: { create: (s: unknown) => s },
  }
})

import React from "react"
import { render } from "@testing-library/react"
import { ExportPdfDocument } from "../ExportPdfDocument"
import type { PageSettings, ExportVariable, PageItem } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"

function makeProps(overrides?: {
  documentName?: string
  authorName?: string
}) {
  const settings: PageSettings = {
    layout: "portrait",
    size: "letter",
    fontFamily: "Inter",
  }
  const variables: ExportVariable[] = []
  const data: ExportData = {
    project: null,
    shots: [],
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: [],
    loading: false,
  }
  const pages: readonly (readonly PageItem[])[] = [[]]
  const imageMap = new Map<string, string>()

  return {
    pages,
    settings,
    variables,
    data,
    imageMap,
    documentName: overrides?.documentName,
    authorName: overrides?.authorName,
  }
}

describe("ExportPdfDocument metadata", () => {
  it("passes title prop to Document derived from documentName", () => {
    const props = makeProps({ documentName: "FW26 Campaign - Shot List" })
    const { container } = render(<ExportPdfDocument {...props} />)
    const doc = container.querySelector("pdf-document")
    expect(doc).toBeTruthy()
    expect(doc?.getAttribute("title")).toBe("FW26 Campaign - Shot List")
  })

  it("passes author prop to Document from authorName", () => {
    const props = makeProps({ authorName: "Ted Ghanime" })
    const { container } = render(<ExportPdfDocument {...props} />)
    const doc = container.querySelector("pdf-document")
    expect(doc?.getAttribute("author")).toBe("Ted Ghanime")
  })

  it("passes producer prop as Production Hub", () => {
    const props = makeProps()
    const { container } = render(<ExportPdfDocument {...props} />)
    const doc = container.querySelector("pdf-document")
    expect(doc?.getAttribute("producer")).toBe("Production Hub")
  })

  it("defaults title to Export when documentName is undefined", () => {
    const props = makeProps()
    const { container } = render(<ExportPdfDocument {...props} />)
    const doc = container.querySelector("pdf-document")
    expect(doc?.getAttribute("title")).toBe("Export")
  })

  it("defaults author to empty string when authorName is undefined", () => {
    const props = makeProps()
    const { container } = render(<ExportPdfDocument {...props} />)
    const doc = container.querySelector("pdf-document")
    expect(doc?.getAttribute("author")).toBe("")
  })
})
