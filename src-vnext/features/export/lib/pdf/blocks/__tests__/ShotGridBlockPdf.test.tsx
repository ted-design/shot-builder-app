import { describe, it, expect, vi } from "vitest"

// Mock @react-pdf/renderer into queryable DOM elements (mirrors TextBlockPdf.test).
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
    Image: (props: Record<string, unknown>) => {
      const { style, src, ...rest } = props as {
        style?: unknown
        src?: unknown
      } & Record<string, unknown>
      return React.createElement("pdf-image", {
        ...rest,
        src: src as string,
        "data-style": ser(style),
      })
    },
    StyleSheet: { create: (s: unknown) => s },
  }
})

import { render } from "@testing-library/react"
import { ShotGridBlockPdf } from "../ShotGridBlockPdf"
import type { ShotGridBlock } from "../../../../types/exportBuilder"
import type { ExportData } from "../../../../hooks/useExportData"
import type { Shot } from "@/shared/types"

function buildBlock(): ShotGridBlock {
  return {
    id: "sg1",
    type: "shot-grid",
    columns: [
      { key: "shotNumber", label: "#", visible: true, width: "xs" },
      { key: "thumbnail", label: "Thumbnail", visible: true, width: "sm" },
      { key: "title", label: "Title", visible: true, width: "md" },
    ],
    sortBy: "shotNumber",
    tableStyle: { showBorders: true, showHeaderBg: true, stripeRows: false },
  }
}

const SHOTS = [
  {
    id: "s1",
    shotNumber: "1",
    title: "Hero shot",
    status: "todo",
    heroImage: { path: "shots/s1/hero.jpg", downloadURL: "https://example.com/hero.jpg" },
  },
  { id: "s2", shotNumber: "2", title: "No hero", status: "todo" },
] as unknown as Shot[]

function buildData(): ExportData {
  return {
    project: null,
    shots: SHOTS,
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: [],
    loading: false,
  } as unknown as ExportData
}

const IMAGE_MAP = new Map<string, string>([
  ["shots/s1/hero.jpg", "data:image/jpeg;base64,AAAA"],
])

describe("ShotGridBlockPdf — thumbnails (P0-2)", () => {
  it("keeps the Thumbnail column header (no longer stripped)", () => {
    const { container } = render(
      <ShotGridBlockPdf block={buildBlock()} data={buildData()} imageMap={IMAGE_MAP} />,
    )
    const headers = Array.from(container.querySelectorAll("pdf-text")).map(
      (e) => e.textContent,
    )
    expect(headers).toContain("Thumbnail")
  })

  it("embeds the resolved hero image for a shot with a mapped hero", () => {
    const { container } = render(
      <ShotGridBlockPdf block={buildBlock()} data={buildData()} imageMap={IMAGE_MAP} />,
    )
    const imgs = Array.from(container.querySelectorAll("pdf-image"))
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.getAttribute("src")).toBe("data:image/jpeg;base64,AAAA")
  })

  it("renders an empty thumbnail cell (no Image, no crash) when the hero is unmapped/absent", () => {
    const { container } = render(
      <ShotGridBlockPdf block={buildBlock()} data={buildData()} imageMap={new Map()} />,
    )
    expect(container.querySelectorAll("pdf-image")).toHaveLength(0)
  })
})
