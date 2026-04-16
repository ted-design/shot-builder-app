import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TemplateDialog } from "../TemplateDialog"
import { BUILT_IN_TEMPLATES } from "../../lib/builtInTemplates"
import type { ExportTemplate } from "../../types/exportBuilder"

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

    fireEvent.click(screen.getByText(BUILT_IN_TEMPLATES[0]!.name))
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

  it("shows workspace tab with empty message when no workspace templates", async () => {
    const user = userEvent.setup()
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
        workspaceTemplates={[]}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /workspace/i }))
    expect(screen.getByText(/no workspace templates/i)).toBeInTheDocument()
  })

  it("shows workspace templates when provided", async () => {
    const user = userEvent.setup()
    const templates: ExportTemplate[] = [
      {
        id: "ws-1",
        name: "My Custom Template",
        description: "Custom layout",
        category: "workspace",
        settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
        pages: [{ id: "p1", items: [] }],
        createdBy: "user-1",
      },
    ]

    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
        workspaceTemplates={templates}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /workspace/i }))
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

    await user.click(screen.getByRole("tab", { name: /workspace/i }))
    const saveBtn = screen.getByRole("button", { name: /save current/i })
    expect(saveBtn).toBeInTheDocument()

    await user.click(saveBtn)
    expect(onSaveCurrent).toHaveBeenCalledTimes(1)
  })

  it("shows delete button on workspace templates when onDeleteTemplate provided", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const templates: ExportTemplate[] = [
      {
        id: "ws-1",
        name: "Deletable Template",
        description: "Can be deleted",
        category: "workspace",
        settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
        pages: [{ id: "p1", items: [] }],
      },
    ]

    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
        workspaceTemplates={templates}
        onDeleteTemplate={onDelete}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /workspace/i }))
    const deleteBtn = screen.getByRole("button", { name: /delete deletable template/i })
    await user.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledWith("ws-1")
  })

  it("shows loading state when workspaceLoading is true", async () => {
    const user = userEvent.setup()
    render(
      <TemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectTemplate={vi.fn()}
        workspaceLoading={true}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /workspace/i }))
    expect(screen.getByText(/loading templates/i)).toBeInTheDocument()
  })
})
