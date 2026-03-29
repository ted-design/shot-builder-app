/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// ---- Mocks ----

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({
  storage: {},
}))

import { ReferenceInput } from "./ReferenceInput"
import type { ShotRequestReference } from "@/shared/types"

function renderInput(
  refs: readonly ShotRequestReference[] = [],
  onChange = vi.fn(),
) {
  return render(
    <ReferenceInput
      clientId="c1"
      requestId="req-1"
      references={refs}
      onChange={onChange}
    />,
  )
}

describe("ReferenceInput", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders 'Add reference' button when list is empty", () => {
    renderInput()
    expect(screen.getByText(/add reference/i)).toBeInTheDocument()
  })

  it("calls onChange with a new empty reference on 'Add reference' click", () => {
    const onChange = vi.fn()
    renderInput([], onChange)
    fireEvent.click(screen.getByText(/add reference/i))
    expect(onChange).toHaveBeenCalledWith([
      { url: "", imageUrl: null, caption: null },
    ])
  })

  it("renders existing references", () => {
    renderInput([
      { url: "https://example.com", imageUrl: null, caption: "Caption A" },
      { url: "https://other.com", imageUrl: null, caption: null },
    ])
    expect(screen.getByText("Reference 1")).toBeInTheDocument()
    expect(screen.getByText("Reference 2")).toBeInTheDocument()
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Caption A")).toBeInTheDocument()
  })

  it("calls onChange with updated URL when URL input changes", () => {
    const onChange = vi.fn()
    renderInput([{ url: "", imageUrl: null, caption: null }], onChange)

    const urlInput = screen.getByLabelText(/reference 1 url/i)
    fireEvent.change(urlInput, { target: { value: "https://new.com" } })

    expect(onChange).toHaveBeenCalledWith([
      { url: "https://new.com", imageUrl: null, caption: null },
    ])
  })

  it("calls onChange with updated caption when caption input changes", () => {
    const onChange = vi.fn()
    renderInput([{ url: "https://example.com", imageUrl: null, caption: null }], onChange)

    const captionInput = screen.getByLabelText(/reference 1 caption/i)
    fireEvent.change(captionInput, { target: { value: "My caption" } })

    expect(onChange).toHaveBeenCalledWith([
      { url: "https://example.com", imageUrl: null, caption: "My caption" },
    ])
  })

  it("calls onChange without the removed reference on remove click", () => {
    const onChange = vi.fn()
    renderInput(
      [
        { url: "https://first.com", imageUrl: null, caption: null },
        { url: "https://second.com", imageUrl: null, caption: null },
      ],
      onChange,
    )

    fireEvent.click(screen.getByLabelText("Remove reference 1"))

    expect(onChange).toHaveBeenCalledWith([
      { url: "https://second.com", imageUrl: null, caption: null },
    ])
  })

  it("shows image preview when imageUrl is set", () => {
    renderInput([
      { url: "https://example.com", imageUrl: "https://img.example.com/photo.jpg", caption: null },
    ])
    const img = screen.getByAltText("Reference preview")
    expect(img).toHaveAttribute("src", "https://img.example.com/photo.jpg")
  })

  it("shows 'Attach image' button when imageUrl is null", () => {
    renderInput([{ url: "https://example.com", imageUrl: null, caption: null }])
    expect(screen.getByText(/attach image/i)).toBeInTheDocument()
  })

  it("calls onChange to clear imageUrl when 'Remove image' is clicked", () => {
    const onChange = vi.fn()
    renderInput(
      [{ url: "https://example.com", imageUrl: "https://img.example.com/photo.jpg", caption: null }],
      onChange,
    )
    fireEvent.click(screen.getByText("Remove image"))
    expect(onChange).toHaveBeenCalledWith([
      { url: "https://example.com", imageUrl: null, caption: null },
    ])
  })

  it("does not call onChange for empty state on initial render", () => {
    const onChange = vi.fn()
    renderInput([], onChange)
    expect(onChange).not.toHaveBeenCalled()
  })
})
