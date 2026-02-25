/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ShotBatchCreate } from "@/features/shots/components/ShotBatchCreate"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBatchCreate(overrides: Partial<Parameters<typeof ShotBatchCreate>[0]> = {}) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onBatchCreate: vi.fn(() => Promise.resolve()),
    creating: false,
    ...overrides,
  }
  return { ...render(<ShotBatchCreate {...defaultProps} />), props: defaultProps }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShotBatchCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders textarea and Create all button when open", () => {
    renderBatchCreate()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /create all/i })).toBeInTheDocument()
  })

  it("Create all is disabled when textarea is empty", () => {
    renderBatchCreate()
    expect(screen.getByRole("button", { name: /create all/i })).toBeDisabled()
  })

  it("Create all is disabled when creating is true", () => {
    renderBatchCreate({ creating: true })
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "Shot A\nShot B" } })
    expect(screen.getByRole("button", { name: /create all/i })).toBeDisabled()
  })

  it("counts non-empty lines correctly (ignores blank lines)", () => {
    renderBatchCreate()
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "Shot A\n\n  \nShot B\nShot C\n" } })
    expect(screen.getByText("3 shots to create")).toBeInTheDocument()
  })

  it("calls onBatchCreate with trimmed non-empty lines", async () => {
    const { props } = renderBatchCreate()
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "  Shot A  \n\nShot B\n  \nShot C  " } })

    fireEvent.click(screen.getByRole("button", { name: /create all/i }))

    await waitFor(() => {
      expect(props.onBatchCreate).toHaveBeenCalledWith(["Shot A", "Shot B", "Shot C"])
    })
  })

  it("Cancel button calls onOpenChange(false)", () => {
    const { props } = renderBatchCreate()
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows correct count text (singular vs plural)", () => {
    renderBatchCreate()
    const textarea = screen.getByRole("textbox")

    // Zero
    expect(screen.getByText("0 shots to create")).toBeInTheDocument()

    // Singular
    fireEvent.change(textarea, { target: { value: "One shot" } })
    expect(screen.getByText("1 shot to create")).toBeInTheDocument()

    // Plural
    fireEvent.change(textarea, { target: { value: "Shot A\nShot B" } })
    expect(screen.getByText("2 shots to create")).toBeInTheDocument()
  })

  it("textarea has placeholder with example titles", () => {
    renderBatchCreate()
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.placeholder).toContain("Hero")
    expect(textarea.placeholder).toContain("Flat Lay")
  })
})
