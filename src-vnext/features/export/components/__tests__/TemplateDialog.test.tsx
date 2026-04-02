import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TemplateDialog } from "../TemplateDialog"
import { BUILT_IN_TEMPLATES } from "../../lib/builtInTemplates"
import type { ExportTemplate } from "../../types/exportBuilder"

// Mock localStorage for saved templates
let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() { return storage.size },
    key: (index: number) => [...storage.keys()][index] ?? null,
  })
})

describe("TemplateDialog", () => {
  it("renders all built-in template names", () => {
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    for (const template of BUILT_IN_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument()
    }
  })

  it("renders template descriptions", () => {
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    for (const template of BUILT_IN_TEMPLATES) {
      expect(screen.getByText(template.description)).toBeInTheDocument()
    }
  })

  it("has Cancel and Use Template buttons", () => {
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /use template/i })).toBeInTheDocument()
  })

  it("Use Template button is disabled when nothing is selected", () => {
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /use template/i })).toBeDisabled()
  })

  it("calls onSelectTemplate when a template is selected and confirmed", () => {
    const onSelect = vi.fn()
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={onSelect}
      />,
    )

    // Click the first built-in template
    fireEvent.click(screen.getByText(BUILT_IN_TEMPLATES[0]!.name))
    // Click Use Template
    fireEvent.click(screen.getByRole("button", { name: /use template/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: BUILT_IN_TEMPLATES[0]!.id }),
    )
  })

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    const onOpenChange = vi.fn()
    render(
      <TemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectTemplate={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows saved tab with empty message when no saved templates exist", async () => {
    const user = userEvent.setup()
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    // Use userEvent to click the Saved tab (Radix uses pointer events)
    await user.click(screen.getByRole("tab", { name: /saved/i }))
    expect(screen.getByText(/no saved templates/i)).toBeInTheDocument()
  })

  it("shows saved templates from localStorage", async () => {
    const user = userEvent.setup()
    const saved: ExportTemplate[] = [
      {
        id: "saved-1",
        name: "My Custom Template",
        description: "Custom layout",
        category: "saved",
        settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
        pages: [{ id: "p1", items: [] }],
      },
    ]
    storage.set("sb:export-templates", JSON.stringify(saved))

    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /saved/i }))
    expect(screen.getByText("My Custom Template")).toBeInTheDocument()
  })

  it("does not render when open is false", () => {
    const { container } = render(
      <TemplateDialog
        open={false}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
      />,
    )

    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument()
  })

  it("shows Save current button when onSaveCurrent callback is provided", async () => {
    const user = userEvent.setup()
    const onSaveCurrent = vi.fn()
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
        onSaveCurrent={onSaveCurrent}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /saved/i }))
    const saveBtn = screen.getByRole("button", { name: /save current/i })
    expect(saveBtn).toBeInTheDocument()

    await user.click(saveBtn)
    expect(onSaveCurrent).toHaveBeenCalledTimes(1)
  })
})
