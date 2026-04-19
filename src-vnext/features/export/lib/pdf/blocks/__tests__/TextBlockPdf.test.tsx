import { describe, expect, it, vi } from "vitest"

// Mock @react-pdf/renderer so we can render the component tree into
// queryable DOM elements. We serialize the `style` prop into a JSON
// data-attribute so tests can assert on it, and convert the `render`
// callback into a marker attribute so tests can confirm the render-token
// branch is still wiring up page-number callbacks.
vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  const serializeStyle = (style: unknown) => {
    if (style === undefined || style === null) return undefined
    try {
      return JSON.stringify(style)
    } catch {
      return undefined
    }
  }
  return {
    Document: (props: Record<string, unknown>) =>
      React.createElement("pdf-document", props, props.children),
    Page: (props: Record<string, unknown>) =>
      React.createElement("pdf-page", props, props.children),
    Text: (props: Record<string, unknown>) => {
      const { style, render, children, ...rest } = props as {
        style?: unknown
        render?: unknown
        children?: unknown
      } & Record<string, unknown>
      const domProps: Record<string, unknown> = {
        ...rest,
        "data-style": serializeStyle(style),
      }
      if (typeof render === "function") {
        domProps["data-has-render"] = "true"
      }
      return React.createElement("pdf-text", domProps, children as React.ReactNode)
    },
    View: (props: Record<string, unknown>) => {
      const { style, children, ...rest } = props as {
        style?: unknown
        children?: unknown
      } & Record<string, unknown>
      return React.createElement(
        "pdf-view",
        { ...rest, "data-style": serializeStyle(style) },
        children as React.ReactNode,
      )
    },
    StyleSheet: { create: (s: unknown) => s },
  }
})

import React from "react"
import { render } from "@testing-library/react"
import { TextBlockPdf } from "../TextBlockPdf"
import type { TextBlock, ExportVariable } from "../../../../types/exportBuilder"

const WARNING_BG = "#FEF3C7"
const WARNING_FG = "#92400E"

function makeBlock(content: string): TextBlock {
  return {
    id: "block-1",
    type: "text",
    content,
  }
}

/** Built-in variables that the export builder always provides. */
function builtInVariables(): readonly ExportVariable[] {
  return [
    { key: "projectName", label: "Project Name", value: "Test Project", source: "dynamic" },
    { key: "clientName", label: "Client", value: "Test Client", source: "dynamic" },
    { key: "shootDates", label: "Shoot Dates", value: "", source: "dynamic" },
    { key: "currentDate", label: "Current Date", value: "2026-04-16", source: "dynamic" },
    // Render-time tokens — values intentionally keep the {{token}} form
    { key: "pageNumber", label: "Page Number", value: "{{pageNumber}}", source: "dynamic" },
    { key: "pageCount", label: "Page Count", value: "{{pageCount}}", source: "dynamic" },
    { key: "shotCount", label: "Shot Count", value: "0", source: "dynamic" },
    { key: "productCount", label: "Product Count", value: "0", source: "dynamic" },
  ]
}

/** Find a pdf-text element whose text content equals the given literal. */
function findTextByContent(container: HTMLElement, literal: string): HTMLElement | null {
  const candidates = Array.from(container.querySelectorAll("pdf-text"))
  for (const el of candidates) {
    if (el.textContent === literal) return el as HTMLElement
  }
  return null
}

/** Parse the serialized style JSON from a rendered element. */
function parseStyle(el: Element | null): Record<string, unknown> | null {
  if (!el) return null
  const raw = el.getAttribute("data-style")
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

describe("TextBlockPdf — unresolved-token highlighting", () => {
  it("highlights {{bogus}} when block ALSO contains render tokens (regression)", () => {
    // RED test: before the fix, the render-token branch skips
    // findUnresolvedTokens / renderWithWarningHighlights, so {{bogus}}
    // renders as plain text without the yellow highlight.
    const block = makeBlock("Page {{pageNumber}} of {{pageCount}} — {{bogus}}")
    const { container } = render(
      <TextBlockPdf block={block} variables={builtInVariables()} />,
    )

    const bogusEl = findTextByContent(container, "{{bogus}}")
    expect(bogusEl).not.toBeNull()

    const style = parseStyle(bogusEl)
    expect(style).not.toBeNull()
    expect(style?.backgroundColor).toBe(WARNING_BG)
    expect(style?.color).toBe(WARNING_FG)
  })

  it("highlights {{bogus}} when block has NO render tokens (happy path)", () => {
    // Should pass both before and after the fix — this is the existing
    // plain-text fallback path. Pins it so refactoring doesn't regress.
    const block = makeBlock("Just {{bogus}}")
    const { container } = render(
      <TextBlockPdf block={block} variables={builtInVariables()} />,
    )

    const bogusEl = findTextByContent(container, "{{bogus}}")
    expect(bogusEl).not.toBeNull()

    const style = parseStyle(bogusEl)
    expect(style?.backgroundColor).toBe(WARNING_BG)
    expect(style?.color).toBe(WARNING_FG)
  })

  it("preserves the render-token callback for {{pageNumber}}", () => {
    // Passes before and after the fix — confirms the render prop still
    // wires up to @react-pdf/renderer. Pins the fix so it doesn't break
    // page-number rendering.
    const block = makeBlock("Page {{pageNumber}}")
    const { container } = render(
      <TextBlockPdf block={block} variables={builtInVariables()} />,
    )

    const renderEls = container.querySelectorAll('pdf-text[data-has-render="true"]')
    expect(renderEls.length).toBeGreaterThanOrEqual(1)
  })

  it("preserves the render-token callback for {{pageCount}}", () => {
    const block = makeBlock("Page {{pageNumber}} of {{pageCount}}")
    const { container } = render(
      <TextBlockPdf block={block} variables={builtInVariables()} />,
    )

    const renderEls = container.querySelectorAll('pdf-text[data-has-render="true"]')
    // One for pageNumber, one for pageCount
    expect(renderEls.length).toBeGreaterThanOrEqual(2)
  })

  it("does NOT highlight recognized non-render tokens ({{projectName}})", () => {
    // Regression guard: {{projectName}} should be resolved to 'Test Project'
    // (via resolveVariables) — the literal {{projectName}} must not leak
    // into the rendered tree as a highlighted token.
    const block = makeBlock("Project {{projectName}} — page {{pageNumber}}")
    const { container } = render(
      <TextBlockPdf block={block} variables={builtInVariables()} />,
    )

    const leaked = findTextByContent(container, "{{projectName}}")
    expect(leaked).toBeNull()
  })
})
